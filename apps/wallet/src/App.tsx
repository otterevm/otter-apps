import * as React from 'react'
import { useConnect, useAccount, useDisconnect, useReadContract, useWriteContract } from 'wagmi'
import { formatUnits, parseUnits, isAddress } from 'viem'
import { Scanner } from '@yudiel/react-qr-scanner'
import { ThemeToggle } from '#comps/ThemeToggle'
import { QRCodeModal } from '#comps/QRCodeModal'
import { useAnimatedBlockNumber } from '#lib/block-number'
import SquareSquare from '~icons/lucide/square-square'
import Fingerprint from '~icons/lucide/fingerprint'
import LogOut from '~icons/lucide/log-out'
import Wallet from '~icons/lucide/wallet'
import X from '~icons/lucide/x'
import ArrowRight from '~icons/lucide/arrow-right'
import Copy from '~icons/lucide/copy'
import Check from '~icons/lucide/check'
import QrCode from '~icons/lucide/qr-code'
import Camera from '~icons/lucide/camera'
import { cx } from '#lib/css'
import './styles.css'

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

function App(): React.JSX.Element {
	const { address, isConnected } = useAccount()
	const blockNumber = useAnimatedBlockNumber()
	const [showSendModal, setShowSendModal] = React.useState(false)
	const [showQRModal, setShowQRModal] = React.useState(false)

	return (
		<div className="min-h-dvh flex flex-col bg-base-background">
			<header className="@container relative z-1">
				<div className="px-[24px] @min-[1240px]:pt-[48px] @min-[1240px]:px-[84px] flex items-center justify-between min-h-16 pt-[36px] select-none relative z-1">
					<div className="flex items-center gap-[12px] relative z-1 h-[28px]">
						<a href="/" className="flex items-center press-down py-[4px]">
							<img alt="OtterEVM" className="h-14 w-auto" src="/logo.svg" />
						</a>
					</div>
					<div className="relative z-1 flex items-center gap-[8px]">
						<ThemeToggle />
						<BlockNumber blockNumber={blockNumber} />
					</div>
				</div>
			</header>

			<main className="flex-1 flex flex-col items-center justify-center px-6 py-12">
				{isConnected && address ? (
					<WalletDashboard 
						address={address} 
						onSend={() => setShowSendModal(true)}
						onShowQR={() => setShowQRModal(true)}
					/>
				) : (
					<PasskeySignIn />
				)}
			</main>

			{showSendModal && (
				<SendModal 
					address={address!} 
					onClose={() => setShowSendModal(false)}
				/>
			)}

			{showQRModal && (
				<QRCodeModal
					address={address!}
					onClose={() => setShowQRModal(false)}
				/>
			)}
		</div>
	)
}

function BlockNumber({ blockNumber }: { blockNumber?: bigint }): React.JSX.Element {
	return (
		<a
			href="https://exp.pakxe.otterevm.com/"
			target="_blank"
			rel="noopener noreferrer"
			className="flex items-center gap-[6px] text-[15px] font-medium text-secondary press-down"
			title="View latest block"
		>
			<SquareSquare className="size-[18px] text-accent" />
			<div className="text-nowrap">
				<span className="text-primary font-medium tabular-nums font-mono min-w-[6ch] inline-block">
					{blockNumber != null ? String(blockNumber) : '…'}
				</span>
			</div>
		</a>
	)
}

function PasskeySignIn(): React.JSX.Element {
	const [isConnecting, setIsConnecting] = React.useState(false)
	const { connect, connectors } = useConnect()

	const passkeyConnector = React.useMemo(
		() => connectors.find((c) => c.id === 'webAuthn'),
		[connectors],
	)

	const handlePasskey = () => {
		if (!passkeyConnector) return
		setIsConnecting(true)
		connect(
			{ connector: passkeyConnector },
			{
				onSettled: () => setIsConnecting(false),
			},
		)
	}

	return (
		<div className="w-full max-w-md">
			<div className="text-center mb-12">
				<div className="inline-flex items-center justify-center w-20 h-20 rounded-2xl bg-surface border border-card-border mb-6">
					<Wallet className="size-10 text-accent" />
				</div>
				<h1 className="text-3xl font-medium text-primary mb-3">
					Otter Wallet
				</h1>
				<p className="text-secondary text-base">
					Sign in with your passkey to access your wallet
				</p>
			</div>

			<button
				onClick={handlePasskey}
				disabled={isConnecting || !passkeyConnector}
				className={cx(
					'w-full flex items-center justify-center gap-3 px-6 py-4 rounded-xl',
					'bg-surface border border-card-border',
					'text-primary font-medium',
					'hover:bg-base-plane transition-colors',
					'press-down cursor-pointer',
					isConnecting && 'opacity-70 cursor-wait',
					!passkeyConnector && 'opacity-50 cursor-not-allowed',
				)}
			>
				<Fingerprint className="size-5" />
				<span>{isConnecting ? 'Connecting…' : 'Sign in with Passkey'}</span>
			</button>

			<p className="mt-6 text-center text-sm text-tertiary">
				Don't have a wallet?{' '}
				<button
					onClick={handlePasskey}
					disabled={isConnecting || !passkeyConnector}
					className="text-accent hover:text-accent-hover underline press-down-inline cursor-pointer disabled:cursor-not-allowed"
				>
					Create one with Passkey
				</button>
			</p>
		</div>
	)
}

