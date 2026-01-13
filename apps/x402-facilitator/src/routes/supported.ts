import { Hono } from 'hono'
import {
	FacilitatorEvents,
	captureEvent,
	getRequestContext,
} from '../lib/posthog'

const supportedRoute = new Hono()

/**
 * Returns what this facilitator supports.
 * This is the standard x402 /supported endpoint.
 */
supportedRoute.get('/', (c) => {
	const chain = c.get('network')
	const feePayerAddress = c.get('feePayerAddress')
	const requestId = c.get('requestId')

	const requestContext = getRequestContext(c.req.raw)
	const distinctId = requestContext.origin ?? 'unknown'

	console.log(`[${requestId}] Supported query from ${distinctId}`)
	c.executionCtx.waitUntil(
		captureEvent({
			distinctId,
			event: FacilitatorEvents.SUPPORTED_QUERY,
			properties: {
				...requestContext,
				requestId,
				network: `eip155:${chain.id}`,
			},
		}),
	)

	return c.json({
		kinds: [
			{
				x402Version: 2,
				scheme: 'exact',
				network: `eip155:${chain.id}`,
			},
		],
		extensions: [],
		signers: {
			[`eip155:${chain.id}`]: [feePayerAddress],
		},
	})
})

export default supportedRoute
