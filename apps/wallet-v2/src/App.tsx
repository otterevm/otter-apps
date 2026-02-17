import * as React from 'react'
import { toCanvas } from 'qrcode'
import { Scanner } from '@yudiel/react-qr-scanner'
import {
  useAccount,
  useChains,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useReadContract,
  useWriteContract,
} from 'wagmi'
import { formatUnits, parseUnits, isAddress } from 'viem'
import tokensData from './tokens.json'

const erc20Abi = [
  {
    constant: true,
    inputs: [{ name: '_owner', type: 'address' }],
    name: 'balanceOf',
    outputs: [{ name: 'balance', type: 'uint256' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'decimals',
    outputs: [{ name: '', type: 'uint8' }],
    type: 'function',
  },
  {
    constant: true,
    inputs: [],
    name: 'symbol',
    outputs: [{ name: '', type: 'string' }],
    type: 'function',
  },
  {
    constant: false,
    inputs: [
      { name: '_to', type: 'address' },
      { name: '_value', type: 'uint256' },
    ],
    name: 'transfer',
    outputs: [{ name: '', type: 'bool' }],
    type: 'function',
  },
] as const

// Token type from JSON
interface Token {
  address: string
  symbol: string
  name: string
  decimals: number
}

const tokens: Token[] = tokensData.tokens

// QR Code Modal Component
function QRCodeModal({ address, onClose }: { address: string; onClose: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isGenerating, setIsGenerating] = React.useState(true)
  const [selectedToken, setSelectedToken] = React.useState<Token>(tokens[0])
  const [lastTx, setLastTx] = React.useState<{hash: string, amount: string, symbol: string} | null>(null)
  const wsRef = React.useRef<WebSocket | null>(null)
  const seenTxRef = React.useRef<Set<string>>(new Set())

  // Play beep sound
  const playBeep = () => {
    try {
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)()
      const oscillator = audioContext.createOscillator()
      const gainNode = audioContext.createGain()
      
      oscillator.connect(gainNode)
      gainNode.connect(audioContext.destination)
      
      oscillator.frequency.value = 800
      oscillator.type = 'sine'
      
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime)
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.3)
      
      oscillator.start(audioContext.currentTime)
      oscillator.stop(audioContext.currentTime + 0.3)
    } catch {
      // Ignore audio errors
    }
  }

  // Watch for incoming transfers via WebSocket
  React.useEffect(() => {
    const wsUrl = 'wss://rpc.pakxe.otterevm.com/ws'
    const ws = new WebSocket(wsUrl)
    wsRef.current = ws

    ws.onopen = () => {
      // Subscribe to ERC20 Transfer events for selected token
      // Transfer event signature: keccak256("Transfer(address,address,uint256)")
      const transferEventSignature = '0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef'
      const addressPadded = '0x' + address.toLowerCase().slice(2).padStart(64, '0')
      
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: ['logs', {
          address: selectedToken.address,
          topics: [
            transferEventSignature,  // Event signature
            null,                     // From: any
            addressPadded            // To: our address
          ]
        }]
      }))
    }

    ws.onmessage = async (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.method === 'eth_subscription' && data.params?.result) {
          const log = data.params.result
          const txHash = log.transactionHash
          
          if (!seenTxRef.current.has(txHash)) {
            seenTxRef.current.add(txHash)
            
            // Decode amount from data (uint256 at position 0)
            const amountHex = log.data
            const amount = formatUnits(BigInt(amountHex), selectedToken.decimals)
            
            setLastTx({
              hash: txHash,
              amount: Number(amount).toFixed(4),
              symbol: selectedToken.symbol
            })
            playBeep()
          }
        }
      } catch {
        // Ignore parsing errors
      }
    }

    ws.onerror = () => {
      // Ignore WebSocket errors
    }

    return () => {
      ws.close()
      wsRef.current = null
    }
  }, [address, selectedToken])

  React.useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return

      try {
        // EIP-681 format: ethereum:tokenAddress/transfer?address=recipientAddress
        const eip681Url = `ethereum:${selectedToken.address}/transfer?address=${address}`
        
        // Generate QR Code at 640x640
        await toCanvas(canvasRef.current, eip681Url, {
          width: 640,
          margin: 4,
          color: {
            dark: '#0a0a0a',
            light: '#ffffff',
          },
        })

        // Add logo in center
        const canvas = canvasRef.current
        const ctx = canvas.getContext('2d')
        if (!ctx) return

        const logoSize = 120
        const centerX = (canvas.width - logoSize) / 2
        const centerY = (canvas.height - logoSize) / 2

        // Draw white background for logo
        ctx.fillStyle = '#ffffff'
        ctx.beginPath()
        ctx.roundRect(centerX - 8, centerY - 8, logoSize + 16, logoSize + 16, 16)
        ctx.fill()

        // Load and draw logo
        const logo = new Image()
        logo.crossOrigin = 'anonymous'
        logo.onload = () => {
          ctx.drawImage(logo, centerX, centerY, logoSize, logoSize)
          setIsGenerating(false)
        }
        logo.onerror = () => {
          setIsGenerating(false)
        }
        logo.src = '/logo.svg'
      } catch {
        setIsGenerating(false)
      }
    }

    generateQR()
  }, [address, selectedToken])

  const handleDownload = () => {
    if (!canvasRef.current) return

    const link = document.createElement('a')
    link.download = `otter-wallet-${address.slice(0, 8)}.png`
    link.href = canvasRef.current.toDataURL('image/png')
    link.click()
  }

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          padding: '24px', 
          maxWidth: '100%',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Receive</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          {/* Token Selector */}
          <div style={{ width: '100%', marginBottom: '16px' }}>
            <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
              Select Token to Receive
            </label>
            <select
              value={selectedToken.address}
              onChange={(e) => {
                const token = tokens.find(t => t.address === e.target.value)
                if (token) {
                  setSelectedToken(token)
                  seenTxRef.current.clear() // Reset seen transactions when changing token
                }
              }}
              style={{
                width: '100%',
                padding: '10px',
                fontSize: '14px',
                border: '1px solid #ddd',
                borderRadius: '8px',
                backgroundColor: 'white',
                cursor: 'pointer'
              }}
            >
              {tokens.map((token) => (
                <option key={token.address} value={token.address}>
                  {token.symbol} - {token.name}
                </option>
              ))}
            </select>
            <p style={{ fontSize: '11px', color: '#999', margin: '4px 0 0 0' }}>
              Watching for {selectedToken.symbol} transfers to this address
            </p>
          </div>

          {/* Incoming Transfer Notification */}
          {lastTx && (
            <div style={{
              width: '100%',
              padding: '16px',
              backgroundColor: '#dcfce7',
              borderRadius: '12px',
              marginBottom: '16px',
              textAlign: 'center',
              animation: 'pulse 0.5s ease-in-out'
            }}>
              <div style={{ fontSize: '24px', marginBottom: '8px' }}>🎉</div>
              <div style={{ fontSize: '16px', fontWeight: '600', color: '#166534', marginBottom: '4px' }}>
                Received!
              </div>
              <div style={{ fontSize: '20px', fontWeight: '700', color: '#16a34a' }}>
                +{lastTx.amount} {lastTx.symbol}
              </div>
              <a 
                href={`https://exp.pakxe.otterevm.com/tx/${lastTx.hash}`}
                target="_blank"
                rel="noopener noreferrer"
                style={{ fontSize: '12px', color: '#3b82f6', marginTop: '8px', display: 'inline-block' }}
              >
                View Transaction ↗
              </a>
            </div>
          )}

          <div style={{ 
            backgroundColor: 'white', 
            padding: '16px', 
            borderRadius: '12px',
            marginBottom: '16px'
          }}>
            {isGenerating && (
              <div style={{ width: '320px', height: '320px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <div>Generating...</div>
              </div>
            )}
            <canvas
              ref={canvasRef}
              style={{ 
                maxWidth: '320px', 
                maxHeight: '320px', 
                display: isGenerating ? 'none' : 'block' 
              }}
            />
            <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '8px 0 0 0' }}>
              Scan to send <strong>{selectedToken.symbol}</strong>
            </p>
          </div>

          <p style={{ fontSize: '12px', color: '#666', margin: '0 0 8px 0' }}>Wallet Address</p>
          <p style={{ fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all', textAlign: 'center', margin: '0 0 16px 0' }}>
            {address}
          </p>

          <button
            onClick={handleDownload}
            disabled={isGenerating}
            style={{
              padding: '12px 24px',
              backgroundColor: isGenerating ? '#ccc' : '#3b82f6',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              cursor: isGenerating ? 'not-allowed' : 'pointer',
              fontSize: '14px',
              fontWeight: '500'
            }}
          >
            {isGenerating ? 'Generating...' : 'Save QR Code (640×640)'}
          </button>
        </div>
      </div>
    </div>
  )
}

