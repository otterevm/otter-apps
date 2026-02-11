import { Hono } from 'hono'
import * as z from 'zod/mini'
import type { Hex } from 'ox'
import { zValidator } from '@hono/zod-validator'

import { idxClient } from '#utilities/indexer.ts'
import { zAddress, zChainId } from '#wagmi.config.ts'

const { queryBuilder } = idxClient()

const TRANSFER_SIGNATURE =
	'event Transfer(address indexed from, address indexed to, uint256 value)'
const APPROVAL_SIGNATURE =
	'event Approval(address indexed owner, address indexed spender, uint256 value)'

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

const zOptionalLimit = (defaultLimit = 100) =>
	z.prefault(z.coerce.number(), defaultLimit)

const walletsApp = new Hono<{ Bindings: Cloudflare.Env }>()

// ---------------------------------------------------------------------------
// GET /:chainId/:address/allowances
// ---------------------------------------------------------------------------
walletsApp.get(
	'/:chainId/:address/allowances',
	zValidator(
		'param',
		z.object({ chainId: zChainId(), address: zAddress() }),
		validationError,
	),
	zValidator('query', z.object({ limit: zOptionalLimit() }), validationError),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const { limit: limitParam } = context.req.valid('query')
		const limit = Math.min(Math.max(limitParam ?? 100, 1), 1000)
		const owner = address.toLowerCase() as Hex.Hex

		try {
			const [rows, block] = await Promise.all([
				queryBuilder
					.withSignatures([APPROVAL_SIGNATURE])
					.selectFrom('approval')
					.select([
						'owner',
						'spender',
						'value',
						'address',
						'block_num',
						'tx_hash',
					])
					.where('chain', '=', chainId)
					.where('owner', '=', owner)
					.orderBy('block_num', 'desc')
					.limit(limit)
					.execute(),
				queryBuilder
					.selectFrom('blocks')
					.select(['num'])
					.where('chain', '=', chainId)
					.orderBy('num', 'desc')
					.limit(1)
					.executeTakeFirst(),
			])

			return context.json({
				chainId,
				wallet_address: address,
				block_height: block ? Number(block.num) : 0,
				allowances: rows.map((row) => ({
					owner: String(row.owner),
					spender: String(row.spender),
					amount: String(row.value),
					token_address: String(row.address),
					block_num: Number(row.block_num),
					tx_hash: String(row.tx_hash),
				})),
				pagination: {
					limit,
					has_more: rows.length === limit,
				},
			})
		} catch (error) {
			console.error('Wallet allowances error:', error)
			return context.json({ message: 'Failed to fetch wallet allowances' }, 500)
		}
	},
)

// ---------------------------------------------------------------------------
// GET /:chainId/:address/balance-history
// ---------------------------------------------------------------------------
walletsApp.get(
	'/:chainId/:address/balance-history',
	zValidator(
		'param',
		z.object({ chainId: zChainId(), address: zAddress() }),
		validationError,
	),
	zValidator(
		'query',
		z.object({
			token: z.optional(z.string()),
			limit: zOptionalLimit(),
		}),
		validationError,
	),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const { token, limit: limitParam } = context.req.valid('query')
		const limit = Math.min(Math.max(limitParam ?? 100, 1), 1000)
		const addr = address.toLowerCase() as Hex.Hex

		try {
			const buildQuery = (direction: 'from' | 'to') => {
				let qb = queryBuilder
					.withSignatures([TRANSFER_SIGNATURE])
					.selectFrom('transfer')
					.select(['from', 'to', 'value', 'address', 'block_num', 'tx_hash'])
					.where('chain', '=', chainId)
					.where(direction, '=', addr)
					.orderBy('block_num', 'desc')
					.limit(limit)

				if (token) {
					qb = qb.where('address', '=', token.toLowerCase() as Hex.Hex)
				}
				return qb.execute()
			}

			const [sentRows, receivedRows] = await Promise.all([
				buildQuery('from'),
				buildQuery('to'),
			])

			// Build balance change events (deltas)
			const changes = [
				...sentRows.map((row) => ({
					direction: 'out' as const,
					token_address: String(row.address),
					amount: `-${String(row.value)}`,
					counterparty: String(row.to),
					block_num: Number(row.block_num),
					tx_hash: String(row.tx_hash),
				})),
				...receivedRows.map((row) => ({
					direction: 'in' as const,
					token_address: String(row.address),
					amount: String(row.value),
					counterparty: String(row.from),
					block_num: Number(row.block_num),
					tx_hash: String(row.tx_hash),
				})),
			]
				.sort((a, b) => b.block_num - a.block_num)
				.slice(0, limit)

			return context.json({
				chainId,
				address,
				changes,
				pagination: {
					limit,
					count: changes.length,
				},
			})
		} catch (error) {
			console.error('Balance history error:', error)
			return context.json({ message: 'Failed to fetch balance history' }, 500)
		}
	},
)

export { walletsApp }
