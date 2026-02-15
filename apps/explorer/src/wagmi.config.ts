import { createIsomorphicFn, createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createPublicClient, http } from 'viem'
import { tempoLocalnet } from 'viem/chains'
import { tempoActions } from 'viem/tempo'
import { tempoOtterTestnet } from './lib/chains'
import {
	cookieStorage,
	cookieToInitialState,
	createConfig,
	createStorage,
	serialize,
} from 'wagmi'
import { KeyManager, webAuthn } from 'wagmi/tempo'

const OTTER_TESTNET_RPC = 'http://46.225.112.16:8545'

export type WagmiConfig = ReturnType<typeof getWagmiConfig>
let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

// Force Otter Testnet only
export const getTempoChain = createIsomorphicFn()
	.client(() => tempoOtterTestnet)
	.server(() => tempoOtterTestnet)

const getOtterTestnetTransport = createIsomorphicFn()
	.client(() => http(OTTER_TESTNET_RPC))
	.server(() => http(OTTER_TESTNET_RPC))

export function getWagmiConfig() {
	if (wagmiConfigSingleton) return wagmiConfigSingleton
	const chain = getTempoChain()
	const transport = getOtterTestnetTransport()

	wagmiConfigSingleton = createConfig({
		ssr: true,
		chains: [chain, tempoLocalnet],
		connectors: [
			webAuthn({
				keyManager: KeyManager.http('https://keys.tempo.xyz'),
			}),
		],
		storage: createStorage({ storage: cookieStorage }),
		transports: {
			[chain.id]: transport,
			[tempoLocalnet.id]: http(undefined, { batch: true }),
		} as never,
	})

	return wagmiConfigSingleton
}

export const getWagmiStateSSR = createServerFn().handler(() => {
	const cookie = getRequestHeader('cookie')
	const initialState = cookieToInitialState(getWagmiConfig(), cookie)
	return serialize(initialState || {})
})

// Batched HTTP client for bulk RPC operations
export function getBatchedClient() {
	const chain = getTempoChain()
	const transport = getOtterTestnetTransport()

	return createPublicClient({ chain, transport }).extend(tempoActions())
}

declare module 'wagmi' {
	interface Register {
		config: ReturnType<typeof getWagmiConfig>
	}
}
