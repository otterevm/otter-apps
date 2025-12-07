import { loaders, whatsabi } from '@shazow/whatsabi'
import { queryOptions, useQuery } from '@tanstack/react-query'
import type { AbiFunction } from 'abitype'
import { type Abi, type Address, type Hex, getAbiItem as getAbiItem_viem, stringify } from 'viem'
import { getPublicClient } from 'wagmi/actions'
import { config } from '#wagmi.config'

export function useAutoloadAbi(args: {
	address?: Address | null
	enabled?: boolean
}) {
	const { address, enabled } = args
	const client = getPublicClient(config)

	return useQuery(
		queryOptions({
			enabled: enabled && Boolean(address) && Boolean(client),
			gcTime: Number.POSITIVE_INFINITY,
			staleTime: Number.POSITIVE_INFINITY,
			queryKey: ['autoload-abi', address],
			async queryFn() {
				if (!address) throw new Error('address is required')
				if (!client) throw new Error('client is required')

				const result = await whatsabi.autoload(address, {
					provider: client,
					followProxies: true,
					abiLoader: new loaders.MultiABILoader([
						new loaders.SourcifyABILoader({
							chainId: client.chain?.id,
						}),
					]),
				})

				if (!result.abi.some((item) => (item as { name?: string }).name))
					return null

				return result.abi.map((abiItem) => ({
					...abiItem,
					outputs:
						'outputs' in abiItem && abiItem.outputs ? abiItem.outputs : [],
				}))
			},
		}),
	)
}

export function useLookupSignature(args: {
	enabled?: boolean
	selector?: Hex
}) {
	const { enabled = true, selector } = args

	return useQuery(
		queryOptions({
			enabled: enabled && Boolean(selector),
			gcTime: Number.POSITIVE_INFINITY,
			staleTime: Number.POSITIVE_INFINITY,
			queryKey: ['lookup-signature', selector],
			async queryFn() {
				if (!selector) throw new Error('selector is required')

				const signature =
					selector.length === 10
						? await loaders.defaultSignatureLookup.loadFunctions(selector)
						: await loaders.defaultSignatureLookup.loadEvents(selector)

				return signature[0] ?? null
			},
		}),
	)
}

export function getAbiItem({
	abi,
	selector,
}: {
	abi: Abi
	selector: Hex
}): AbiFunction | undefined {
	const abiItem =
		(getAbiItem_viem({
			abi: abi.map((x) => ({
				...x,
				inputs: (x as AbiFunction).inputs || [],
				outputs: (x as AbiFunction).outputs || [],
			})),
			name: selector,
		}) as AbiFunction) ||
		abi.find((x) => (x as AbiFunction).name === selector) ||
		abi.find((x) => (x as { selector?: string }).selector === selector)

	if (!abiItem) return

	return {
		...abiItem,
		outputs: abiItem.outputs || [],
		inputs: abiItem.inputs || [],
		name: abiItem.name || (abiItem as { selector?: string }).selector || '',
	} as AbiFunction
}

export function formatAbiValue(value: unknown): string {
	if (typeof value === 'bigint') {
		return value.toString()
	}
	if (Array.isArray(value)) {
		return `[${value.map(formatAbiValue).join(', ')}]`
	}
	if (typeof value === 'object' && value !== null) {
		return stringify(value)
	}
	return String(value ?? '')
}
