import { describe, expect, it } from 'vitest'
import {
	paymentPayloadSchema,
	paymentRequirementsSchema,
} from '../src/lib/schemas'

describe('schemas', () => {
	describe('paymentRequirementsSchema', () => {
		const validRequirements = {
			scheme: 'exact',
			network: 'eip155:42429',
			amount: '10000',
			asset: '0x20c0000000000000000000000000000000000001',
			payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
			maxTimeoutSeconds: 60,
		}

		describe('scheme validation', () => {
			it('rejects invalid scheme', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					scheme: 'upto', // Only 'exact' is supported
				})
				expect(result.success).toBe(false)
			})
		})

		describe('network validation', () => {
			it('rejects invalid network format', () => {
				const invalidNetworks = [
					'ethereum:42429',
					'42429',
					'eip155:',
					'eip155',
					'eip155:abc',
					'',
				]
				for (const network of invalidNetworks) {
					const result = paymentRequirementsSchema.safeParse({
						...validRequirements,
						network,
					})
					expect(result.success).toBe(false)
				}
			})
		})

		describe('amount validation', () => {
			it('rejects non-numeric amounts', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					amount: 'abc',
				})
				expect(result.success).toBe(false)
			})

			it('rejects negative amounts', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					amount: '-100',
				})
				expect(result.success).toBe(false)
			})

			it('rejects decimal amounts', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					amount: '100.5',
				})
				expect(result.success).toBe(false)
			})

			it('rejects numeric type (must be string)', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					amount: 10000,
				})
				expect(result.success).toBe(false)
			})
		})

		describe('asset (TIP-20) validation', () => {
			it('rejects non-TIP-20 address', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					asset: '0x1234567890123456789012345678901234567890',
				})
				expect(result.success).toBe(false)
			})

			it('rejects invalid hex address', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					asset: '0x20c000000invalid',
				})
				expect(result.success).toBe(false)
			})

			it('rejects address without 0x prefix', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					asset: '20c0000000000000000000000000000000000001',
				})
				expect(result.success).toBe(false)
			})
		})

		describe('payTo validation', () => {
			it('rejects invalid hex address', () => {
				const invalidAddresses = [
					'0x1234', // Too short
					'0xGGGG567890123456789012345678901234567890', // Invalid chars
					'1234567890123456789012345678901234567890', // Missing 0x
				]
				for (const payTo of invalidAddresses) {
					const result = paymentRequirementsSchema.safeParse({
						...validRequirements,
						payTo,
					})
					expect(result.success).toBe(false)
				}
			})
		})

		describe('maxTimeoutSeconds validation', () => {
			it('rejects zero', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					maxTimeoutSeconds: 0,
				})
				expect(result.success).toBe(false)
			})

			it('rejects negative values', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					maxTimeoutSeconds: -60,
				})
				expect(result.success).toBe(false)
			})

			it('rejects decimal values', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					maxTimeoutSeconds: 60.5,
				})
				expect(result.success).toBe(false)
			})
		})

		describe('extra field validation', () => {
			it('rejects decimals outside 0-18 range', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					extra: { decimals: 19 },
				})
				expect(result.success).toBe(false)
			})

			it('rejects negative decimals', () => {
				const result = paymentRequirementsSchema.safeParse({
					...validRequirements,
					extra: { decimals: -1 },
				})
				expect(result.success).toBe(false)
			})
		})
	})

	describe('paymentPayloadSchema', () => {
		const validPayload = {
			x402Version: 2,
			resource: {
				url: 'https://example.com/api/protected',
				description: 'Protected API endpoint',
				mimeType: 'application/json',
			},
			accepted: {
				scheme: 'exact',
				network: 'eip155:42429',
				amount: '10000',
				asset: '0x20c0000000000000000000000000000000000001',
				payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
				maxTimeoutSeconds: 60,
			},
			payload: {
				signedTransaction: '0xabcdef1234567890',
			},
		}

		describe('x402Version validation', () => {
			it('rejects version 1', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					x402Version: 1,
				})
				expect(result.success).toBe(false)
			})

			it('rejects version 3', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					x402Version: 3,
				})
				expect(result.success).toBe(false)
			})
		})

		describe('resource validation', () => {
			it('rejects invalid URL', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					resource: {
						...validPayload.resource,
						url: 'not-a-url',
					},
				})
				expect(result.success).toBe(false)
			})

			it('rejects empty description', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					resource: {
						...validPayload.resource,
						description: '',
					},
				})
				expect(result.success).toBe(false)
			})

			it('rejects description over 500 chars', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					resource: {
						...validPayload.resource,
						description: 'a'.repeat(501),
					},
				})
				expect(result.success).toBe(false)
			})

			it('rejects empty mimeType', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					resource: {
						...validPayload.resource,
						mimeType: '',
					},
				})
				expect(result.success).toBe(false)
			})
		})

		describe('payload validation', () => {
			it('rejects invalid hex signedTransaction', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					payload: {
						signedTransaction: 'not-hex',
					},
				})
				expect(result.success).toBe(false)
			})

			it('rejects signedTransaction without 0x prefix', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					payload: {
						signedTransaction: 'abcdef1234567890',
					},
				})
				expect(result.success).toBe(false)
			})
		})

		describe('createdAt validation', () => {
			it('rejects negative timestamp', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					createdAt: -1,
				})
				expect(result.success).toBe(false)
			})

			it('rejects zero timestamp', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					createdAt: 0,
				})
				expect(result.success).toBe(false)
			})

			it('rejects decimal timestamp', () => {
				const result = paymentPayloadSchema.safeParse({
					...validPayload,
					createdAt: 1234567890.5,
				})
				expect(result.success).toBe(false)
			})
		})
	})
})
