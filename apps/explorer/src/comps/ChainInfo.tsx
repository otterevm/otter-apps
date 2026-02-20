import * as React from 'react'
import { getChainDisplayName, getWalletChainConfig } from '#lib/chains'
import { cx } from '#lib/css'
import WalletIcon from '~icons/lucide/wallet'

export function ChainInfo(props: ChainInfo.Props): React.JSX.Element {
	const { className } = props
	const [isAdding, setIsAdding] = React.useState(false)
	const [showSuccess, setShowSuccess] = React.useState(false)

	const chainName = getChainDisplayName()
	const chainConfig = getWalletChainConfig()

	const handleAddToWallet = async () => {
		if (typeof window === 'undefined' || !window.ethereum) {
			window.open('https://metamask.io/download/', '_blank')
			return
		}

		setIsAdding(true)
		try {
			await window.ethereum.request({
				method: 'wallet_addEthereumChain',
				params: [chainConfig],
			})
			setShowSuccess(true)
			setTimeout(() => setShowSuccess(false), 3000)
		} catch (error) {
			console.error('Failed to add chain to wallet:', error)
		} finally {
			setIsAdding(false)
		}
	}

	return (
		<div
			className={cx(
				'flex flex-col items-center gap-3 p-4 rounded-xl border border-base-border bg-surface/50 backdrop-blur-sm',
				className,
			)}
		>
			<div className="flex items-center gap-2 text-base-content-secondary">
				<div className="size-2 rounded-full bg-green-500 animate-pulse" />
				<span className="text-sm font-medium">{chainName} Blockchain</span>
			</div>

			<button
				type="button"
				onClick={handleAddToWallet}
				disabled={isAdding}
				className={cx(
					'flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm',
					'bg-accent text-white hover:bg-accent/90 active:scale-[0.98]',
					'disabled:opacity-50 disabled:cursor-not-allowed',
					'transition-all duration-200',
					showSuccess && 'bg-green-500 hover:bg-green-500',
				)}
			>
				<WalletIcon className="size-4" />
				{isAdding ? (
					<span>Adding...</span>
				) : showSuccess ? (
					<span>Added!</span>
				) : (
					<span>Add to Wallet</span>
				)}
			</button>

			<div className="flex items-center gap-4 text-xs text-base-content-secondary">
				<div className="flex items-center gap-1.5">
					<span className="text-base-content-tertiary">Chain ID:</span>
					<code className="px-1.5 py-0.5 rounded bg-base-plane font-mono">
						{parseInt(chainConfig.chainId, 16)}
					</code>
				</div>
				<div className="flex items-center gap-1.5">
					<span className="text-base-content-tertiary">Currency:</span>
					<span className="font-medium">
						{chainConfig.nativeCurrency.symbol}
					</span>
				</div>
			</div>
		</div>
	)
}

export declare namespace ChainInfo {
	type Props = {
		className?: string
	}
}

// Type declaration for window.ethereum
declare global {
	interface Window {
		ethereum?: {
			request: (args: {
				method: string
				params?: unknown[]
			}) => Promise<unknown>
		}
	}
}