function WalletDashboard({ 
	address, 
	onSend,
	onShowQR,
}: { 
	address: string
	onSend: () => void
	onShowQR: () => void
}): React.JSX.Element {
	const { disconnect } = useDisconnect()
	const [copied, setCopied] = React.useState(false)
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

	const handleCopy = async () => {
		try {
			await navigator.clipboard.writeText(address)
			setCopied(true)
			setTimeout(() => setCopied(false), 2000)
		} catch {
			// Ignore copy error
		}
	}

	return (
		<div className="w-full max-w-md">
			<div className="bg-surface border border-card-border rounded-2xl p-6 mb-6">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-medium text-primary">Your Wallet</h2>
					<button
						onClick={() => disconnect()}
						className="flex items-center gap-2 px-3 py-1.5 text-sm text-secondary hover:text-primary transition-colors press-down cursor-pointer"
					>
						<LogOut className="size-4" />
						<span>Logout</span>
					</button>
				</div>

				<div className="space-y-4">
					<div>
						<div className="flex items-center justify-between mb-1">
							<p className="text-sm text-tertiary">Address</p>
							<div className="flex items-center gap-1">
								<button
									onClick={handleCopy}
									className="p-1.5 text-secondary hover:text-primary transition-colors press-down cursor-pointer rounded-lg hover:bg-base-plane"
									title="Copy address"
								>
									{copied ? <Check className="size-4 text-positive" /> : <Copy className="size-4" />}
								</button>
								<button
									onClick={onShowQR}
									className="p-1.5 text-secondary hover:text-primary transition-colors press-down cursor-pointer rounded-lg hover:bg-base-plane"
									title="Show QR Code"
								>
									<QrCode className="size-4" />
								</button>
							</div>
						</div>
						<p className="text-primary font-mono text-sm break-all">
							{address}
						</p>
					</div>

					<div>
						<p className="text-sm text-tertiary mb-1">Balance</p>
						<p className="text-2xl font-medium text-primary">
							{formattedBalance} {(symbol as string) || '…'}
						</p>
					</div>
				</div>
			</div>

			<div className="grid grid-cols-2 gap-3">
				<a
					href={`https://exp.pakxe.otterevm.com/address/${address}`}
					target="_blank"
					rel="noopener noreferrer"
					className={cx(
						'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
						'bg-surface border border-card-border',
						'text-primary text-sm font-medium',
						'hover:bg-base-plane transition-colors',
						'press-down',
					)}
				>
					<span>View on Explorer</span>
				</a>

				<button
					onClick={onSend}
					className={cx(
						'flex items-center justify-center gap-2 px-4 py-3 rounded-xl',
						'bg-accent border border-transparent',
						'text-white text-sm font-medium',
						'hover:bg-accent-hover transition-colors',
						'press-down cursor-pointer',
					)}
				>
					<span>Send</span>
				</button>
			</div>
		</div>
	)
}

