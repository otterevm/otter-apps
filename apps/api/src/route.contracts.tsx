import { Hono } from 'hono'
import * as z from 'zod/mini'
import { getPublicClient } from 'wagmi/actions'
import { zValidator } from '@hono/zod-validator'

import { wagmiConfig, zAddress, zChainId, type ChainId } from '#wagmi.config.ts'

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

const contractsApp = new Hono<{ Bindings: Cloudflare.Env }>()

contractsApp.get(
	'/:chainId/:address',
	zValidator(
		'param',
		z.object({ chainId: zChainId(), address: zAddress() }),
		validationError,
	),
	async (context) => {
		const { chainId, address } = context.req.valid('param')
		const client = getPublicClient(wagmiConfig, {
			chainId: chainId as ChainId,
		})
		if (!client)
			return context.json({ message: `No client for chain ${chainId}` }, 400)

		const code = await client.getCode({ address })
		const isContract = !!code && code !== '0x'

		return context.json({
			chainId,
			address,
			is_contract: isContract,
			bytecode_size: isContract ? (code.length - 2) / 2 : 0,
		})
	},
)

export { contractsApp }
