import { createFileRoute, Link } from '@tanstack/react-router'
import { useQueryClient } from '@tanstack/react-query'
import * as React from 'react'
import {
	useWriteContract,
	useWaitForTransactionReceipt,
	useConnection,
	useReadContract,
} from 'wagmi'
import { keccak256, toHex, encodePacked, parseUnits, formatUnits } from 'viem'
import { cx } from '#lib/css'
import CopyIcon from '~icons/lucide/copy'
import ExternalLinkIcon from '~icons/lucide/external-link'
import RocketIcon from '~icons/lucide/rocket'
import CheckCircleIcon from '~icons/lucide/check-circle'
import Loader2Icon from '~icons/lucide/loader-2'
import AlertCircleIcon from '~icons/lucide/alert-circle'
import CoinsIcon from '~icons/lucide/coins'
import DropletsIcon from '~icons/lucide/droplets'
import KeyIcon from '~icons/lucide/key'
import PlusIcon from '~icons/lucide/plus'
import SendIcon from '~icons/lucide/send'
import UserIcon from '~icons/lucide/user'
import { Address } from '#comps/Address'

// TIP20 Factory address (system contract)
const TIP20_FACTORY_ADDRESS = '0x20fc000000000000000000000000000000000000'

// Native token address (for quote token)
const NATIVE_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000000'

// Fee Manager address (for adding liquidity)
const FEE_MANAGER_ADDRESS = '0xfeec000000000000000000000000000000000000'

