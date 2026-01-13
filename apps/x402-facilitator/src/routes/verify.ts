import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import {
	FacilitatorEvents,
	captureEvent,
	getRequestContext,
} from '../lib/posthog'
import { checkAddressRateLimit } from '../lib/rate-limit'
import { paymentPayloadSchema } from '../lib/schemas'
import type { TempoPaymentPayload, TempoVerifyResponse } from '../lib/types'
import { verifyPaymentPayload } from '../lib/verify-transaction'

const verifyRoute = new Hono()

verifyRoute.post('/', zValidator('json', paymentPayloadSchema), async (c) => {
	// Cast the validated payload to our typed interface
	const payload = c.req.valid('json') as unknown as TempoPaymentPayload
	const viemClient = c.get('viemClient')
	const feePayerAddress = c.get('feePayerAddress')
	const requestId = c.get('requestId')

	const requestContext = getRequestContext(c.req.raw)
	const distinctId = requestContext.origin ?? 'unknown'

	// Log verify request
	console.log(`[${requestId}] Verify request from ${distinctId}`)
	c.executionCtx.waitUntil(
		captureEvent({
			distinctId,
			event: FacilitatorEvents.VERIFY_REQUEST,
			properties: {
				...requestContext,
				requestId,
			},
		}),
	)

	const result = await verifyPaymentPayload(
		payload,
		viemClient,
		feePayerAddress,
	)

	if (!result.ok) {
		// Check rate limit by error type to prevent brute force
		if (result.error.code === 'INVALID_TRANSACTION') {
			const rateLimitResult = await checkAddressRateLimit(
				c.req.header('cf-connecting-ip') ?? 'unknown',
			)
			if (!rateLimitResult.allowed) {
				console.log(`[${requestId}] Verify rate limited`)
				c.executionCtx.waitUntil(
					captureEvent({
						distinctId,
						event: FacilitatorEvents.VERIFY_FAILURE,
						properties: {
							...requestContext,
							requestId,
							errorCode: 'RATE_LIMITED',
							errorMessage: 'Rate limit exceeded due to repeated invalid requests',
						},
					}),
				)
				const response: TempoVerifyResponse = {
					isValid: false,
					invalidReason: 'Rate limit exceeded due to repeated invalid requests',
					requestId,
				}
				return c.json(response, 429)
			}
		}

		console.log(`[${requestId}] Verify failed: ${result.error.code}`)
		c.executionCtx.waitUntil(
			captureEvent({
				distinctId,
				event: FacilitatorEvents.VERIFY_FAILURE,
				properties: {
					...requestContext,
					requestId,
					errorCode: result.error.code,
					errorMessage: result.error.message,
				},
			}),
		)

		const response: TempoVerifyResponse = {
			isValid: false,
			invalidReason: `[${result.error.code}] ${result.error.message}`,
			requestId,
		}
		return c.json(response, 400)
	}

	console.log(`[${requestId}] Verify success for payer: ${result.value.payer}`)
	c.executionCtx.waitUntil(
		captureEvent({
			distinctId,
			event: FacilitatorEvents.VERIFY_SUCCESS,
			properties: {
				...requestContext,
				requestId,
				payer: result.value.payer,
			},
		}),
	)

	const response: TempoVerifyResponse = {
		isValid: true,
		payer: result.value.payer,
		requestId,
	}
	return c.json(response, 200)
})

export default verifyRoute
