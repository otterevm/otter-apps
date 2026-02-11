import { Hono } from 'hono'
import * as z from 'zod/mini'
import type { Hex } from 'ox'
import { getPublicClient } from 'wagmi/actions'
import { zValidator } from '@hono/zod-validator'

import { wagmiConfig, zChainId, type ChainId } from '#wagmi.config.ts'

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

const HASH_RE = /^0x[a-fA-F0-9]{64}$/

const transactionsApp = new Hono<{ Bindings: Cloudflare.Env }>()

transactionsApp.get(
	'/:chainId/:hash',
	zValidator(
		'param',
		z.object({ chainId: zChainId(), hash: z.string() }),
		validationError,
	),
	async (context) => {
		const { chainId, hash } = context.req.valid('param')
		if (!HASH_RE.test(hash))
			return context.json({ message: 'Invalid transaction hash' }, 400)
		const client = getPublicClient(wagmiConfig, {
			chainId: chainId as ChainId,
		})
		if (!client)
			return context.json({ message: `No client for chain ${chainId}` }, 400)

		try {
			const [tx, receipt] = await Promise.all([
				client.getTransaction({ hash: hash as Hex.Hex }),
				client.getTransactionReceipt({ hash: hash as Hex.Hex }),
			])

			return context.json({
				chainId,
				hash: tx.hash,
				from: tx.from,
				to: tx.to,
				value: (tx.value ?? 0n).toString(),
				block_number: Number(tx.blockNumber),
				transaction_index: tx.transactionIndex,
				gas_used: receipt.gasUsed.toString(),
				effective_gas_price: receipt.effectiveGasPrice.toString(),
				status: receipt.status,
				logs_count: receipt.logs.length,
			})
		} catch {
			return context.json({ message: `Transaction ${hash} not found` }, 404)
		}
	},
)

export { transactionsApp }
