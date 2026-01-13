import { z } from 'zod'

// Strict hex address validation (40 hex chars after 0x)
const hexAddress = z
	.string()
	.regex(/^0x[a-fA-F0-9]{40}$/, 'Invalid hex address format')

// TIP-20 address validation (must start with 0x20c000000)
const tip20Address = z
	.string()
	.regex(
		/^0x20c000000[a-fA-F0-9]{31}$/i,
		'Invalid TIP-20 address format (must start with 0x20c000000)',
	)

// Generic hex string validation
const hexString = z
	.string()
	.regex(/^0x[a-fA-F0-9]+$/, 'Invalid hex string format')

// Network format validation (eip155:chainId)
const network = z
	.string()
	.regex(/^eip155:\d+$/, 'Invalid network format (expected eip155:chainId)')

// Positive integer string (for amounts)
const positiveIntString = z
	.string()
	.regex(/^\d+$/, 'Amount must be a positive integer string')

export const paymentRequirementsSchema = z.object({
	scheme: z.literal('exact'),
	network: network,
	amount: positiveIntString,
	asset: tip20Address,
	payTo: hexAddress,
	maxTimeoutSeconds: z.number().positive().int(),
	extra: z
		.object({
			name: z.string().optional(),
			decimals: z.number().int().min(0).max(18).optional(),
		})
		.optional(),
})

export const paymentPayloadSchema = z.object({
	x402Version: z.literal(2),
	resource: z.object({
		url: z.string().url(),
		description: z.string().min(1).max(500),
		mimeType: z.string().min(1),
	}),
	accepted: paymentRequirementsSchema,
	payload: z.object({
		signedTransaction: hexString,
	}),
	// Optional timestamp for timeout validation
	createdAt: z.number().int().positive().optional(),
})

export type PaymentPayloadInput = z.infer<typeof paymentPayloadSchema>
