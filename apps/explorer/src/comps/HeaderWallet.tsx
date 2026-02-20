import { useQuery } from '@tanstack/react-query'
import { ClientOnly } from '@tanstack/react-router'
import * as React from 'react'
import { formatUnits } from 'viem'
import { useConnect, useConnection, useConnectors, useDisconnect } from 'wagmi'
import { Address } from '#comps/Address'
import { cx } from '#lib/css'
import { getApiUrl } from '#lib/env.ts'
import { filterSupportedInjectedConnectors } from '#lib/wallets.ts'
import LucideLogOut from '~icons/lucide/log-out'
import LucideWalletCards from '~icons/lucide/wallet-cards'
import LucideFingerprint from '~icons/lucide/fingerprint'
import LucideWallet from '~icons/lucide/wallet'

// Token address for displaying balance (0x20C0000000000000000000000000000000000000 - GenesisToken)
const GENESIS_TOKEN_ADDRESS = '0x20c0000000000000000000000000000000000000'

export function HeaderWallet(): React.JSX.Element {
	return (
		<ClientOnly
			fallback={
				<div className="flex items-center gap-2 px-3 py-1.5 bg-base-alt/50 rounded-lg border border-card-border">
					<LucideWallet className="size-4 text-tertiary" />
					<span className="text-sm text-tertiary">Loading...</span>
				</div>
			}
		>
			<HeaderWalletInner />
		</ClientOnly>
	)
}

function HeaderWalletInner(): React.JSX.Element {
	const connect = useConnect()
	const connectors = useConnectors()
	const { address, connector } = useConnection()
	const disconnect = useDisconnect()

	const [pendingId, setPendingId] = React.useState<string | null>(null)
	const [isExpanded, setIsExpanded] = React.useState(false)

	const injectedConnectors = React.useMemo(
		() => filterSupportedInjectedConnectors(connectors),
		[connectors],
	)
	const passkeyConnector = React.useMemo(
		() => connectors.find((c) => c.id === 'webAuthn'),
		[connectors],
	)

	// Fetch balance for GenesisToken
	const { data: balanceData } = useQuery({
		queryKey: ['header-wallet-balance', address],
		queryFn: async () => {
			const response = await fetch(
				getApiUrl(`/api/address/balances/${address}`),
				{ headers: { 'Content-Type': 'application/json' } },
			)
			return response.json() as Promise<{
				balances: Array<{
					token: string
					balance: string
					decimals?: number
					symbol?: string
				}>
			}>
		},
		enabled: !!address,
		staleTime: 30_000,
	})

	const genesisBalance = React.useMemo(() => {
		if (!balanceData?.balances) return null
		const token = balanceData.balances.find(
			(b) => b.token.toLowerCase() === GENESIS_TOKEN_ADDRESS.toLowerCase(),
		)
		if (!token) return null
		return {
			balance: Number(formatUnits(BigInt(token.balance), token.decimals ?? 6)),
			symbol: token.symbol ?? 'GENESIS',
		}
	}, [balanceData])

	const hasConnectorOptions = injectedConnectors.length > 0 || passkeyConnector

	// Not connected state - show connect buttons
	if (!address) {
		if (!hasConnectorOptions) {
			return (
				<div className="flex items-center gap-2 px-3 py-1.5 bg-base-alt/50 rounded-lg border border-card-border">
					<LucideWallet className="size-4 text-tertiary" />
					<span className="text-sm text-tertiary">No wallet</span>
				</div>
			)
		}

		return (
			<div className="flex items-center gap-1.5">
				{passkeyConnector && (
					<button
						type="button"
						onClick={() => {
							setPendingId('webAuthn')
							connect.mutate(
								{
									connector: passkeyConnector,
								} as Parameters<typeof connect.mutate>[0],
								{
									onSettled: () => setPendingId(null),
								},
							)
						}}
						className={cx(
							'flex gap-1.5 items-center text-xs bg-base-alt rounded-lg text-primary py-1.5 px-2.5 cursor-pointer press-down border border-card-border transition-colors hover:bg-base-alt/80',
							pendingId === 'webAuthn' && connect.isPending && 'animate-pulse',
						)}
						title="Connect with Passkey"
					>
						<LucideFingerprint className="size-3.5" />
						<span className="hidden sm:inline">Passkey</span>
					</button>
				)}
				{injectedConnectors.map((c) => (
					<button
						type="button"
						key={c.id}
						onClick={() => {
							setPendingId(c.id)
							connect.mutate(
								{ connector: c },
								{
									onSettled: () => setPendingId(null),
								},
							)
						}}
						className={cx(
							'flex gap-1.5 items-center text-xs bg-base-alt rounded-lg text-primary py-1.5 px-2.5 cursor-pointer press-down border border-card-border transition-colors hover:bg-base-alt/80',
							pendingId === c.id && connect.isPending && 'animate-pulse',
						)}
						title={`Connect with ${c.name}`}
					>
						{c.icon ? (
							<img className="size-3.5" src={c.icon} alt={c.name} />
						) : (
							<LucideWalletCards className="size-3.5" />
						)}
						<span className="hidden sm:inline">{c.name}</span>
					</button>
				))}
			</div>
		)
	}

	// Connected state - show address and balance
	return (
		<div className="relative">
			<button
				type="button"
				onClick={() => setIsExpanded(!isExpanded)}
				className={cx(
					'flex items-center gap-1.5 px-2 py-1 bg-base-alt rounded-lg border border-card-border transition-colors hover:bg-base-alt/80 press-down',
					isExpanded && 'bg-base-alt/80',
				)}
			>
				<LucideWallet className="size-3.5 text-accent" />
				<div className="flex items-center gap-1.5">
					<Address address={address} align="end" className="text-[11px]" />
					{genesisBalance && (
						<span className="text-[10px] text-tertiary hidden lg:inline">
							{genesisBalance.balance.toLocaleString(undefined, {
								maximumFractionDigits: 2,
							})}{' '}
							{genesisBalance.symbol}
						</span>
					)}
				</div>
			</button>

			{/* Dropdown menu */}
			{isExpanded && (
				<>
					{/* Backdrop to close on outside click */}
					<button
						type="button"
						className="fixed inset-0 z-40"
						onClick={() => setIsExpanded(false)}
						tabIndex={-1}
						aria-hidden="true"
					>
						<span className="sr-only">Close menu</span>
					</button>

					<div className="absolute right-0 top-full mt-2 z-50 min-w-[200px] bg-card-header rounded-lg border border-card-border shadow-lg p-3">
						<div className="flex flex-col gap-3">
							{/* Balance display */}
							{genesisBalance && (
								<div className="flex items-center justify-between text-xs">
									<span className="text-tertiary">Balance:</span>
									<span className="font-medium text-primary tabular-nums">
										{genesisBalance.balance.toLocaleString(undefined, {
											maximumFractionDigits: 6,
										})}{' '}
										{genesisBalance.symbol}
									</span>
								</div>
							)}

							{/* Divider */}
							<div className="border-t border-card-border" />

							{/* Disconnect button */}
							<button
								type="button"
								onClick={() => {
									disconnect.mutate({ connector })
									setIsExpanded(false)
								}}
								className="flex items-center justify-center gap-2 w-full px-3 py-2 text-sm text-secondary hover:text-primary bg-base-alt/50 hover:bg-base-alt rounded-lg transition-colors press-down"
							>
								<LucideLogOut className="size-4" />
								Disconnect
							</button>
						</div>
					</div>
				</>
			)}
		</div>
	)
}
