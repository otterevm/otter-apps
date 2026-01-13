import { describe, expect, it } from 'vitest'
import {
	decodeTransferCalldata,
	parseNetworkChainId,
	parseSignedTransaction,
	validatePaymentRequirements,
	validateTimeout,
	type ParsedTransaction,
	type TransferParams,
} from '../src/lib/verify-transaction'
import type { PaymentRequirements } from '../src/lib/types'

describe('verify-transaction', () => {
	describe('parseNetworkChainId', () => {
		it('parses valid network string', () => {
			expect(parseNetworkChainId('eip155:42429')).toBe(42429)
		})

		it('parses network with different chain id', () => {
			expect(parseNetworkChainId('eip155:1')).toBe(1)
			expect(parseNetworkChainId('eip155:31337')).toBe(31337)
			expect(parseNetworkChainId('eip155:42431')).toBe(42431)
		})

		it('returns null for invalid network format', () => {
			expect(parseNetworkChainId('eip155')).toBeNull()
			expect(parseNetworkChainId('eip155:')).toBeNull()
			expect(parseNetworkChainId('42429')).toBeNull()
			expect(parseNetworkChainId('ethereum:42429')).toBeNull()
			expect(parseNetworkChainId('')).toBeNull()
		})

		it('returns null for non-numeric chain id', () => {
			expect(parseNetworkChainId('eip155:abc')).toBeNull()
			expect(parseNetworkChainId('eip155:1a2b')).toBeNull()
		})
	})

	describe('validateTimeout', () => {
		it('returns null when createdAt is undefined', () => {
			expect(validateTimeout(undefined, 60)).toBeNull()
		})

		it('returns null when payment is not expired', () => {
			const now = Math.floor(Date.now() / 1000)
			expect(validateTimeout(now - 30, 60)).toBeNull() // 30 seconds ago, 60 second timeout
		})

		it('returns null when payment is exactly at expiry', () => {
			const now = Math.floor(Date.now() / 1000)
			// Create a timestamp such that now === createdAt + maxTimeoutSeconds
			expect(validateTimeout(now, 1)).toBeNull()
		})

		it('returns error when payment is expired', () => {
			const now = Math.floor(Date.now() / 1000)
			const createdAt = now - 120 // 2 minutes ago
			const result = validateTimeout(createdAt, 60) // 60 second timeout
			expect(result).not.toBeNull()
			expect(result?.code).toBe('TIMEOUT_EXCEEDED')
			expect(result?.message).toContain('Payment expired')
		})

		it('handles very short timeouts', () => {
			const now = Math.floor(Date.now() / 1000)
			const createdAt = now - 2 // 2 seconds ago
			const result = validateTimeout(createdAt, 1) // 1 second timeout
			expect(result).not.toBeNull()
			expect(result?.code).toBe('TIMEOUT_EXCEEDED')
		})
	})

	describe('validatePaymentRequirements', () => {
		const validTx: ParsedTransaction = {
			to: '0x20c0000000000000000000000000000000000001',
			value: 0n,
			data: '0xa9059cbb000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c0000000000000000000000000000000000000000000000000000000000002710',
			chainId: 42429,
			from: '0x1234567890123456789012345678901234567890',
			serialized: '0x1234' as `0x${string}`,
		}

		const validTransfer: TransferParams = {
			recipient: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
			amount: 10000n,
		}

		const validRequirements: PaymentRequirements = {
			scheme: 'exact',
			network: 'eip155:42429',
			amount: '10000',
			asset: '0x20c0000000000000000000000000000000000001',
			payTo: '0x209693Bc6afc0C5328bA36FaF03C514EF312287C',
			maxTimeoutSeconds: 60,
		}

		const feePayerAddress = '0x0000000000000000000000000000000000000FEE' as `0x${string}`

		it('validates correct payment requirements', () => {
			const result = validatePaymentRequirements(
				validTx,
				validTransfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result).toBeNull()
		})

		it('rejects asset without TIP-20 prefix', () => {
			const requirements = {
				...validRequirements,
				asset: '0x1234567890123456789012345678901234567890', // Not TIP-20
			}
			const tx = {
				...validTx,
				to: '0x1234567890123456789012345678901234567890' as `0x${string}`,
			}
			const result = validatePaymentRequirements(
				tx,
				validTransfer,
				requirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('INVALID_ASSET_FORMAT')
			expect(result?.message).toContain('TIP-20 prefix')
		})

		it('rejects transaction target mismatch with asset', () => {
			const tx = {
				...validTx,
				to: '0x20c0000000000000000000000000000000000002' as `0x${string}`, // Different TIP-20 address
			}
			const result = validatePaymentRequirements(
				tx,
				validTransfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('ASSET_MISMATCH')
		})

		it('rejects transaction with non-zero value', () => {
			const tx = {
				...validTx,
				value: 1n,
			}
			const result = validatePaymentRequirements(
				tx,
				validTransfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('NONZERO_VALUE')
		})

		it('rejects transfer recipient mismatch', () => {
			const transfer = {
				...validTransfer,
				recipient: '0x0000000000000000000000000000000000000001' as `0x${string}`,
			}
			const result = validatePaymentRequirements(
				validTx,
				transfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('RECIPIENT_MISMATCH')
		})

		it('rejects transfer amount mismatch', () => {
			const transfer = {
				...validTransfer,
				amount: 9999n, // Less than expected
			}
			const result = validatePaymentRequirements(
				validTx,
				transfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('AMOUNT_MISMATCH')
		})

		it('rejects chain ID mismatch', () => {
			const tx = {
				...validTx,
				chainId: 1, // Wrong chain
			}
			const result = validatePaymentRequirements(
				tx,
				validTransfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('CHAIN_ID_MISMATCH')
		})

		it('rejects invalid network format', () => {
			const requirements = {
				...validRequirements,
				network: 'invalid-network',
			}
			const result = validatePaymentRequirements(
				validTx,
				validTransfer,
				requirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('CHAIN_ID_MISMATCH')
			expect(result?.message).toContain('Invalid network format')
		})

		it('rejects fee payer as sender', () => {
			const tx = {
				...validTx,
				from: feePayerAddress,
			}
			const result = validatePaymentRequirements(
				tx,
				validTransfer,
				validRequirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('FEE_PAYER_CONFLICT')
			expect(result?.message).toContain('sender')
		})

		it('rejects fee payer as recipient', () => {
			const transfer = {
				...validTransfer,
				recipient: feePayerAddress,
			}
			const requirements = {
				...validRequirements,
				payTo: feePayerAddress,
			}
			const result = validatePaymentRequirements(
				validTx,
				transfer,
				requirements,
				feePayerAddress,
			)
			expect(result?.code).toBe('FEE_PAYER_CONFLICT')
			expect(result?.message).toContain('recipient')
		})
	})

	describe('decodeTransferCalldata', () => {
		it('decodes valid transfer calldata', () => {
			// transfer(0x209693Bc6afc0C5328bA36FaF03C514EF312287C, 10000)
			const validTransferData =
				'0xa9059cbb000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c0000000000000000000000000000000000000000000000000000000000002710'

			const result = decodeTransferCalldata(validTransferData)
			expect(result.ok).toBe(true)
			if (result.ok) {
				expect(result.value.recipient.toLowerCase()).toBe(
					'0x209693bc6afc0c5328ba36faf03c514ef312287c',
				)
				expect(result.value.amount).toBe(10000n)
			}
		})

		it('rejects wrong function selector', () => {
			// approve function selector instead of transfer
			const approveData =
				'0x095ea7b3000000000000000000000000209693bc6afc0c5328ba36faf03c514ef312287c0000000000000000000000000000000000000000000000000000000000002710'

			const result = decodeTransferCalldata(approveData)
			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.code).toBe('INVALID_FUNCTION_CALL')
				expect(result.error.message).toContain('Expected transfer function selector')
			}
		})

		it('rejects malformed calldata', () => {
			const result = decodeTransferCalldata('0xa9059cbb1234') // Too short
			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.code).toBe('INVALID_FUNCTION_CALL')
			}
		})

		it('rejects empty calldata', () => {
			const result = decodeTransferCalldata('0x')
			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.code).toBe('INVALID_FUNCTION_CALL')
			}
		})
	})

	describe('parseSignedTransaction', () => {
		it('rejects malformed transaction data', async () => {
			const result = await parseSignedTransaction('0x1234')
			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.code).toBe('INVALID_TRANSACTION')
			}
		})

		it('rejects empty transaction', async () => {
			const result = await parseSignedTransaction('0x')
			expect(result.ok).toBe(false)
			if (!result.ok) {
				expect(result.error.code).toBe('INVALID_TRANSACTION')
			}
		})

		// Note: Testing valid signed transactions would require creating
		// real signed transactions with viem, which is tested in integration tests
	})
})