// Send Modal Component
function SendModal({ 
  address, 
  onClose, 
  initialRecipient = '', 
  initialToken, 
  initialAmount = '' 
}: { 
  address: string; 
  onClose: () => void;
  initialRecipient?: string;
  initialToken?: Token;
  initialAmount?: string;
}) {
  const [selectedToken, setSelectedToken] = React.useState<Token>(initialToken ?? tokens[0])
  const [recipient, setRecipient] = React.useState(initialRecipient)
  const [amount, setAmount] = React.useState(initialAmount)
  const [error, setError] = React.useState('')
  const [isSuccess, setIsSuccess] = React.useState(false)
  const [showScanner, setShowScanner] = React.useState(false)

  const { data: balance } = useReadContract({
    address: selectedToken.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })

  const formattedBalance = React.useMemo(() => {
    if (balance === undefined || balance === null) return '0.00'
    return Number(formatUnits(balance as bigint, selectedToken.decimals)).toFixed(4)
  }, [balance, selectedToken])

  const { writeContract, isPending, data: hash } = useWriteContract()

  const handleSend = () => {
    setError('')

    if (!recipient || !amount) {
      setError('Please enter recipient address and amount')
      return
    }

    if (!isAddress(recipient)) {
      setError('Invalid recipient address')
      return
    }

    const amountNum = parseFloat(amount)
    if (isNaN(amountNum) || amountNum <= 0) {
      setError('Invalid amount')
      return
    }

    try {
      const parsedAmount = parseUnits(amount, selectedToken.decimals)
      
      writeContract({
        address: selectedToken.address as `0x${string}`,
        abi: erc20Abi,
        functionName: 'transfer',
        args: [recipient as `0x${string}`, parsedAmount],
      })
      
      setIsSuccess(true)
    } catch (err) {
      setError('Failed to send transaction')
    }
  }

  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'rgba(0,0,0,0.5)',
        zIndex: 50,
        padding: '20px'
      }}
      onClick={onClose}
    >
      <div 
        style={{ 
          backgroundColor: 'white', 
          borderRadius: '16px', 
          padding: '24px', 
          width: '100%',
          maxWidth: '400px',
          maxHeight: '90vh',
          overflow: 'auto'
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
          <h2 style={{ margin: 0, fontSize: '18px' }}>Send Tokens</h2>
          <button 
            onClick={onClose}
            style={{ 
              background: 'none', 
              border: 'none', 
              fontSize: '24px', 
              cursor: 'pointer',
              padding: '4px 8px'
            }}
          >
            ×
          </button>
        </div>

        {isSuccess ? (
          <div style={{ textAlign: 'center', padding: '20px 0' }}>
            <div style={{ 
              width: '60px', 
              height: '60px', 
              borderRadius: '50%', 
              backgroundColor: '#dcfce7', 
              display: 'flex', 
              alignItems: 'center', 
              justifyContent: 'center',
              margin: '0 auto 16px'
            }}>
              <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#16a34a" strokeWidth="2">
                <polyline points="20 6 9 17 4 12" />
              </svg>
            </div>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '16px' }}>Transaction Sent!</h3>
            {hash && (
              <p style={{ fontSize: '12px', color: '#666', margin: '0 0 16px 0', wordBreak: 'break-all' }}>
                Hash: {hash}
              </p>
            )}
            <button
              onClick={onClose}
              style={{
                padding: '12px 24px',
                backgroundColor: '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: 'pointer',
                fontSize: '14px'
              }}
            >
              Close
            </button>
          </div>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
            {/* Token Selector */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                Token
              </label>
              <select
                value={selectedToken.address}
                onChange={(e) => {
                  const token = tokens.find((t) => t.address === e.target.value)
                  if (token) setSelectedToken(token)
                }}
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  backgroundColor: 'white',
                  cursor: 'pointer'
                }}
              >
                {tokens.map((token) => (
                  <option key={token.address} value={token.address}>
                    {token.symbol} - {token.name}
                  </option>
                ))}
              </select>
              <div style={{ fontSize: '12px', color: '#666', marginTop: '4px' }}>
                Balance: {formattedBalance} {selectedToken.symbol}
              </div>
            </div>

            {/* Recipient */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                Recipient Address
              </label>
              <div style={{ display: 'flex', gap: '8px' }}>
                <input
                  type="text"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder="0x..."
                  style={{
                    flex: 1,
                    padding: '12px',
                    fontSize: '14px',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    fontFamily: 'monospace',
                    boxSizing: 'border-box'
                  }}
                />
                <button
                  onClick={() => setShowScanner(true)}
                  type="button"
                  style={{
                    padding: '12px',
                    backgroundColor: '#f5f5f5',
                    border: '1px solid #ddd',
                    borderRadius: '8px',
                    cursor: 'pointer',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center'
                  }}
                  title="Scan QR Code"
                >
                  <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="3" y="3" width="7" height="7" />
                    <rect x="14" y="3" width="7" height="7" />
                    <rect x="14" y="14" width="7" height="7" />
                    <rect x="3" y="14" width="7" height="7" />
                  </svg>
                </button>
              </div>
            </div>

            {/* QR Scanner */}
            {showScanner && (
              <div style={{
                position: 'fixed',
                inset: 0,
                backgroundColor: 'rgba(0,0,0,0.8)',
                zIndex: 100,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                padding: '20px'
              }}>
                <div style={{
                  backgroundColor: 'white',
                  borderRadius: '16px',
                  padding: '20px',
                  width: '100%',
                  maxWidth: '400px'
                }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                    <h3 style={{ margin: 0, fontSize: '16px' }}>Scan QR Code</h3>
                    <button
                      onClick={() => setShowScanner(false)}
                      style={{
                        background: 'none',
                        border: 'none',
                        fontSize: '24px',
                        cursor: 'pointer'
                      }}
                    >
                      ×
                    </button>
                  </div>
                  <Scanner
                    onScan={(result) => {
                      if (result && result.length > 0) {
                        const scanned = result[0].rawValue
                        
                        // Parse EIP-681 format
                        // ethereum:tokenAddress/transfer?address=recipientAddress&uint256=amount
                        // ethereum:recipientAddress (fallback for plain address)
                        if (scanned.startsWith('ethereum:')) {
                          const urlStr = scanned.replace('ethereum:', '')
                          
                          // Check for ERC20 transfer format: tokenAddress/transfer?address=...
                          const transferMatch = urlStr.match(/^(0x[a-fA-F0-9]{40})\/transfer\?(.+)$/i)
                          
                          if (transferMatch) {
                            const tokenAddress = transferMatch[1].toLowerCase()
                            const queryString = transferMatch[2]
                            
                            // Parse query params
                            const params = new URLSearchParams(queryString)
                            const recipientAddress = params.get('address')
                            const amountParam = params.get('uint256')
                            
                            // Auto-select token if found in our list
                            const foundToken = tokens.find(t => t.address.toLowerCase() === tokenAddress)
                            if (foundToken) {
                              setSelectedToken(foundToken)
                            }
                            
                            if (recipientAddress && isAddress(recipientAddress)) {
                              setRecipient(recipientAddress)
                              
                              // Auto-fill amount if provided
                              if (amountParam) {
                                try {
                                  const amountBigInt = BigInt(amountParam)
                                  const decimals = foundToken?.decimals ?? 6
                                  const amountFormatted = formatUnits(amountBigInt, decimals)
                                  setAmount(amountFormatted)
                                } catch {
                                  // Ignore amount parsing errors
                                }
                              }
                              
                              setShowScanner(false)
                            }
                          } else {
                            // Plain address format: ethereum:0xRecipientAddress
                            const plainAddress = urlStr.split('@')[0].split('?')[0]
                            if (isAddress(plainAddress)) {
                              setRecipient(plainAddress)
                              setShowScanner(false)
                            }
                          }
                        } else if (isAddress(scanned)) {
                          // Plain address without ethereum: prefix
                          setRecipient(scanned)
                          setShowScanner(false)
                        }
                      }
                    }}
                    styles={{
                      container: { borderRadius: '12px', overflow: 'hidden' }
                    }}
                  />
                  <p style={{ fontSize: '12px', color: '#666', textAlign: 'center', margin: '12px 0 0 0' }}>
                    Point camera at QR code to scan
                  </p>
                </div>
              </div>
            )}

            {/* Amount */}
            <div>
              <label style={{ display: 'block', fontSize: '12px', color: '#666', marginBottom: '6px' }}>
                Amount
              </label>
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.00"
                min="0"
                step="0.000001"
                style={{
                  width: '100%',
                  padding: '12px',
                  fontSize: '14px',
                  border: '1px solid #ddd',
                  borderRadius: '8px',
                  boxSizing: 'border-box'
                }}
              />
            </div>

            {error && (
              <div style={{ color: '#dc2626', fontSize: '12px', padding: '8px', backgroundColor: '#fef2f2', borderRadius: '6px' }}>
                {error}
              </div>
            )}

            <button
              onClick={handleSend}
              disabled={isPending}
              style={{
                width: '100%',
                padding: '14px',
                backgroundColor: isPending ? '#ccc' : '#3b82f6',
                color: 'white',
                border: 'none',
                borderRadius: '8px',
                cursor: isPending ? 'not-allowed' : 'pointer',
                fontSize: '16px',
                fontWeight: '500',
                marginTop: '8px'
              }}
            >
              {isPending ? 'Sending...' : 'Send'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function BlockNumber() {
  const [blockNumber, setBlockNumber] = React.useState<bigint | null>(null)
  
  // Subscribe to newHeads via WebSocket for real-time block updates
  React.useEffect(() => {
    const ws = new WebSocket('wss://rpc.pakxe.otterevm.com/ws')
    
    ws.onopen = () => {
      ws.send(JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_subscribe',
        params: ['newHeads']
      }))
    }
    
    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data.method === 'eth_subscription' && data.params?.result?.number) {
          const num = BigInt(data.params.result.number)
          setBlockNumber(num)
        }
      } catch {
        // Ignore errors
      }
    }
    
    ws.onerror = () => {
      // Ignore WebSocket errors
    }
    
    return () => {
      ws.close()
    }
  }, [])
  
  return (
    <a 
      href="https://exp.pakxe.otterevm.com/"
      target="_blank"
      rel="noopener noreferrer"
      style={{ 
        display: 'flex', 
        alignItems: 'center', 
        gap: '6px',
        fontSize: '14px',
        color: '#666',
        textDecoration: 'none'
      }}
    >
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="9" y1="3" x2="9" y2="21" />
      </svg>
      <span style={{ fontFamily: 'monospace', minWidth: '6ch' }}>
        {blockNumber ? blockNumber.toString() : '…'}
      </span>
    </a>
  )
}

