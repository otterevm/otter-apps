import { queryOptions, useQuery } from '@tanstack/react-query'
import type { Address, Hex } from 'viem'
import { Actions } from 'wagmi/tempo'
import type { Config } from 'wagmi'
import { autoloadAbi, lookupSignature } from '#lib/domain/contracts'
import { getApiUrl } from '#lib/env.ts'
import { getWagmiConfig } from '#wagmi.config.ts'
import type { BatchAbiResponse } from '#routes/api/abi/batch'

export function autoloadAbiQueryOptions(args: { address?: Address | null }) {
	const { address } = args

	return queryOptions({
		enabled: Boolean(address),
		gcTime: Number.POSITIVE_INFINITY,
		staleTime: Number.POSITIVE_INFINITY,
		queryKey: ['autoload-abi', address?.toLowerCase()],
		queryFn: () => autoloadAbi(address as Address),
	})
}

/**
 * Batch fetch ABIs and signatures for multiple addresses/selectors.
 * Use this instead of multiple individual queries for better performance.
 */
export function batchAbiQueryOptions(args: {
	addresses: Address[]
	selectors: Hex[]
}) {
	const { addresses, selectors } = args

	// Create stable query key from sorted, deduplicated values
	const sortedAddresses = [...new Set(addresses)].sort()
	const sortedSelectors = [...new Set(selectors)].sort()

	return queryOptions({
		enabled: sortedAddresses.length > 0 || sortedSelectors.length > 0,
		gcTime: Number.POSITIVE_INFINITY,
		staleTime: Number.POSITIVE_INFINITY,
		queryKey: ['batch-abi', sortedAddresses, sortedSelectors],
		queryFn: async (): Promise<BatchAbiResponse> => {
			const response = await fetch(getApiUrl('/api/abi/batch'), {
				method: 'POST',
				headers: { 'Content-Type': 'application/json' },
				body: JSON.stringify({
					addresses: sortedAddresses,
					selectors: sortedSelectors,
				}),
			})

			if (!response.ok) {
				throw new Error('Failed to fetch batch ABI data')
			}

			return response.json()
		},
	})
}

/**
 * Populate the query cache with individual ABI/signature entries from a batch response.
 * Call this after fetching batch data to enable cache hits for individual lookups.
 */
export function populateCacheFromBatch(
	queryClient: {
		setQueryData: (key: unknown[], data: unknown) => void
	},
	batchData: BatchAbiResponse,
) {
	// Populate individual ABI cache entries
	for (const [address, abi] of Object.entries(batchData.abis)) {
		queryClient.setQueryData(['autoload-abi', address.toLowerCase()], abi)
	}

	// Populate individual signature cache entries
	for (const [selector, signature] of Object.entries(batchData.signatures)) {
		queryClient.setQueryData(['lookup-signature', selector], signature)
	}
}

export function useAutoloadAbi(args: {
	address?: Address | null
	enabled?: boolean
}) {
	const { address, enabled } = args
	const options = autoloadAbiQueryOptions({ address })

	return useQuery({
		...options,
		enabled: enabled && options.enabled,
	})
}

export function lookupSignatureQueryOptions(args: { selector?: Hex }) {
	const { selector } = args

	return queryOptions({
		enabled: Boolean(selector),
		gcTime: Number.POSITIVE_INFINITY,
		staleTime: Number.POSITIVE_INFINITY,
		queryKey: ['lookup-signature', selector],
		queryFn: () => lookupSignature(selector as Hex),
	})
}

export function useLookupSignature(args: {
	enabled?: boolean
	selector?: Hex
}) {
	const { enabled = true, selector } = args
	const options = lookupSignatureQueryOptions({ selector })

	return useQuery({
		...options,
		enabled: enabled && options.enabled,
	})
}

// ============================================================================
// TIP-20 Token Metadata
// ============================================================================

export type Tip20Metadata = Actions.token.getMetadata.ReturnValue

/**
 * Query options for fetching TIP-20 token metadata (name, symbol, decimals)
 * Fetches dynamically from the blockchain instead of using hardcoded values
 */
export function tip20MetadataQueryOptions(args: { address?: Address | null }) {
	const { address } = args

	return queryOptions({
		enabled: Boolean(address),
		gcTime: 5 * 60 * 1000, // 5 minutes
		staleTime: 60 * 1000, // 1 minute
		queryKey: ['tip20-metadata', address?.toLowerCase()],
		queryFn: async (): Promise<Tip20Metadata | null> => {
			if (!address) return null
			const config = getWagmiConfig()
			return Actions.token.getMetadata(config as Config, { token: address })
		},
	})
}

/**
 * Hook for fetching TIP-20 token metadata
 */
export function useTip20Metadata(args: {
	address?: Address | null
	enabled?: boolean
}) {
	const { address, enabled = true } = args
	const options = tip20MetadataQueryOptions({ address })

	return useQuery({
		...options,
		enabled: enabled && options.enabled,
	})
}

/**
 * Batch fetch TIP-20 metadata for multiple addresses
 */
export function batchTip20MetadataQueryOptions(args: { addresses: Address[] }) {
	const { addresses } = args
	const uniqueAddresses = [...new Set(addresses.map((a) => a.toLowerCase()))]

	return queryOptions({
		enabled: uniqueAddresses.length > 0,
		gcTime: 5 * 60 * 1000, // 5 minutes
		staleTime: 60 * 1000, // 1 minute
		queryKey: ['batch-tip20-metadata', uniqueAddresses],
		queryFn: async (): Promise<Map<string, Tip20Metadata>> => {
			const config = getWagmiConfig()
			const results = await Promise.all(
				uniqueAddresses.map(async (address) => {
					try {
						const metadata = await Actions.token.getMetadata(config as Config, {
							token: address as Address,
						})
						return [address, metadata] as const
					} catch {
						return [address, null] as const
					}
				}),
			)
			return new Map(
				results.filter(([, m]) => m !== null) as [string, Tip20Metadata][],
			)
		},
	})
}
