import { SELF } from 'cloudflare:test'
import { describe, expect, it } from 'vitest'

// Payment payload for testing validation (not a real signed transaction)
const basePaymentPayload = {
	x402Version: 2,
	resource: {
		url: 'https://example.com/protected',
		description: 'Protected resource',
		mimeType: 'application/json',
	},
	accepted: {
		scheme: 'exact',
		network: 'eip155:42429',
		amount: '10000',
		asset: '0x20c0000000000000000000000000000000000001',
		payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
		maxTimeoutSeconds: 60,
		extra: {
			name: 'alphaUSD',
			decimals: 6,
		},
	},
	payload: {
		signedTransaction: '0x1234567890abcdef',
	},
}

describe('x402-facilitator', () => {
	describe('health check', () => {
		it('returns ok status', async () => {
			const response = await SELF.fetch('https://x402.test/health', {
				method: 'GET',
			})

			expect(response.status).toBe(200)
			const data = (await response.json()) as {
				status: string
				timestamp: string
				requestId: string
				facilitator: { address: string; rpcUrl: string }
			}
			expect(data.status).toBe('ok')
			expect(data.timestamp).toBeDefined()
			expect(data.requestId).toBeDefined()
			expect(data.facilitator).toBeDefined()
			expect(data.facilitator.address).toBeDefined()
			expect(data.facilitator.rpcUrl).toBeDefined()
		})
	})

	describe('CORS', () => {
		it('handles preflight requests', async () => {
			const response = await SELF.fetch('https://x402.test/health', {
				method: 'OPTIONS',
				headers: {
					Origin: 'https://example.com',
					'Access-Control-Request-Method': 'POST',
				},
			})

			expect([200, 204]).toContain(response.status)
		})

		it('includes CORS headers in response', async () => {
			const response = await SELF.fetch('https://x402.test/health', {
				method: 'GET',
				headers: {
					Origin: 'https://example.com',
				},
			})

			expect(response.status).toBe(200)
			expect(response.headers.get('Access-Control-Allow-Origin')).toBeDefined()
		})

		it('includes X-Request-ID header in response', async () => {
			const response = await SELF.fetch('https://x402.test/health', {
				method: 'GET',
			})

			expect(response.status).toBe(200)
			expect(response.headers.get('x-request-id')).toBeDefined()
		})
	})

	describe('supported', () => {
		it('returns supported schemes and networks', async () => {
			const response = await SELF.fetch('https://x402.test/supported', {
				method: 'GET',
			})

			expect(response.status).toBe(200)
			const data = (await response.json()) as {
				kinds: Array<{
					x402Version: number
					scheme: string
					network: string
				}>
				extensions: string[]
				signers: Record<string, string[]>
			}

			expect(data.kinds).toBeDefined()
			expect(data.kinds.length).toBeGreaterThan(0)
			expect(data.kinds[0].x402Version).toBe(2)
			expect(data.kinds[0].scheme).toBe('exact')
			expect(data.kinds[0].network).toMatch(/^eip155:\d+$/)
			expect(data.extensions).toBeDefined()
			expect(data.signers).toBeDefined()
		})
	})

	describe('verify', () => {
		it('rejects payload with missing required fields', async () => {
			const invalidPayload = {
				x402Version: 2,
				// Missing resource, accepted, and payload
			}

			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPayload),
			})

			expect(response.status).toBe(400)
		})

		it('rejects payload with invalid x402Version', async () => {
			const invalidPayload = {
				...basePaymentPayload,
				x402Version: 1, // Should be 2
			}

			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPayload),
			})

			expect(response.status).toBe(400)
		})

		it('rejects payload with invalid scheme', async () => {
			const invalidPayload = {
				...basePaymentPayload,
				accepted: {
					...basePaymentPayload.accepted,
					scheme: 'invalid', // Should be 'exact'
				},
			}

			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPayload),
			})

			expect(response.status).toBe(400)
		})

		it('returns INVALID_TRANSACTION error for malformed transaction', async () => {
			// This tests that validation passes but transaction parsing fails
			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(basePaymentPayload),
			})

			expect(response.status).toBe(400)
			const data = (await response.json()) as {
				isValid: boolean
				invalidReason?: string
				requestId?: string
			}
			expect(data.isValid).toBe(false)
			expect(data.invalidReason).toBeDefined()
			expect(data.invalidReason).toContain('INVALID_TRANSACTION')
			expect(data.requestId).toBeDefined()
		})
	})

	describe('settle', () => {
		it('rejects payload with missing required fields', async () => {
			const invalidPayload = {
				x402Version: 2,
				// Missing resource, accepted, and payload
			}

			const response = await SELF.fetch('https://x402.test/settle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(invalidPayload),
			})

			expect(response.status).toBe(400)
		})

		it('rejects non-JSON request body', async () => {
			const response = await SELF.fetch('https://x402.test/settle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: 'not valid json',
			})

			expect(response.status).toBe(400)
		})

		it('returns INVALID_TRANSACTION error for malformed transaction', async () => {
			// This tests that validation passes but transaction parsing fails
			const response = await SELF.fetch('https://x402.test/settle', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify(basePaymentPayload),
			})

			expect(response.status).toBe(400)
			const data = (await response.json()) as {
				success: boolean
				network: string
				errorReason?: string
				requestId?: string
			}
			expect(data.success).toBe(false)
			expect(data.network).toMatch(/^eip155:\d+$/)
			expect(data.errorReason).toBeDefined()
			expect(data.errorReason).toContain('INVALID_TRANSACTION')
			expect(data.requestId).toBeDefined()
		})
	})

	describe('request ID handling', () => {
		it('echoes provided X-Request-ID header', async () => {
			const customRequestId = 'test-request-id-12345'
			const response = await SELF.fetch('https://x402.test/health', {
				method: 'GET',
				headers: {
					'X-Request-ID': customRequestId,
				},
			})

			expect(response.status).toBe(200)
			expect(response.headers.get('x-request-id')).toBe(customRequestId)

			const data = (await response.json()) as { requestId: string }
			expect(data.requestId).toBe(customRequestId)
		})

		it('generates unique request IDs when not provided', async () => {
			const response1 = await SELF.fetch('https://x402.test/health')
			const response2 = await SELF.fetch('https://x402.test/health')

			const id1 = response1.headers.get('x-request-id')
			const id2 = response2.headers.get('x-request-id')

			expect(id1).toBeDefined()
			expect(id2).toBeDefined()
			expect(id1).not.toBe(id2)
		})
	})

	describe('unsupported HTTP methods', () => {
		it('rejects GET request to verify', async () => {
			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'GET',
			})

			expect([404, 405]).toContain(response.status)
		})

		it('rejects GET request to settle', async () => {
			const response = await SELF.fetch('https://x402.test/settle', {
				method: 'GET',
			})

			expect([404, 405]).toContain(response.status)
		})

		it('rejects POST request to supported', async () => {
			const response = await SELF.fetch('https://x402.test/supported', {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({}),
			})

			expect([404, 405]).toContain(response.status)
		})
	})

	describe('content type handling', () => {
		it('verify requires content-type header', async () => {
			const response = await SELF.fetch('https://x402.test/verify', {
				method: 'POST',
				body: JSON.stringify(basePaymentPayload),
				// No Content-Type header
			})

			// Should fail parsing or validation
			expect([400, 415]).toContain(response.status)
		})

		it('settle requires content-type header', async () => {
			const response = await SELF.fetch('https://x402.test/settle', {
				method: 'POST',
				body: JSON.stringify(basePaymentPayload),
				// No Content-Type header
			})

			// Should fail parsing or validation
			expect([400, 415]).toContain(response.status)
		})
	})
})
