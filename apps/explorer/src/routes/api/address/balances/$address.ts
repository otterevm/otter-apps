import { createFileRoute } from '@tanstack/react-router'
import type { Address } from 'ox'
import type { Config } from 'wagmi'
import { getChainId } from 'wagmi/actions'
import { Actions } from 'wagmi/tempo'
import { hasIndexSupply } from '#lib/env'
import {
	fetchAddressTransferBalances,
	fetchTokenCreatedMetadata,
} from '#lib/server/tempo-queries'
import { zAddress } from '#lib/zod'
import { getWagmiConfig } from '#wagmi.config'

const TIP20_DECIMALS = 6
const MAX_TOKENS = 50

// Native gas token address prefix for TIP20 tokens (0x20c0...)
// The full address is fetched dynamically from chain configuration
const NATIVE_TOKEN_PREFIX =
	'0x20c0000000000000000000000000000000000000' as Address.Address

export type TokenBalance = {
	token: Address.Address
	balance: string
	name?: string
	symbol?: string
	decimals?: number
	currency?: string
}

export type BalancesResponse = {
	balances: TokenBalance[]
	error?: string
}

// Get native gas token address for current chain
function getNativeTokenAddress(): Address.Address {
	// Different chains may have different native token addresses
	// For now, use the standard TIP20 prefix pattern
	// This could be extended to read from chain configuration
	return NATIVE_TOKEN_PREFIX
}

// Fetch token metadata from chain
async function fetchTokenMetadata(
	token: Address.Address,
): Promise<{ name: string; symbol: string; currency: string } | null> {
	const config = getWagmiConfig()

	try {
		const metadata = await Actions.token.getMetadata(config as Config, {
			token,
		})
		return {
			name: metadata.name ?? 'Unknown Token',
			symbol: metadata.symbol ?? '???',
			currency: '', // Will be determined from symbol or other logic
		}
	} catch (error) {
		console.warn(`Failed to fetch metadata for token ${token}:`, error)
		return null
	}
}

// Fallback: Get balance via RPC for chains without indexer
async function fetchBalancesViaRPC(
	address: Address.Address,
): Promise<TokenBalance[]> {
	const config = getWagmiConfig()
	const nativeToken = getNativeTokenAddress()

	// Get native gas token balance
	try {
		const balance = await Actions.token.getBalance(config as Config, {
			token: nativeToken,
			account: address,
		})

		if (balance > 0n) {
			// Fetch actual metadata from chain
			const metadata = await fetchTokenMetadata(nativeToken)

			return [
				{
					token: nativeToken,
					balance: balance.toString(),
					name: metadata?.name ?? 'Native Token',
					symbol: metadata?.symbol ?? 'NATIVE',
					decimals: TIP20_DECIMALS,
					currency: metadata?.symbol ?? '',
				},
			]
		}
	} catch (error) {
		console.warn('Failed to fetch native token balance:', error)
	}

	return []
}

export const Route = createFileRoute('/api/address/balances/$address')({
	server: {
		handlers: {
			GET: async ({ params }) => {
				// For chains without indexer (like ottertestnet), use RPC fallback
				if (!hasIndexSupply()) {
					try {
						const address = zAddress().parse(params.address)
						const balances = await fetchBalancesViaRPC(address)
						return Response.json({ balances } satisfies BalancesResponse)
					} catch (error) {
						console.error(error)
						return Response.json(
							{ balances: [], error: String(error) } satisfies BalancesResponse,
							{ status: 500 },
						)
					}
				}

				try {
					const address = zAddress().parse(params.address)
					const config = getWagmiConfig()
					const chainId = getChainId(config)

					const balancesResult = await fetchAddressTransferBalances(
						address,
						chainId,
					)

					// Calculate net balance per token
					const balances = new Map<string, bigint>()

					for (const row of balancesResult) {
						const token = String(row.token).toLowerCase()
						const received = BigInt(row.received ?? 0)
						const sent = BigInt(row.sent ?? 0)
						const balance = received - sent
						if (balance !== 0n) {
							balances.set(token, balance)
						}
					}

					const nonZeroBalances = [...balances.entries()]
						.filter(([_, balance]) => balance !== 0n)
						.map(([token, balance]) => ({
							token: token as Address.Address,
							balance,
						}))

					if (nonZeroBalances.length === 0) {
						return Response.json({ balances: [] } satisfies BalancesResponse)
					}

					// Take top tokens by absolute balance value first
					const topTokens = nonZeroBalances
						.sort((a, b) => {
							const aAbs = a.balance < 0n ? -a.balance : a.balance
							const bAbs = b.balance < 0n ? -b.balance : b.balance
							return bAbs > aAbs ? 1 : bAbs < aAbs ? -1 : 0
						})
						.slice(0, MAX_TOKENS)

					// Query TokenCreated only for tokens the user holds
					const topTokenAddresses = topTokens.map((t) => t.token)
					const tokenCreatedResult = await fetchTokenCreatedMetadata(
						chainId,
						topTokenAddresses,
					)

					const tokenMetadata = new Map<
						string,
						{ name: string; symbol: string; currency: string }
					>()
					for (const row of tokenCreatedResult) {
						tokenMetadata.set(String(row.token).toLowerCase(), {
							name: String(row.name),
							symbol: String(row.symbol),
							currency: String(row.currency),
						})
					}

					// Fetch metadata via RPC for tokens missing from TokenCreated
					const tokensMissingMetadata = topTokens
						.filter((t) => !tokenMetadata.has(t.token))
						.map((t) => t.token)

					if (tokensMissingMetadata.length > 0) {
						const rpcMetadataResults = await Promise.all(
							tokensMissingMetadata.map(async (token) => {
								try {
									const metadata = await Actions.token.getMetadata(
										config as Config,
										{ token },
									)
									return { token, metadata }
								} catch {
									return { token, metadata: null }
								}
							}),
						)

						for (const { token, metadata } of rpcMetadataResults) {
							if (metadata) {
								tokenMetadata.set(token.toLowerCase(), {
									name: metadata.name ?? '',
									symbol: metadata.symbol ?? '',
									currency: '',
								})
							}
						}
					}

					const tokenBalances: TokenBalance[] = topTokens
						.map((row) => {
							const metadata = tokenMetadata.get(row.token)
							return {
								token: row.token,
								balance: row.balance.toString(),
								name: metadata?.name,
								symbol: metadata?.symbol,
								currency: metadata?.currency,
								decimals: TIP20_DECIMALS,
							}
						})
						.sort((a, b) => {
							// Check if tokens are fee tokens based on symbol patterns
							const aIsFee = (a.symbol ?? '').toUpperCase().includes('USD')
							const bIsFee = (b.symbol ?? '').toUpperCase().includes('USD')

							if (aIsFee && bIsFee) {
								const aValue = Number(BigInt(a.balance)) / 10 ** TIP20_DECIMALS
								const bValue = Number(BigInt(b.balance)) / 10 ** TIP20_DECIMALS
								return bValue - aValue
							}

							if (aIsFee) return -1
							if (bIsFee) return 1

							return Number(BigInt(b.balance) - BigInt(a.balance))
						})

					return Response.json({
						balances: tokenBalances,
					} satisfies BalancesResponse)
				} catch (error) {
					console.error(error)
					const errorMessage = error instanceof Error ? error.message : error
					return Response.json(
						{
							balances: [],
							error: String(errorMessage),
						} satisfies BalancesResponse,
						{ status: 500 },
					)
				}
			},
		},
	},
})