function SendModal({ 
	address, 
	onClose 
}: { 
	address: string
	onClose: () => void
}): React.JSX.Element {
	const [recipient, setRecipient] = React.useState('')
	const [amount, setAmount] = React.useState('')
	const [error, setError] = React.useState('')
	const [isSuccess, setIsSuccess] = React.useState(false)
	const [showScanner, setShowScanner] = React.useState(false)
	
	const { data: decimals } = useReadContract({
		address: USD_TOKEN_ADDRESS,
		abi: erc20Abi,
		functionName: 'decimals',
	})

	const { writeContract, isPending, data: hash } = useWriteContract()

	const handleScan = (result: { rawValue: string }[]) => {
		if (result && result.length > 0) {
			let scanned = result[0].rawValue
			// Extract address if scanned value contains ethereum: prefix
			if (scanned.startsWith('ethereum:')) {
				scanned = scanned.replace('ethereum:', '').split('@')[0].split('?')[0]
			}
			// Validate and set address
			if (isAddress(scanned)) {
				setRecipient(scanned)
				setShowScanner(false)
			}
		}
	}

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
			const parsedAmount = parseUnits(amount, (decimals as number) ?? 6)
			
			writeContract({
				address: USD_TOKEN_ADDRESS,
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
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
			<div className="bg-surface border border-card-border rounded-2xl p-6 w-full max-w-md relative">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-medium text-primary">Send Tokens</h2>
					<button
						onClick={onClose}
						className="p-1 text-secondary hover:text-primary transition-colors press-down cursor-pointer"
					>
						<X className="size-5" />
					</button>
				</div>

				{isSuccess ? (
					<div className="text-center py-6">
						<div className="w-16 h-16 rounded-full bg-positive/20 flex items-center justify-center mx-auto mb-4">
							<ArrowRight className="size-8 text-positive" />
						</div>
						<h3 className="text-lg font-medium text-primary mb-2">Transaction Sent!</h3>
						{hash && (
							<p className="text-sm text-secondary mb-4">
								Hash:{' '}
								<a
									href={`https://exp.pakxe.otterevm.com/tx/${hash}`}
									target="_blank"
									rel="noopener noreferrer"
									className="text-accent hover:underline"
								>
									{hash.slice(0, 10)}...{hash.slice(-8)}
								</a>
							</p>
						)}
						<button
							onClick={onClose}
							className={cx(
								'px-6 py-2 rounded-xl bg-accent text-white font-medium',
								'hover:bg-accent-hover transition-colors press-down cursor-pointer',
							)}
						>
							Close
						</button>
					</div>
				) : (
					<div className="space-y-4">
						<div>
							<div className="flex items-center justify-between mb-1">
								<label className="text-sm text-tertiary">
									Recipient Address
								</label>
								<button
									onClick={() => setShowScanner(true)}
									className="flex items-center gap-1 text-xs text-accent hover:text-accent-hover transition-colors press-down cursor-pointer"
								>
									<Camera className="size-3" />
									<span>Scan QR</span>
								</button>
							</div>
							<input
								type="text"
								value={recipient}
								onChange={(e) => setRecipient(e.target.value)}
								placeholder="0x..."
								className={cx(
									'w-full px-4 py-3 rounded-xl bg-base-plane border border-card-border',
									'text-primary placeholder:text-tertiary',
									'focus:outline-none focus:border-accent',
								)}
							/>
						</div>

						<div>
							<label className="block text-sm text-tertiary mb-1">
								Amount
							</label>
							<input
								type="number"
								value={amount}
								onChange={(e) => setAmount(e.target.value)}
								placeholder="0.00"
								min="0"
								step="0.000001"
								className={cx(
									'w-full px-4 py-3 rounded-xl bg-base-plane border border-card-border',
									'text-primary placeholder:text-tertiary',
									'focus:outline-none focus:border-accent',
								)}
							/>
						</div>

						{error && (
							<p className="text-sm text-negative">{error}</p>
						)}

						<button
							onClick={handleSend}
							disabled={isPending}
							className={cx(
								'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
								'bg-accent text-white font-medium',
								'hover:bg-accent-hover transition-colors',
								'press-down cursor-pointer',
								isPending && 'opacity-70 cursor-wait',
							)}
						>
							{isPending ? 'Sending…' : 'Send'}
						</button>
					</div>
				)}

				{showScanner && (
					<div className="absolute inset-0 bg-surface rounded-2xl flex flex-col p-4">
						<div className="flex items-center justify-between mb-4">
							<h3 className="text-lg font-medium text-primary">Scan QR Code</h3>
							<button
								onClick={() => setShowScanner(false)}
								className="p-1 text-secondary hover:text-primary transition-colors press-down cursor-pointer"
							>
								<X className="size-5" />
							</button>
						</div>
						<div className="flex-1 min-h-[300px] rounded-xl overflow-hidden">
							<Scanner
								onScan={handleScan}
								allowMultiple={false}
								styles={{
									container: { width: '100%', height: '100%' },
									video: { width: '100%', height: '100%', objectFit: 'cover' },
								}}
							/>
						</div>
						<p className="text-sm text-tertiary text-center mt-4">
							Point camera at QR code to scan
						</p>
					</div>
				)}
			</div>
		</div>
	)
}

export default App
