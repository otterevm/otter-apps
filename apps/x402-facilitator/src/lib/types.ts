// Re-export types from @x402/core for facilitator use
export type {
	PaymentPayload,
	PaymentRequirements,
	VerifyResponse,
	SettleResponse,
	VerifyRequest,
	SettleRequest,
} from '@x402/core/types'

import type {
	PaymentPayload as X402PaymentPayload,
	VerifyResponse as X402VerifyResponse,
	SettleResponse as X402SettleResponse,
} from '@x402/core/types'

/**
 * Tempo-specific payment payload with typed signedTransaction
 * Extends the base PaymentPayload with Tempo-specific fields
 */
export interface TempoPaymentPayload extends X402PaymentPayload {
	payload: {
		signedTransaction: `0x${string}`
	}
	/** Timestamp when the payload was created (for timeout validation) */
	createdAt?: number
}

/**
 * Tempo-specific verify response with request ID for tracing
 */
export interface TempoVerifyResponse extends X402VerifyResponse {
	requestId?: string
}

/**
 * Tempo-specific settle response with request ID for tracing
 */
export interface TempoSettleResponse extends X402SettleResponse {
	requestId?: string
}

/**
 * Structured verification error
 */
export interface VerificationError {
	code: VerificationErrorCode
	message: string
}

export type VerificationErrorCode =
	| 'INVALID_TRANSACTION'
	| 'INVALID_SIGNATURE'
	| 'INVALID_ASSET_FORMAT'
	| 'ASSET_MISMATCH'
	| 'NONZERO_VALUE'
	| 'INVALID_FUNCTION_CALL'
	| 'RECIPIENT_MISMATCH'
	| 'AMOUNT_MISMATCH'
	| 'CHAIN_ID_MISMATCH'
	| 'INSUFFICIENT_BALANCE'
	| 'TIMEOUT_EXCEEDED'
	| 'SIMULATION_FAILED'
	| 'FEE_PAYER_CONFLICT'
	| 'BROADCAST_FAILED'

/**
 * Result type for explicit success/failure handling
 */
export type Result<T, E = VerificationError> =
	| { ok: true; value: T }
	| { ok: false; error: E }

/**
 * Helper to create success result
 */
export function ok<T>(value: T): Result<T, never> {
	return { ok: true, value }
}

/**
 * Helper to create error result
 */
export function err<E>(error: E): Result<never, E> {
	return { ok: false, error }
}
