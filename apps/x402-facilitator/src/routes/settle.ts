import { zValidator } from '@hono/zod-validator'
import { Hono } from 'hono'
import { broadcastWithFeePayer } from '../lib/broadcast'
import {
	FacilitatorEvents,
	captureEvent,
	getRequestContext,
} from '../lib/posthog'
import { paymentPayloadSchema } from '../lib/schemas'
import type { TempoPaymentPayload, TempoSettleResponse } from '../lib/types'
import { verifyPaymentPayload } from '../lib/verify-transaction'

const settleRoute = new Hono()

settleRoute.post('/', zValidator('json', paymentPayloadSchema), async (c) => {
	// Cast the validated payload to our typed interface
	const payload = c.req.valid('json') as unknown as TempoPaymentPayload
	const viemClient = c.get('viemClient')
	const feePayerAccount = c.get('feePayerAccount')
	const feePayerAddress = c.get('feePayerAddress')
	const chain = c.get('network')
	const rpcUrl = c.get('rpcUrl')
	const requestId = c.get('requestId')
	const network = `eip155:${chain.id}` as const

	const requestContext = getRequestContext(c.req.raw)
	const distinctId = requestContext.origin ?? 'unknown'

	// Log settle request
	console.log(`[${requestId}] Settle request from ${distinctId}`)
	c.executionCtx.waitUntil(
		captureEvent({
			distinctId,
			event: FacilitatorEvents.SETTLE_REQUEST,
			properties: {
				...requestContext,
				requestId,
				network,
			},
		}),
	)

	// Re-validate the transaction before settlement
	const verifyResult = await verifyPaymentPayload(
		payload,
		viemClient,
		feePayerAddress,
	)

	if (!verifyResult.ok) {
		console.log(`[${requestId}] Settle verification failed: ${verifyResult.error.code}`)
		c.executionCtx.waitUntil(
			captureEvent({
				distinctId,
				event: FacilitatorEvents.SETTLE_FAILURE,
				properties: {
					...requestContext,
					requestId,
					network,
					errorCode: verifyResult.error.code,
					errorMessage: verifyResult.error.message,
					stage: 'verification',
				},
			}),
		)
		const response: TempoSettleResponse = {
			success: false,
			errorReason: `[${verifyResult.error.code}] ${verifyResult.error.message}`,
			transaction: '',
			network,
			requestId,
		}
		return c.json(response, 400)
	}

	// Broadcast the transaction with fee payer signature
	const broadcastResult = await broadcastWithFeePayer({
		signedTransaction: payload.payload.signedTransaction,
		feePayerAccount,
		feeToken: chain.feeToken,
		rpcUrl,
		chain,
	})

	if (!broadcastResult.success) {
		console.log(`[${requestId}] Settle broadcast failed: ${broadcastResult.error.code}`)
		c.executionCtx.waitUntil(
			captureEvent({
				distinctId,
				event: FacilitatorEvents.SETTLE_FAILURE,
				properties: {
					...requestContext,
					requestId,
					network,
					errorCode: broadcastResult.error.code,
					errorMessage: broadcastResult.error.message,
					stage: 'broadcast',
				},
			}),
		)
		const response: TempoSettleResponse = {
			success: false,
			errorReason: `[${broadcastResult.error.code}] ${broadcastResult.error.message}`,
			transaction: '',
			network,
			requestId,
		}
		return c.json(response, 500)
	}

	console.log(`[${requestId}] Settle success: ${broadcastResult.transactionHash}`)
	c.executionCtx.waitUntil(
		captureEvent({
			distinctId,
			event: FacilitatorEvents.SETTLE_SUCCESS,
			properties: {
				...requestContext,
				requestId,
				network,
				payer: verifyResult.value.payer,
				transactionHash: broadcastResult.transactionHash,
			},
		}),
	)

	const response: TempoSettleResponse = {
		success: true,
		payer: verifyResult.value.payer,
		transaction: broadcastResult.transactionHash,
		network,
		requestId,
	}
	return c.json(response, 200)
})

export default settleRoute
