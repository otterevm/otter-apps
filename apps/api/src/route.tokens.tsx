import { Hono } from 'hono'
import * as z from 'zod/mini'
import { Abis } from 'viem/tempo'
import type { Address, Hex } from 'ox'
import { timeout } from 'hono/timeout'
import { readContracts } from 'wagmi/actions'
import { zValidator } from '@hono/zod-validator'
import { HTTPException } from 'hono/http-exception'

import { idxClient } from '#utilities/indexer.ts'
import { supportedChainIds, wagmiConfig, zAddress, zChainId } from '#wagmi.config.ts'

const { queryBuilder } = idxClient()

const TRANSFER_SIGNATURE = 'event Transfer(address indexed from, address indexed to, uint256 value)'
const APPROVAL_SIGNATURE =
	'event Approval(address indexed owner, address indexed spender, uint256 value)'

function validationError(
	result: { success: boolean; error?: unknown },
	context: { json: (data: unknown, status: number) => Response },
) {
	if (!result.success)
		return context.json(
			{
				message: 'Invalid query parameters',
				error:
					result.error && typeof result.error === 'object' && 'issues' in result.error
						? result.error
						: String(result.error),
			},
			400,
		)
}

const zOptionalLimit = (defaultLimit = 20) => z.prefault(z.coerce.number(), defaultLimit)

async function isIndexSupplyAvailable(chainId: number): Promise<boolean> {
	try {
		const result = await queryBuilder
			.selectFrom('blocks')
			.select(['num'])
			.where('chain', '=', chainId)
			.limit(1)
			.execute()
		return result.length > 0
	} catch {
		return false
	}
}

async function getTokenHolders(
	chainId: number,
	tokenAddress: Hex.Hex,
	limit: number,
): Promise<{ holders: string[]; block_height: number }> {
	const token = tokenAddress.toLowerCase() as Hex.Hex

	// Query recent transfer recipients (faster than groupBy for large datasets)
	const [rows, block] = await Promise.all([
		queryBuilder
			.withSignatures([TRANSFER_SIGNATURE])
			.selectFrom('transfer')
			.select(['to'])
			.where('chain', '=', chainId)
			.where('address', '=', token)
			.orderBy('block_num', 'desc')
			.limit(limit * 5)
			.execute(),
		queryBuilder
			.selectFrom('blocks')
			.select(['num'])
			.where('chain', '=', chainId)
			.orderBy('num', 'desc')
			.limit(1)
			.executeTakeFirst(),
	])

	const addresses = rows
		.map((row) => String(row.to))
		.filter((a) => a && a !== '0x0000000000000000000000000000000000000000')

	return {
		holders: [...new Set(addresses)].slice(0, limit * 2),
		block_height: block ? Number(block.num) : 0,
	}
}

async function getTokenAllowances(
	chainId: number,
	tokenAddress: Hex.Hex,
	limit: number,
): Promise<{
	allowances: Array<{
		owner: string
		spender: string
		value: string
		block_num: number
		tx_hash: string
	}>
	block_height: number
}> {
	const token = tokenAddress.toLowerCase() as Hex.Hex

	const rows = await queryBuilder
		.withSignatures([APPROVAL_SIGNATURE])
		.selectFrom('approval')
		.select(['owner', 'spender', 'value', 'block_num', 'tx_hash'])
		.where('chain', '=', chainId)
		.where('address', '=', token)
		.orderBy('block_num', 'desc')
		.limit(limit)
		.execute()

	const block = await queryBuilder
		.selectFrom('blocks')
		.select(['num'])
		.where('chain', '=', chainId)
		.orderBy('num', 'desc')
		.limit(1)
		.executeTakeFirst()

	return {
		allowances: rows.map((row) => ({
			owner: String(row.owner),
			spender: String(row.spender),
			value: String(row.value),
			block_num: Number(row.block_num),
			tx_hash: String(row.tx_hash),
		})),
		block_height: block ? Number(block.num) : 0,
	}
}

const tokensApp = new Hono<{ Bindings: Cloudflare.Env }>()

tokensApp.use(
	'*',
	timeout(
		100_000,
		(context) =>
			new HTTPException(408, {
				message: `Timedout after ${context.req.raw.headers.get('Duration')} seconds`,
			}),
	),
)

tokensApp.get(
	'/:chainId/:address/holders',
	zValidator('param', z.object({ chainId: zChainId(), address: zAddress() }), validationError),
	zValidator('query', z.object({ limit: zOptionalLimit() }), validationError),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const { limit } = context.req.valid('query')

		// Fetch holders and token decimals in parallel
		const [tokenHolders, decimalsResult] = await Promise.all([
			getTokenHolders(chainId, address, limit),
			readContracts(wagmiConfig, {
				contracts: [{ address, abi: Abis.tip20, functionName: 'decimals' }],
			}),
		])

		const decimals = decimalsResult[0]?.status === 'success' ? Number(decimalsResult[0].result) : 6

		const holdersToCheck = tokenHolders.holders.slice(0, limit)

		// Batch all balance calls into a single multicall
		const balanceResults = await readContracts(wagmiConfig, {
			contracts: holdersToCheck.map((holder) => ({
				address,
				abi: Abis.tip20,
				functionName: 'balanceOf' as const,
				args: [holder as Address.Address],
			})),
		})

		// Combine results and filter out zero balances
		const holdersWithBalances = holdersToCheck
			.map((holder, i) => {
				const result = balanceResults[i]
				const balance = result?.status === 'success' ? (result.result as bigint) : 0n
				return { address: holder, balance: balance.toString(), decimals }
			})
			.filter((h) => h.balance !== '0')

		return context.json({
			chainId,
			token_address: address,
			block_height: tokenHolders.block_height,
			holders: holdersWithBalances,
			pagination: {
				limit,
				total_discovered: tokenHolders.holders.length,
			},
		})
	},
)

tokensApp.get(
	'/:chainId/:address/allowances',
	zValidator('param', z.object({ chainId: zChainId(), address: zAddress() }), validationError),
	zValidator('query', z.object({ limit: zOptionalLimit() }), validationError),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const { limit: limitParam } = context.req.valid('query')
		const limit = Math.min(Math.max(limitParam ?? 100, 1), 1000)

		if (!supportedChainIds.includes(chainId))
			return context.json({ message: `Invalid chain: ${chainId}` }, 400)

		const available = await isIndexSupplyAvailable(chainId)
		if (!available) {
			return context.json(
				{
					message: 'Token allowances not available for this chain',
					hint: 'Index Supply does not yet index this chain',
				},
				503,
			)
		}

		try {
			const result = await getTokenAllowances(chainId, address, limit)

			return context.json({
				chainId,
				token_address: address,
				block_height: result.block_height,
				allowances: result.allowances.map((a) => ({
					owner: a.owner,
					spender: a.spender,
					amount: a.value,
					block_num: a.block_num,
					tx_hash: a.tx_hash,
				})),
				pagination: {
					limit,
					has_more: result.allowances.length === limit,
				},
			})
		} catch (error) {
			console.error('Token allowances error:', error)
			return context.json({ message: 'Failed to fetch token allowances' }, 500)
		}
	},
)

export { tokensApp }