export function App() {
  const account = useAccount()

  return (
    <div style={{ maxWidth: '400px', margin: '0 auto', padding: '20px', fontFamily: 'system-ui, sans-serif' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
          <img src="/logo.svg" alt="OtterEVM" style={{ width: '48px', height: '48px' }} />
          <h1 style={{ margin: 0, fontSize: '24px' }}>Otter Wallet</h1>
        </div>
        <BlockNumber />
      </div>
      <hr />
      {account.isConnected ? (
        <>
          <h2>Account</h2>
          <Account />
        </>
      ) : (
        <>
          <h2>Connect</h2>
          <Connect />
        </>
      )}
    </div>
  )
}

export function Connect() {
  const [isConnecting, setIsConnecting] = React.useState(false)
  const connect = useConnect()
  const connectors = useConnectors()

  const webAuthnConnector = React.useMemo(
    () => connectors.find((connector) => connector.id === 'webAuthn'),
    [connectors],
  )

  const handleConnect = () => {
    if (!webAuthnConnector) return
    setIsConnecting(true)
    
    // Try sign in first - if no credential, will fail fast without QR code
    // because we set authenticatorAttachment: 'platform' in config
    connect.connect(
      { connector: webAuthnConnector },
      {
        onError: (error) => {
          const errorMessage = error instanceof Error ? error.message : String(error)
          
          // User cancelled - stop
          if (errorMessage.toLowerCase().includes('cancel') ||
              errorMessage.toLowerCase().includes('abort')) {
            setIsConnecting(false)
            return
          }
          
          // No credential found - auto create (will use platform authenticator)
          if (errorMessage.toLowerCase().includes('credential') || 
              errorMessage.toLowerCase().includes('not found') ||
              errorMessage.toLowerCase().includes('discover')) {
            connect.connect(
              {
                connector: webAuthnConnector,
                // @ts-ignore - capabilities is supported at runtime
                capabilities: { type: 'sign-up' },
              },
              {
                onSettled: () => setIsConnecting(false),
              }
            )
          } else {
            setIsConnecting(false)
          }
        },
        onSettled: () => setIsConnecting(false),
      }
    )
  }

  if (connect.isPending || isConnecting) {
    return <div style={{ textAlign: 'center', padding: '20px' }}>Check prompt...</div>
  }
  
  return (
    <div>
      <div style={{ textAlign: 'center', marginBottom: '24px' }}>
        <p style={{ color: '#666', fontSize: '14px', margin: '0 0 8px 0' }}>
          Welcome to Otter Wallet
        </p>
        <p style={{ color: '#999', fontSize: '12px', margin: 0 }}>
          Sign in with your passkey or create a new wallet
        </p>
      </div>
      
      <button
        onClick={handleConnect}
        disabled={!webAuthnConnector}
        type="button"
        style={{ 
          width: '100%',
          padding: '14px', 
          fontSize: '16px', 
          cursor: webAuthnConnector ? 'pointer' : 'not-allowed',
          backgroundColor: '#3b82f6',
          color: 'white',
          border: 'none',
          borderRadius: '8px',
          fontWeight: '500'
        }}
      >
        Sign in with Passkey
      </button>
    </div>
  )
}

function BalanceDisplay({ address, token }: { address: string; token: Token }) {
  const { data: balance } = useReadContract({
    address: token.address as `0x${string}`,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })

  const formattedBalance = React.useMemo(() => {
    if (balance === undefined || balance === null) return '0.00'
    return Number(formatUnits(balance as bigint, token.decimals)).toFixed(4)
  }, [balance, token])

  return (
    <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>{token.symbol} Balance</div>
      <div style={{ fontSize: '20px', fontWeight: '500' }}>
        {formattedBalance} {token.symbol}
      </div>
    </div>
  )
}

// Quick Scan Modal - opens camera immediately
function QuickScanModal({ onClose, onScan }: { onClose: () => void; onScan: (recipient: string, token?: Token, amount?: string) => void }) {
  return (
    <div 
      style={{ 
        position: 'fixed', 
        inset: 0, 
        display: 'flex', 
        alignItems: 'center', 
        justifyContent: 'center', 
        backgroundColor: 'rgba(0,0,0,0.9)',
        zIndex: 100
      }}
      onClick={onClose}
    >
      <div 
        onClick={(e) => e.stopPropagation()}
        style={{ 
          width: '100%',
          maxWidth: '400px',
          padding: '20px'
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
          <h2 style={{ margin: 0, fontSize: '18px', color: 'white' }}>Scan QR Code</h2>
          <button
            onClick={onClose}
            style={{
              background: 'none',
              border: 'none',
              fontSize: '24px',
              color: 'white',
              cursor: 'pointer'
            }}
          >
            ×
          </button>
        </div>
        
        <Scanner
          onScan={(result) => {
            if (result && result.length > 0) {
              const scanned = result[0].rawValue
              
              // Parse EIP-681 format
              if (scanned.startsWith('ethereum:')) {
                const urlStr = scanned.replace('ethereum:', '')
                
                // Check for ERC20 transfer format: tokenAddress/transfer?address=...
                const transferMatch = urlStr.match(/^(0x[a-fA-F0-9]{40})\/transfer\?(.+)$/i)
                
                if (transferMatch) {
                  const tokenAddress = transferMatch[1].toLowerCase()
                  const queryString = transferMatch[2]
                  const params = new URLSearchParams(queryString)
                  const recipientAddress = params.get('address')
                  const amountParam = params.get('uint256')
                  
                  const foundToken = tokens.find(t => t.address.toLowerCase() === tokenAddress)
                  
                  if (recipientAddress && isAddress(recipientAddress)) {
                    let amount: string | undefined
                    if (amountParam) {
                      try {
                        const amountBigInt = BigInt(amountParam)
                        const decimals = foundToken?.decimals ?? 6
                        amount = formatUnits(amountBigInt, decimals)
                      } catch {
                        // ignore
                      }
                    }
                    onScan(recipientAddress, foundToken, amount)
                    return
                  }
                } else {
                  // Plain address format
                  const plainAddress = urlStr.split('@')[0].split('?')[0]
                  if (isAddress(plainAddress)) {
                    onScan(plainAddress)
                    return
                  }
                }
              } else if (isAddress(scanned)) {
                onScan(scanned)
                return
              }
            }
          }}
          styles={{
            container: { borderRadius: '12px', overflow: 'hidden' }
          }}
        />
        <p style={{ fontSize: '12px', color: '#999', textAlign: 'center', margin: '12px 0 0 0' }}>
          Point camera at QR code to scan
        </p>
      </div>
    </div>
  )
}

export function Account() {
  const account = useAccount()
  const chains = useChains()
  const disconnect = useDisconnect()
  const switchChain = useSwitchChain()
  const [copied, setCopied] = React.useState(false)
  const [showQR, setShowQR] = React.useState(false)
  const [showSend, setShowSend] = React.useState(false)
  const [showScan, setShowScan] = React.useState(false)
  const [sendInitialState, setSendInitialState] = React.useState<{recipient?: string, token?: Token, amount?: string} | null>(null)

  const [chain] = chains
  const isSupportedChain = chains.some((chain) => chain.id === account.chainId)

  const handleCopy = async () => {
    if (!account.address) return
    try {
      await navigator.clipboard.writeText(account.address)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // ignore
    }
  }

  const handleScan = (recipient: string, token?: Token, amount?: string) => {
    setSendInitialState({ recipient, token, amount })
    setShowScan(false)
    setShowSend(true)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {showQR && account.address && (
        <QRCodeModal address={account.address} onClose={() => setShowQR(false)} />
      )}
      
      {showSend && account.address && (
        <SendModal 
          address={account.address} 
          onClose={() => {
            setShowSend(false)
            setSendInitialState(null)
          }}
          initialRecipient={sendInitialState?.recipient}
          initialToken={sendInitialState?.token}
          initialAmount={sendInitialState?.amount}
        />
      )}

      {showScan && (
        <QuickScanModal 
          onClose={() => setShowScan(false)} 
          onScan={handleScan}
        />
      )}
      
      {account.address && tokens.map((token) => (
        <BalanceDisplay key={token.address} address={account.address as string} token={token} />
      ))}
      
      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: '8px', marginTop: '5px' }}>
        <button
          onClick={() => setShowSend(true)}
          type="button"
          style={{ 
            flex: 1,
            padding: '12px', 
            fontSize: '13px', 
            cursor: 'pointer',
            backgroundColor: '#3b82f6',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '500'
          }}
        >
          Send
        </button>
        <button
          onClick={() => setShowScan(true)}
          type="button"
          style={{ 
            flex: 1,
            padding: '12px', 
            fontSize: '13px', 
            cursor: 'pointer',
            backgroundColor: '#22c55e',
            color: 'white',
            border: 'none',
            borderRadius: '8px',
            fontWeight: '500',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '4px'
          }}
        >
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
            <rect x="3" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="3" width="7" height="7" rx="1" />
            <rect x="14" y="14" width="7" height="7" rx="1" />
            <rect x="3" y="14" width="7" height="7" rx="1" />
          </svg>
          Scan
        </button>
        <button
          onClick={() => setShowQR(true)}
          type="button"
          style={{ 
            flex: 1,
            padding: '12px', 
            fontSize: '13px', 
            cursor: 'pointer',
            backgroundColor: '#f5f5f5',
            border: '1px solid #ddd',
            borderRadius: '8px'
          }}
        >
          Receive
        </button>
      </div>
      
      <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Address</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={handleCopy}
              type="button"
              style={{ 
                padding: '4px 8px', 
                fontSize: '12px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Copy address"
            >
              {copied ? (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <polyline points="20 6 9 17 4 12" />
                  </svg>
                  Copied!
                </>
              ) : (
                <>
                  <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <rect x="9" y="9" width="13" height="13" rx="2" ry="2" />
                    <path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" />
                  </svg>
                  Copy
                </>
              )}
            </button>
          </div>
        </div>
        <div style={{ fontFamily: 'monospace', fontSize: '14px', wordBreak: 'break-all' }}>
          {account.address}
        </div>
      </div>
      <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Chain ID</div>
        <div>
          {account.chainId}{' '}
          {!isSupportedChain && (
            <button
              onClick={() =>
                switchChain.switchChain({
                  chainId: chain.id,
                  addEthereumChainParameter: {
                    nativeCurrency: {
                      name: 'USD',
                      decimals: 18,
                      symbol: 'USD',
                    },
                  },
                })
              }
              type="button"
              style={{ fontSize: '12px' }}
            >
              Switch to {chain.name}
            </button>
          )}
        </div>
      </div>
      <button 
        onClick={() => disconnect.disconnect()} 
        type="button"
        style={{ padding: '12px', marginTop: '10px', cursor: 'pointer' }}
      >
        Sign out
      </button>
    </div>
  )
}
