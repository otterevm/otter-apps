import { createServerFn } from '@tanstack/react-start'
import { getBlockNumber } from 'viem/actions'
import { getChainId } from 'wagmi/actions'
import { hasIndexSupply } from '#lib/env'
import { fetchLatestBlockNumber } from '#lib/server/tempo-queries'
import { getWagmiConfig } from '#wagmi.config'

export const fetchLatestBlock = createServerFn({ method: 'GET' }).handler(
	async () => {
		try {
			const config = getWagmiConfig()
			const chainId = getChainId(config)

			// For chains without indexer, fetch directly from RPC
			if (!hasIndexSupply()) {
				const client = config.getClient()
				return await getBlockNumber(client)
			}

			return await fetchLatestBlockNumber(chainId)
		} catch (error) {
			console.error('Failed to fetch latest block:', error)
			return 0n
		}
	},
)
