import * as React from 'react'
import { toCanvas } from 'qrcode'
import {
  useAccount,
  useBlockNumber,
  useChains,
  useConnect,
  useConnectors,
  useDisconnect,
  useSwitchChain,
  useReadContract,
} from 'wagmi'
import { formatUnits } from 'viem'

// QR Code Modal Component
function QRCodeModal({ address, onClose }: { address: string; onClose: () => void }) {
  const canvasRef = React.useRef<HTMLCanvasElement>(null)
  const [isGenerating, setIsGenerating] = React.useState(true)

  React.useEffect(() => {
    const generateQR = async () => {
      if (!canvasRef.current) return

      try {
        // Generate QR Code at 640x640
        await toCanvas(canvasRef.current, address, {
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
  }, [address])

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

const USD_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000000' as const

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
] as const

function BlockNumber() {
  const { data: blockNumber } = useBlockNumber()
  
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
  const connect = useConnect()
  const connectors = useConnectors()

  const webAuthnConnector = React.useMemo(
    () => connectors.find((connector) => connector.id === 'webAuthn'),
    [connectors],
  )
  const walletConnectors = React.useMemo(
    () => connectors.filter((connector) => connector.id !== 'webAuthn'),
    [connectors],
  )

  if (connect.isPending) return <div style={{ textAlign: 'center', padding: '20px' }}>Check prompt...</div>
  return (
    <div>
      <h3>Passkey</h3>
      <div style={{ display: 'flex', gap: '10px', marginBottom: '15px' }}>
        <button
          onClick={() =>
            connect.connect({
              connector: webAuthnConnector!,
              capabilities: { type: 'sign-up' },
            })
          }
          type="button"
          style={{ flex: 1, padding: '12px', fontSize: '16px', cursor: 'pointer' }}
        >
          Sign up
        </button>

        <button
          onClick={() => connect.connect({ connector: webAuthnConnector! })}
          type="button"
          style={{ flex: 1, padding: '12px', fontSize: '16px', cursor: 'pointer' }}
        >
          Sign in
        </button>
      </div>

      {walletConnectors.length > 0 && (
        <>
          <h3>Wallets</h3>
          {walletConnectors.map((connector) => (
            <button
              key={connector.id}
              onClick={() => connect.connect({ connector })}
              type="button"
            >
              {connector.name}
            </button>
          ))}
        </>
      )}
    </div>
  )
}

function BalanceDisplay({ address }: { address: string }) {
  const { data: balance } = useReadContract({
    address: USD_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [address as `0x${string}`],
  })
  const { data: decimals } = useReadContract({
    address: USD_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'decimals',
  })
  const { data: symbol } = useReadContract({
    address: USD_TOKEN_ADDRESS,
    abi: erc20Abi,
    functionName: 'symbol',
  })

  const formattedBalance = React.useMemo(() => {
    if (balance === undefined || balance === null) return '0.00'
    return Number(formatUnits(balance as bigint, (decimals as number) ?? 6)).toFixed(4)
  }, [balance, decimals])

  return (
    <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
      <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px' }}>Balance</div>
      <div style={{ fontSize: '20px', fontWeight: '500' }}>
        {formattedBalance} {symbol || '…'}
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

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
      {showQR && account.address && (
        <QRCodeModal address={account.address} onClose={() => setShowQR(false)} />
      )}
      
      {account.address && <BalanceDisplay address={account.address} />}
      
      <div style={{ padding: '10px', background: '#f5f5f5', borderRadius: '8px' }}>
        <div style={{ fontSize: '12px', color: '#666', marginBottom: '4px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span>Address</span>
          <div style={{ display: 'flex', gap: '8px' }}>
            <button
              onClick={() => setShowQR(true)}
              type="button"
              style={{ 
                padding: '4px 8px', 
                fontSize: '12px', 
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: '4px'
              }}
              title="Show QR code"
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="7" />
                <rect x="14" y="3" width="7" height="7" />
                <rect x="14" y="14" width="7" height="7" />
                <rect x="3" y="14" width="7" height="7" />
              </svg>
              QR
            </button>
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