const tip20FactoryAbi = [
	{
		inputs: [
			{ internalType: 'string', name: 'name', type: 'string' },
			{ internalType: 'string', name: 'symbol', type: 'string' },
			{ internalType: 'string', name: 'currency', type: 'string' },
			{ internalType: 'address', name: 'quoteToken', type: 'address' },
			{ internalType: 'address', name: 'admin', type: 'address' },
			{ internalType: 'bytes32', name: 'salt', type: 'bytes32' },
		],
		name: 'createToken',
		outputs: [{ internalType: 'address', name: 'token', type: 'address' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		anonymous: false,
		inputs: [
			{
				indexed: true,
				internalType: 'address',
				name: 'token',
				type: 'address',
			},
			{
				indexed: true,
				internalType: 'address',
				name: 'deployer',
				type: 'address',
			},
			{ indexed: false, internalType: 'string', name: 'name', type: 'string' },
			{
				indexed: false,
				internalType: 'string',
				name: 'symbol',
				type: 'string',
			},
		],
		name: 'TokenCreated',
		type: 'event',
	},
] as const

const tip20TokenAbi = [
	{
		inputs: [
			{ internalType: 'bytes32', name: 'role', type: 'bytes32' },
			{ internalType: 'address', name: 'account', type: 'address' },
		],
		name: 'grantRole',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{ internalType: 'address', name: 'to', type: 'address' },
			{ internalType: 'uint256', name: 'amount', type: 'uint256' },
		],
		name: 'mint',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [
			{ internalType: 'address', name: 'recipient', type: 'address' },
			{ internalType: 'uint256', name: 'amount', type: 'uint256' },
		],
		name: 'transfer',
		outputs: [{ internalType: 'bool', name: '', type: 'bool' }],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ internalType: 'address', name: 'account', type: 'address' }],
		name: 'balanceOf',
		outputs: [{ internalType: 'uint256', name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decimals',
		outputs: [{ internalType: 'uint8', name: '', type: 'uint8' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'symbol',
		outputs: [{ internalType: 'string', name: '', type: 'string' }],
		stateMutability: 'view',
		type: 'function',
	},
] as const

const feeManagerAbi = [
	{
		inputs: [
			{ internalType: 'address', name: 'tokenA', type: 'address' },
			{ internalType: 'address', name: 'tokenB', type: 'address' },
			{ internalType: 'uint256', name: 'amount', type: 'uint256' },
			{ internalType: 'address', name: 'to', type: 'address' },
		],
		name: 'mint',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const

type Tab = 'deploy' | 'grant' | 'mint' | 'liquidity' | 'transfer'

type StepStatus = 'pending' | 'loading' | 'completed' | 'error'

type Step = {
	tab: Tab
	title: string
	status: StepStatus
	txHash?: `0x${string}`
	error?: string
}

export const Route = createFileRoute('/_layout/issue-token')({
	component: IssueTokenPage,
})

function IssueTokenPage(): React.JSX.Element {
	const { address } = useConnection()
	const queryClient = useQueryClient()
	const reactId = React.useId()
	const nameInputId = `tokenName-${reactId}`
	const symbolInputId = `tokenSymbol-${reactId}`
	const mintAmountId = `mintAmount-${reactId}`
	const liquidityAmountId = `liquidityAmount-${reactId}`
	const grantTokenInputId = `grantToken-${reactId}`
	const mintTokenInputId = `mintToken-${reactId}`
	const liquidityTokenInputId = `liquidityToken-${reactId}`
	const transferTokenInputId = `transferToken-${reactId}`
	const transferRecipientInputId = `transferRecipient-${reactId}`
	const transferAmountInputId = `transferAmount-${reactId}`

	const [activeTab, setActiveTab] = React.useState<Tab>('deploy')
	const [tokenName, setTokenName] = React.useState('')
	const [tokenSymbol, setTokenSymbol] = React.useState('')
	const [mintAmount, setMintAmount] = React.useState('1000000')
	const [liquidityAmount, setLiquidityAmount] = React.useState('1000')
	const [salt, setSalt] = React.useState<`0x${string}` | null>(null)

	// Deployed token address from deploy tab
	const [deployedTokenAddress, setDeployedTokenAddress] = React.useState<
		`0x${string}` | null
	>(null)

	// Token addresses for each tab (user can input manually)
	const [grantTokenAddress, setGrantTokenAddress] = React.useState('')
	const [mintTokenAddress, setMintTokenAddress] = React.useState('')
	const [liquidityTokenAddress, setLiquidityTokenAddress] = React.useState('')
	const [transferTokenAddress, setTransferTokenAddress] = React.useState('')
	const [transferRecipient, setTransferRecipient] = React.useState('')
	const [transferAmount, setTransferAmount] = React.useState('')

	const [steps, setSteps] = React.useState<Step[]>([
		{ tab: 'deploy', title: '1. Deploy Token', status: 'pending' },
		{ tab: 'grant', title: '2. Grant Role', status: 'pending' },
		{ tab: 'mint', title: '3. Mint', status: 'pending' },
		{ tab: 'liquidity', title: '4. Add Liquidity', status: 'pending' },
		{ tab: 'transfer', title: '5. Transfer', status: 'pending' },
	])

	// Generate salt on mount
	React.useEffect(() => {
		if (address && !salt) {
			const timestamp = Date.now().toString()
			const random = Math.random().toString(36).substring(2)
			const newSalt = keccak256(
				encodePacked(
					['string', 'string', 'address'],
					[timestamp, random, address],
				),
			)
			setSalt(newSalt)
		}
	}, [address, salt])

	const updateStep = React.useCallback(
		(tab: Tab, status: StepStatus, txHash?: `0x${string}`, error?: string) => {
			setSteps((prev) =>
				prev.map((step) =>
					step.tab === tab ? { ...step, status, txHash, error } : step,
				),
			)
		},
		[],
	)

	// Deploy
	const {
		writeContract: deployToken,
		data: deployHash,
		isPending: isDeployPending,
		error: deployError,
	} = useWriteContract()

	const {
		data: deployReceipt,
		isLoading: isWaitingDeploy,
		isSuccess: isDeploySuccess,
	} = useWaitForTransactionReceipt({ hash: deployHash })

	// Grant Role
	const {
		writeContract: grantRole,
		data: grantHash,
		isPending: isGrantPending,
		error: grantError,
	} = useWriteContract()

	const { isLoading: isWaitingGrant, isSuccess: isGrantSuccess } =
		useWaitForTransactionReceipt({ hash: grantHash })

	// Mint
	const {
		writeContract: mintTokens,
		data: mintHash,
		isPending: isMintPending,
		error: mintError,
	} = useWriteContract()

	const { isLoading: isWaitingMint, isSuccess: isMintSuccess } =
		useWaitForTransactionReceipt({ hash: mintHash })

	// Add Liquidity
	const {
		writeContract: addLiquidity,
		data: liquidityHash,
		isPending: isLiquidityPending,
		error: liquidityError,
	} = useWriteContract()

	const { isLoading: isWaitingLiquidity, isSuccess: isLiquiditySuccess } =
		useWaitForTransactionReceipt({ hash: liquidityHash })

	// Transfer
	const {
		writeContract: transferTokens,
		data: transferHash,
		isPending: isTransferPending,
		error: transferError,
	} = useWriteContract()

	const { isLoading: isWaitingTransfer, isSuccess: isTransferSuccess } =
		useWaitForTransactionReceipt({ hash: transferHash })

	// Fetch token balance and info for transfer tab
	const { data: tokenBalance } = useReadContract({
		address: transferTokenAddress as `0x${string}`,
		abi: tip20TokenAbi,
		functionName: 'balanceOf',
		args: address ? [address] : undefined,
		query: {
			enabled: !!transferTokenAddress && !!address,
		},
	})

	const { data: tokenDecimals } = useReadContract({
		address: transferTokenAddress as `0x${string}`,
		abi: tip20TokenAbi,
		functionName: 'decimals',
		query: {
			enabled: !!transferTokenAddress,
		},
	})

	const { data: tokenSymbolData } = useReadContract({
		address: transferTokenAddress as `0x${string}`,
		abi: tip20TokenAbi,
		functionName: 'symbol',
		query: {
			enabled: !!transferTokenAddress,
		},
	})

	// Parse token address from deploy receipt
	React.useEffect(() => {
		if (isDeploySuccess && deployReceipt && deployHash) {
			const tokenCreatedTopic = keccak256(
				toHex('TokenCreated(address,address,string,string)'),
			)
			const eventLog = deployReceipt.logs.find((log) => {
				return log.topics[0]?.toLowerCase() === tokenCreatedTopic.toLowerCase()
			})

			if (eventLog?.topics[1]) {
				const tokenAddress =
					`0x${eventLog.topics[1].slice(26)}` as `0x${string}`
				setDeployedTokenAddress(tokenAddress)
				// Auto-fill other tabs with deployed address
				setGrantTokenAddress(tokenAddress)
				setMintTokenAddress(tokenAddress)
				setLiquidityTokenAddress(tokenAddress)
				setTransferTokenAddress(tokenAddress)
			}

			updateStep('deploy', 'completed', deployHash)
		}
	}, [isDeploySuccess, deployReceipt, deployHash, updateStep])

	React.useEffect(() => {
		if (deployError) {
			updateStep('deploy', 'error', undefined, deployError.message)
		}
	}, [deployError, updateStep])

	React.useEffect(() => {
		if (isGrantSuccess && grantHash) {
			updateStep('grant', 'completed', grantHash)
		}
	}, [isGrantSuccess, grantHash, updateStep])

	React.useEffect(() => {
		if (grantError) {
			updateStep('grant', 'error', undefined, grantError.message)
		}
	}, [grantError, updateStep])

	React.useEffect(() => {
		if (isMintSuccess && mintHash) {
			updateStep('mint', 'completed', mintHash)
			// Invalidate balance cache
			void queryClient.invalidateQueries({
				queryKey: ['header-wallet-balance'],
			})
		}
	}, [isMintSuccess, mintHash, queryClient, updateStep])

	React.useEffect(() => {
		if (mintError) {
			updateStep('mint', 'error', undefined, mintError.message)
		}
	}, [mintError, updateStep])

	React.useEffect(() => {
		if (isLiquiditySuccess && liquidityHash) {
			updateStep('liquidity', 'completed', liquidityHash)
		}
	}, [isLiquiditySuccess, liquidityHash, updateStep])

	React.useEffect(() => {
		if (liquidityError) {
			updateStep('liquidity', 'error', undefined, liquidityError.message)
		}
	}, [liquidityError, updateStep])

	React.useEffect(() => {
		if (isTransferSuccess && transferHash) {
			updateStep('transfer', 'completed', transferHash)
		}
	}, [isTransferSuccess, transferHash, updateStep])

	React.useEffect(() => {
		if (transferError) {
			updateStep('transfer', 'error', undefined, transferError.message)
		}
	}, [transferError, updateStep])

	const handleDeploy = () => {
		if (!tokenName || !tokenSymbol || !salt || !address) return
		updateStep('deploy', 'loading')
		deployToken({
			address: TIP20_FACTORY_ADDRESS,
			abi: tip20FactoryAbi,
			functionName: 'createToken',
			args: [
				tokenName,
				tokenSymbol,
				'FEE',
				NATIVE_TOKEN_ADDRESS,
				address,
				salt,
			],
		})
	}

	const handleGrantRole = () => {
		if (!grantTokenAddress || !address) return
		updateStep('grant', 'loading')
		const issuerRole = keccak256(toHex('ISSUER_ROLE'))
		grantRole({
			address: grantTokenAddress as `0x${string}`,
			abi: tip20TokenAbi,
			functionName: 'grantRole',
			args: [issuerRole, address],
		})
	}

	const handleMint = () => {
		if (!mintTokenAddress || !address) return
		updateStep('mint', 'loading')
		const mintAmountWei = parseUnits(mintAmount, 6)
		mintTokens({
			address: mintTokenAddress as `0x${string}`,
			abi: tip20TokenAbi,
			functionName: 'mint',
			args: [address, mintAmountWei],
		})
	}

	const handleAddLiquidity = () => {
		if (!liquidityTokenAddress || !address) return
		updateStep('liquidity', 'loading')
		const liquidityWei = parseUnits(liquidityAmount, 6)
		addLiquidity({
			address: FEE_MANAGER_ADDRESS,
			abi: feeManagerAbi,
			functionName: 'mint',
			args: [
				liquidityTokenAddress as `0x${string}`,
				NATIVE_TOKEN_ADDRESS,
				liquidityWei,
				address,
			],
		})
	}

	const handleTransfer = () => {
		if (
			!transferTokenAddress ||
			!transferRecipient ||
			!transferAmount ||
			!address
		)
			return
		updateStep('transfer', 'loading')
		const amountWei = parseUnits(transferAmount, tokenDecimals ?? 6)
		transferTokens({
			address: transferTokenAddress as `0x${string}`,
			abi: tip20TokenAbi,
			functionName: 'transfer',
			args: [transferRecipient as `0x${string}`, amountWei],
		})
	}

	const getStepStatus = (tab: Tab) => steps.find((s) => s.tab === tab)?.status

	const tabs = [
		{ id: 'deploy' as Tab, label: 'Deploy', icon: RocketIcon },
		{ id: 'grant' as Tab, label: 'Grant Role', icon: KeyIcon },
		{ id: 'mint' as Tab, label: 'Mint', icon: CoinsIcon },
		{ id: 'liquidity' as Tab, label: 'Liquidity', icon: DropletsIcon },
		{ id: 'transfer' as Tab, label: 'Transfer', icon: SendIcon },
	]

	const formattedBalance = React.useMemo(() => {
		if (!tokenBalance || tokenDecimals === undefined) return null
		return formatUnits(tokenBalance, tokenDecimals)
	}, [tokenBalance, tokenDecimals])

	if (!address) {
		return (
			<div className="flex flex-1 flex-col items-center justify-center p-8">
				<div className="text-center">
					<CoinsIcon className="size-16 text-tertiary mx-auto mb-4" />
					<h1 className="text-2xl font-semibold text-primary mb-2">
						Connect Wallet
					</h1>
					<p className="text-secondary mb-6">
						Please connect your wallet to issue a new token.
					</p>
				</div>
			</div>
		)
	}

	return (
		<div className="flex flex-1 flex-col items-center p-6 pt-10">
			<div className="w-full max-w-xl">
				{/* Header */}
				<div className="text-center mb-6">
					<div className="inline-flex items-center justify-center size-12 bg-accent/10 rounded-full mb-4">
						<CoinsIcon className="size-6 text-accent" />
					</div>
					<h1 className="text-2xl font-semibold text-primary mb-2">
						Issue New Token
					</h1>
					<p className="text-secondary text-sm">
						Create your own TIP20 token on the Otter network
					</p>
				</div>

				{/* Deployed Token Address Banner */}
				{deployedTokenAddress && (
					<div className="bg-green-500/10 border border-green-500/20 rounded-xl p-4 mb-6">
						<div className="flex items-center justify-between">
							<div>
								<p className="text-xs text-green-600 font-medium mb-0.5">
									Last Deployed Token
								</p>
								<code className="text-sm font-mono text-green-700">
									<Address address={deployedTokenAddress} />
								</code>
							</div>
							<div className="flex items-center gap-2">
								<button
									type="button"
									onClick={() =>
										navigator.clipboard.writeText(deployedTokenAddress)
									}
									className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
									title="Copy address"
								>
									<CopyIcon className="size-4 text-green-600" />
								</button>
								<Link
									to="/token/$address"
									params={{ address: deployedTokenAddress }}
									className="p-2 hover:bg-green-500/20 rounded-lg transition-colors"
									title="View on Explorer"
								>
									<ExternalLinkIcon className="size-4 text-green-600" />
								</Link>
							</div>
						</div>
					</div>
				)}

				{/* Tabs - All enabled */}
				<div className="flex items-center gap-1 mb-6 bg-card-header p-1 rounded-xl border border-card-border">
					{tabs.map((tab) => {
						const status = getStepStatus(tab.id)
						const Icon = tab.icon
						const isActive = activeTab === tab.id

						return (
							<button
								key={tab.id}
								type="button"
								onClick={() => setActiveTab(tab.id)}
								className={cx(
									'flex-1 flex items-center justify-center gap-1.5 py-2 px-2 rounded-lg text-sm font-medium transition-colors',
									isActive
										? 'bg-base-alt text-primary'
										: 'text-tertiary hover:text-secondary',
								)}
							>
								<Icon className="size-4" />
								<span className="hidden sm:inline">{tab.label}</span>
								{status === 'completed' && (
									<CheckCircleIcon className="size-3.5 text-green-500" />
								)}
							</button>
						)
					})}
				</div>

				{/* Tab Content */}
				<div className="bg-card-header rounded-xl border border-card-border p-5">
					{/* Deploy Tab */}
					{activeTab === 'deploy' && (
						<div className="space-y-4">
							<h3 className="font-medium text-primary flex items-center gap-2">
								<RocketIcon className="size-4 text-accent" />
								Deploy Token
							</h3>
							<p className="text-sm text-secondary">
								Create your TIP20 token contract on the blockchain.
							</p>

							<div>
								<label
									htmlFor={nameInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Name
								</label>
								<input
									id={nameInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
									placeholder="e.g., MyToken"
									value={tokenName}
									onChange={(e) => setTokenName(e.target.value)}
									disabled={getStepStatus('deploy') === 'completed'}
								/>
							</div>

							<div>
								<label
									htmlFor={symbolInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Symbol
								</label>
								<input
									id={symbolInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
									placeholder="e.g., MTK"
									value={tokenSymbol}
									onChange={(e) => setTokenSymbol(e.target.value.toUpperCase())}
									maxLength={6}
									disabled={getStepStatus('deploy') === 'completed'}
								/>
							</div>

							{getStepStatus('deploy') !== 'completed' ? (
								<button
									type="button"
									onClick={handleDeploy}
									disabled={!tokenName || !tokenSymbol || isDeployPending}
									className={cx(
										'w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
										!tokenName || !tokenSymbol || isDeployPending
											? 'bg-tertiary/20 text-tertiary cursor-not-allowed'
											: 'bg-accent text-white hover:bg-accent/90 press-down',
									)}
								>
									{isDeployPending || isWaitingDeploy ? (
										<>
											<Loader2Icon className="size-4 animate-spin" />
											{isDeployPending
												? 'Confirm in Wallet...'
												: 'Deploying...'}
										</>
									) : (
										<>
											<RocketIcon className="size-4" /> Deploy Token
										</>
									)}
								</button>
							) : (
								<div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
									<CheckCircleIcon className="size-5" />
									<span className="font-medium">Token Deployed!</span>
								</div>
							)}

							{deployHash && (
								<Link
									to="/receipt/$hash"
									params={{ hash: deployHash }}
									className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
								>
									View Transaction
									<ExternalLinkIcon className="size-3" />
								</Link>
							)}
						</div>
					)}

					{/* Grant Role Tab */}
					{activeTab === 'grant' && (
						<div className="space-y-4">
							<h3 className="font-medium text-primary flex items-center gap-2">
								<KeyIcon className="size-4 text-accent" />
								Grant Issuer Role
							</h3>
							<p className="text-sm text-secondary">
								Grant yourself the ISSUER_ROLE to mint tokens.
							</p>

							<div>
								<label
									htmlFor={grantTokenInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Address
								</label>
								<input
									id={grantTokenInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
									placeholder="0x..."
									value={grantTokenAddress}
									onChange={(e) => setGrantTokenAddress(e.target.value)}
								/>
							</div>

							{getStepStatus('grant') === 'completed' ? (
								<div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
									<CheckCircleIcon className="size-5" />
									<span className="font-medium">Role Granted!</span>
								</div>
							) : getStepStatus('grant') === 'error' ? (
								<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600">
									<AlertCircleIcon className="size-5" />
									<span className="font-medium">Error</span>
								</div>
							) : getStepStatus('grant') === 'loading' ||
								isGrantPending ||
								isWaitingGrant ? (
								<div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent">
									<Loader2Icon className="size-5 animate-spin" />
									<span className="font-medium">
										{isGrantPending ? 'Confirm in Wallet...' : 'Processing...'}
									</span>
								</div>
							) : (
								<button
									type="button"
									onClick={handleGrantRole}
									disabled={!grantTokenAddress}
									className={cx(
										'w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
										!grantTokenAddress
											? 'bg-tertiary/20 text-tertiary cursor-not-allowed'
											: 'bg-accent text-white hover:bg-accent/90 press-down',
									)}
								>
									<KeyIcon className="size-4" /> Grant Role
								</button>
							)}

							{grantHash && (
								<Link
									to="/receipt/$hash"
									params={{ hash: grantHash }}
									className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
								>
									View Transaction
									<ExternalLinkIcon className="size-3" />
								</Link>
							)}
						</div>
					)}

					{/* Mint Tab */}
					{activeTab === 'mint' && (
						<div className="space-y-4">
							<h3 className="font-medium text-primary flex items-center gap-2">
								<CoinsIcon className="size-4 text-accent" />
								Mint Tokens
							</h3>
							<p className="text-sm text-secondary">
								Mint token supply to your wallet.
							</p>

							<div>
								<label
									htmlFor={mintTokenInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Address
								</label>
								<input
									id={mintTokenInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
									placeholder="0x..."
									value={mintTokenAddress}
									onChange={(e) => setMintTokenAddress(e.target.value)}
								/>
							</div>

							<div>
								<label
									htmlFor={mintAmountId}
									className="block text-sm font-medium text-secondary mb-1.5 flex items-center gap-1.5"
								>
									<PlusIcon className="size-3.5" />
									Amount to Mint
								</label>
								<input
									id={mintAmountId}
									type="number"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
									placeholder="1000000"
									value={mintAmount}
									onChange={(e) => setMintAmount(e.target.value)}
								/>
							</div>

							{getStepStatus('mint') === 'completed' ? (
								<div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
									<CheckCircleIcon className="size-5" />
									<span className="font-medium">Tokens Minted!</span>
								</div>
							) : getStepStatus('mint') === 'error' ? (
								<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600">
									<AlertCircleIcon className="size-5" />
									<span className="font-medium">Error</span>
								</div>
							) : getStepStatus('mint') === 'loading' ||
								isMintPending ||
								isWaitingMint ? (
								<div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent">
									<Loader2Icon className="size-5 animate-spin" />
									<span className="font-medium">
										{isMintPending ? 'Confirm in Wallet...' : 'Processing...'}
									</span>
								</div>
							) : (
								<button
									type="button"
									onClick={handleMint}
									disabled={!mintTokenAddress || !mintAmount}
									className={cx(
										'w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
										!mintTokenAddress || !mintAmount
											? 'bg-tertiary/20 text-tertiary cursor-not-allowed'
											: 'bg-accent text-white hover:bg-accent/90 press-down',
									)}
								>
									<CoinsIcon className="size-4" /> Mint Tokens
								</button>
							)}

							{mintHash && (
								<Link
									to="/receipt/$hash"
									params={{ hash: mintHash }}
									className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
								>
									View Transaction
									<ExternalLinkIcon className="size-3" />
								</Link>
							)}
						</div>
					)}

					{/* Liquidity Tab */}
					{activeTab === 'liquidity' && (
						<div className="space-y-4">
							<h3 className="font-medium text-primary flex items-center gap-2">
								<DropletsIcon className="size-4 text-accent" />
								Add Liquidity
							</h3>
							<p className="text-sm text-secondary">
								Add liquidity to FeeAMM to enable trading.
							</p>

							<div>
								<label
									htmlFor={liquidityTokenInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Address
								</label>
								<input
									id={liquidityTokenInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
									placeholder="0x..."
									value={liquidityTokenAddress}
									onChange={(e) => setLiquidityTokenAddress(e.target.value)}
								/>
							</div>

							<div>
								<label
									htmlFor={liquidityAmountId}
									className="block text-sm font-medium text-secondary mb-1.5 flex items-center gap-1.5"
								>
									<DropletsIcon className="size-3.5" />
									Liquidity Amount
								</label>
								<input
									id={liquidityAmountId}
									type="number"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
									placeholder="1000"
									value={liquidityAmount}
									onChange={(e) => setLiquidityAmount(e.target.value)}
								/>
							</div>

							{getStepStatus('liquidity') === 'completed' ? (
								<div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
									<CheckCircleIcon className="size-5" />
									<span className="font-medium">Liquidity Added!</span>
								</div>
							) : getStepStatus('liquidity') === 'error' ? (
								<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600">
									<AlertCircleIcon className="size-5" />
									<span className="font-medium">Error</span>
								</div>
							) : getStepStatus('liquidity') === 'loading' ||
								isLiquidityPending ||
								isWaitingLiquidity ? (
								<div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent">
									<Loader2Icon className="size-5 animate-spin" />
									<span className="font-medium">
										{isLiquidityPending
											? 'Confirm in Wallet...'
											: 'Processing...'}
									</span>
								</div>
							) : (
								<button
									type="button"
									onClick={handleAddLiquidity}
									disabled={!liquidityTokenAddress || !liquidityAmount}
									className={cx(
										'w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
										!liquidityTokenAddress || !liquidityAmount
											? 'bg-tertiary/20 text-tertiary cursor-not-allowed'
											: 'bg-accent text-white hover:bg-accent/90 press-down',
									)}
								>
									<DropletsIcon className="size-4" /> Add Liquidity
								</button>
							)}

							{liquidityHash && (
								<Link
									to="/receipt/$hash"
									params={{ hash: liquidityHash }}
									className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
								>
									View Transaction
									<ExternalLinkIcon className="size-3" />
								</Link>
							)}
						</div>
					)}

					{/* Transfer Tab */}
					{activeTab === 'transfer' && (
						<div className="space-y-4">
							<h3 className="font-medium text-primary flex items-center gap-2">
								<SendIcon className="size-4 text-accent" />
								Transfer Tokens
							</h3>
							<p className="text-sm text-secondary">
								Transfer tokens to another address.
							</p>

							<div>
								<label
									htmlFor={transferTokenInputId}
									className="block text-sm font-medium text-secondary mb-1.5"
								>
									Token Address
								</label>
								<input
									id={transferTokenInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
									placeholder="0x..."
									value={transferTokenAddress}
									onChange={(e) => setTransferTokenAddress(e.target.value)}
								/>
								{formattedBalance !== null && (
									<div className="mt-1.5 flex items-center gap-1.5 text-sm">
										<span className="text-tertiary">Your Balance:</span>
										<span className="text-primary font-medium">
											{Number(formattedBalance).toLocaleString(undefined, {
												maximumFractionDigits: 6,
											})}{' '}
											{tokenSymbolData || 'tokens'}
										</span>
									</div>
								)}
							</div>

							<div>
								<label
									htmlFor={transferRecipientInputId}
									className="block text-sm font-medium text-secondary mb-1.5 flex items-center gap-1.5"
								>
									<UserIcon className="size-3.5" />
									Recipient Address
								</label>
								<input
									id={transferRecipientInputId}
									type="text"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors font-mono text-sm"
									placeholder="0x..."
									value={transferRecipient}
									onChange={(e) => setTransferRecipient(e.target.value)}
								/>
							</div>

							<div>
								<label
									htmlFor={transferAmountInputId}
									className="block text-sm font-medium text-secondary mb-1.5 flex items-center gap-1.5"
								>
									<CoinsIcon className="size-3.5" />
									Amount
								</label>
								<input
									id={transferAmountInputId}
									type="number"
									className="w-full px-3 py-2 bg-base-alt border border-card-border rounded-lg text-primary placeholder:text-tertiary focus:outline-none focus:border-accent transition-colors"
									placeholder="0"
									value={transferAmount}
									onChange={(e) => setTransferAmount(e.target.value)}
								/>
							</div>

							{getStepStatus('transfer') === 'completed' ? (
								<div className="flex items-center gap-2 p-3 bg-green-500/10 border border-green-500/20 rounded-lg text-green-600">
									<CheckCircleIcon className="size-5" />
									<span className="font-medium">Transfer Complete!</span>
								</div>
							) : getStepStatus('transfer') === 'error' ? (
								<div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-600">
									<AlertCircleIcon className="size-5" />
									<span className="font-medium">Error</span>
								</div>
							) : getStepStatus('transfer') === 'loading' ||
								isTransferPending ||
								isWaitingTransfer ? (
								<div className="flex items-center gap-2 p-3 bg-accent/10 border border-accent/20 rounded-lg text-accent">
									<Loader2Icon className="size-5 animate-spin" />
									<span className="font-medium">
										{isTransferPending
											? 'Confirm in Wallet...'
											: 'Processing...'}
									</span>
								</div>
							) : (
								<button
									type="button"
									onClick={handleTransfer}
									disabled={
										!transferTokenAddress ||
										!transferRecipient ||
										!transferAmount
									}
									className={cx(
										'w-full py-2.5 flex items-center justify-center gap-2 rounded-lg font-medium transition-colors',
										!transferTokenAddress ||
											!transferRecipient ||
											!transferAmount
											? 'bg-tertiary/20 text-tertiary cursor-not-allowed'
											: 'bg-accent text-white hover:bg-accent/90 press-down',
									)}
								>
									<SendIcon className="size-4" /> Transfer
								</button>
							)}

							{transferHash && (
								<Link
									to="/receipt/$hash"
									params={{ hash: transferHash }}
									className="text-sm text-accent hover:underline flex items-center justify-center gap-1"
								>
									View Transaction
									<ExternalLinkIcon className="size-3" />
								</Link>
							)}
						</div>
					)}
				</div>
			</div>
		</div>
	)
}
