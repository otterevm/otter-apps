import { Hono } from 'hono'
import * as z from 'zod/mini'
import type { Hex } from 'ox'
import { zValidator } from '@hono/zod-validator'

import { idxClient } from '#utilities/indexer.ts'
import { zAddress, zChainId } from '#wagmi.config.ts'

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

const zOptionalLimit = (defaultLimit = 50) =>
	z.prefault(z.coerce.number(), defaultLimit)

const zOptionalOffset = () => z.prefault(z.coerce.number(), 0)

const addressesApp = new Hono<{ Bindings: Cloudflare.Env }>()

// ---------------------------------------------------------------------------
// GET /:chainId/:address/transactions
// ---------------------------------------------------------------------------
addressesApp.get(
	'/:chainId/:address/transactions',
	zValidator(
		'param',
		z.object({ chainId: zChainId(), address: zAddress() }),
		validationError,
	),
	zValidator(
		'query',
		z.object({
			limit: zOptionalLimit(),
			offset: zOptionalOffset(),
		}),
		validationError,
	),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const { limit: limitParam, offset } = context.req.valid('query')
		const limit = Math.min(Math.max(limitParam ?? 50, 1), 100)
		const addr = address.toLowerCase() as Hex.Hex

		try {
			// Discover transaction hashes from transfer events involving this address
			const [sentRows, receivedRows] = await Promise.all([
				queryBuilder
					.withSignatures([TRANSFER_SIGNATURE])
					.selectFrom('transfer')
					.select(['tx_hash', 'block_num'])
					.where('chain', '=', chainId)
					.where('from', '=', addr)
					.orderBy('block_num', 'desc')
					.limit(limit * 3)
					.execute(),
				queryBuilder
					.withSignatures([TRANSFER_SIGNATURE])
					.selectFrom('transfer')
					.select(['tx_hash', 'block_num'])
					.where('chain', '=', chainId)
					.where('to', '=', addr)
					.orderBy('block_num', 'desc')
					.limit(limit * 3)
					.execute(),
			])

			// Merge, deduplicate, sort by block descending
			const txMap = new Map<string, { hash: string; block_num: number }>()
			for (const row of [...sentRows, ...receivedRows]) {
				const hash = String(row.tx_hash)
				if (!txMap.has(hash)) {
					txMap.set(hash, { hash, block_num: Number(row.block_num) })
				}
			}

			const allTxs = [...txMap.values()]
				.sort((a, b) => b.block_num - a.block_num)
				.slice(offset, offset + limit)

			return context.json({
				chainId,
				address,
				transactions: allTxs,
				pagination: { limit, offset, count: allTxs.length },
			})
		} catch (error) {
			console.error('Transaction history error:', error)
			return context.json(
				{ message: 'Failed to fetch transaction history' },
				500,
			)
		}
	},
)

// ---------------------------------------------------------------------------
// GET /:chainId/:address/transfers
// ---------------------------------------------------------------------------
addressesApp.get(
	'/:chainId/:address/transfers',
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
		const limit = Math.min(Math.max(limitParam ?? 50, 1), 100)
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

			const transfers = [...sentRows, ...receivedRows]
				.map((row) => ({
					from: String(row.from),
					to: String(row.to),
					value: String(row.value),
					token_address: String(row.address),
					block_num: Number(row.block_num),
					tx_hash: String(row.tx_hash),
				}))
				.sort((a, b) => b.block_num - a.block_num)
				.slice(0, limit)

			return context.json({
				chainId,
				address,
				transfers,
				pagination: { limit, count: transfers.length },
			})
		} catch (error) {
			console.error('Token transfers error:', error)
			return context.json({ message: 'Failed to fetch token transfers' }, 500)
		}
	},
)

export { addressesApp }
