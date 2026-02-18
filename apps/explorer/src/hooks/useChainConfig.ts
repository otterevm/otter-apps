import { useQuery } from '@tanstack/react-query'

export type ChainConfig = {
	chainName: string
	chainId: string
	rpcUrl: string
	expUrl: string
	nativeCurrency: string
	logoUrl: string
}

async function fetchConfig(): Promise<ChainConfig> {
	const res = await fetch('/api/config')
	if (!res.ok) {
		throw new Error('Failed to fetch chain config')
	}
	return res.json()
}

export function useChainConfig() {
	return useQuery<ChainConfig>({
		queryKey: ['chain-config'],
		queryFn: fetchConfig,
		staleTime: Infinity,
	})
}
