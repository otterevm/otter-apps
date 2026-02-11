import { Hono } from 'hono'
import * as z from 'zod/mini'
import { Abis } from 'viem/tempo'
import type { Address, Hex } from 'ox'
import { readContracts } from 'wagmi/actions'
import { zValidator } from '@hono/zod-validator'

import { wagmiConfig } from '#wagmi.config.ts'
import { idxClient } from '#utilities/indexer.ts'

const { queryBuilder } = idxClient()

const TRANSFER_SIGNATURE =
	'event Transfer(address indexed from, address indexed to, uint256 value)'

function validationError(
	result: { success: boolean; error?: unknown },
	context: { json: (data: unknown, status: number) => Response },
) {
	if (!result.success)
		return context.json(
			{
				message: 'Invalid parameters',
				error:
					result.error &&
					typeof result.error === 'object' &&
					'issues' in result.error
						? result.error
						: String(result.error),
			},
			400,
		)
}

function parseFungibleId(id: string): {
	chainId: number
	address: Hex.Hex
} | null {
	const dotIndex = id.indexOf('.')
	if (dotIndex === -1) return null
	const chainId = Number(id.slice(0, dotIndex))
	const address = id.slice(dotIndex + 1) as Hex.Hex
	if (Number.isNaN(chainId) || !address.startsWith('0x')) return null
	return { chainId, address }
}

const fungiblesApp = new Hono<{ Bindings: Cloudflare.Env }>()

// ---------------------------------------------------------------------------
// GET /assets?fungible_ids=<chainId.address,...>&include_prices=<0|1>
// ---------------------------------------------------------------------------
fungiblesApp.get(
	'/assets',
	zValidator(
		'query',
		z.object({
			fungible_ids: z.string(),
			include_prices: z.optional(z.string()),
		}),
		validationError,
	),
	async (context) => {
		const { fungible_ids, include_prices } = context.req.valid('query')
		const includePrices = include_prices !== '0'

		const ids = fungible_ids.split(',').map((id) => id.trim())
		const parsed = ids
			.map(parseFungibleId)
			.filter((x): x is { chainId: number; address: Hex.Hex } => x !== null)

		if (parsed.length === 0)
			return context.json({ message: 'No valid fungible_ids provided' }, 400)

		// Read token metadata for each asset
		const metadataResults = await readContracts(wagmiConfig, {
			contracts: parsed.flatMap(({ address }) => [
				{ address, abi: Abis.tip20, functionName: 'name' as const },
				{ address, abi: Abis.tip20, functionName: 'symbol' as const },
				{
					address,
					abi: Abis.tip20,
					functionName: 'decimals' as const,
				},
				{
					address,
					abi: Abis.tip20,
					functionName: 'totalSupply' as const,
				},
			]),
		})

		const assets = parsed.map(({ chainId, address }, i) => {
			const base = i * 4
			const nameResult = metadataResults[base]
			const symbolResult = metadataResults[base + 1]
			const decimalsResult = metadataResults[base + 2]
			const supplyResult = metadataResults[base + 3]
			const name =
				nameResult?.status === 'success' ? String(nameResult.result) : null
			const symbol =
				symbolResult?.status === 'success' ? String(symbolResult.result) : null
			const decimals =
				decimalsResult?.status === 'success'
					? Number(decimalsResult.result)
					: null
			const supply =
				supplyResult?.status === 'success' ? String(supplyResult.result) : null

			return {
				fungible_id: `${chainId}.${address}`,
				chain: chainId,
				address,
				name,
				symbol,
				decimals,
				supply,
				...(includePrices ? { prices: [] } : {}),
			}
		})

		return context.json({ assets })
	},
)

// ---------------------------------------------------------------------------
// GET /balances?wallet_addresses=<addr,...>&chains=<chainId,...>&fungible_ids=<...>&tip20_only=<0|1>
// ---------------------------------------------------------------------------
fungiblesApp.get(
	'/balances',
	zValidator(
		'query',
		z.object({
			wallet_addresses: z.string(),
			chains: z.optional(z.string()),
			fungible_ids: z.optional(z.string()),
			tip20_only: z.optional(z.string()),
		}),
		validationError,
	),
	async (context) => {
		const {
			wallet_addresses,
			chains,
			fungible_ids,
			tip20_only: _,
		} = context.req.valid('query')

		const wallets = wallet_addresses
			.split(',')
			.map((a) => a.trim().toLowerCase())
		const chainIds = chains
			? chains.split(',').map((c) => Number(c.trim()))
			: [4217]

		// If specific fungible_ids provided, parse and use them
		if (fungible_ids) {
			const parsed = fungible_ids
				.split(',')
				.map((id) => parseFungibleId(id.trim()))
				.filter((x): x is { chainId: number; address: Hex.Hex } => x !== null)

			// Read balances for each wallet × token combination
			const contracts = wallets.flatMap((wallet) =>
				parsed.map(({ address }) => ({
					address,
					abi: Abis.tip20,
					functionName: 'balanceOf' as const,
					args: [wallet as Address.Address],
				})),
			)

			const balanceResults = await readContracts(wagmiConfig, {
				contracts,
			})

			const balances = wallets.flatMap((wallet, wi) =>
				parsed.map(({ chainId, address }, ti) => {
					const idx = wi * parsed.length + ti
					const result = balanceResults[idx]
					const balance =
						result?.status === 'success' ? (result.result as bigint) : 0n

					return {
						fungible_id: `${chainId}.${address}`,
						wallet_address: wallet,
						balance: balance.toString(),
					}
				}),
			)

			return context.json({ balances })
		}

		// Discover tokens via transfer history
		const allBalances: Array<{
			fungible_id: string
			wallet_address: string
			balance: string
		}> = []

		for (const wallet of wallets) {
			for (const chainId of chainIds) {
				try {
					// Find tokens this wallet has interacted with
					const rows = await queryBuilder
						.withSignatures([TRANSFER_SIGNATURE])
						.selectFrom('transfer')
						.select(['address'])
						.where('chain', '=', chainId)
						.where('to', '=', wallet as Hex.Hex)
						.limit(50)
						.execute()

					const tokenAddresses = [
						...new Set(rows.map((r) => String(r.address).toLowerCase())),
					]

					if (tokenAddresses.length === 0) continue

					// Read balances for discovered tokens
					const balanceResults = await readContracts(wagmiConfig, {
						contracts: tokenAddresses.map((tokenAddr) => ({
							address: tokenAddr as Address.Address,
							abi: Abis.tip20,
							functionName: 'balanceOf' as const,
							args: [wallet as Address.Address],
						})),
					})

					for (let i = 0; i < tokenAddresses.length; i++) {
						const result = balanceResults[i]
						const balance =
							result?.status === 'success' ? (result.result as bigint) : 0n
						if (balance > 0n) {
							allBalances.push({
								fungible_id: `${chainId}.${tokenAddresses[i]}`,
								wallet_address: wallet,
								balance: balance.toString(),
							})
						}
					}
				} catch {
					// Skip chains that fail
				}
			}
		}

		return context.json({ balances: allBalances })
	},
)

export { fungiblesApp }
