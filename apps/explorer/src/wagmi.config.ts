import { createIsomorphicFn, createServerFn } from '@tanstack/react-start'
import { getRequestHeader } from '@tanstack/react-start/server'
import { createPublicClient, http } from 'viem'
import { tempoLocalnet } from 'viem/chains'
import { tempoActions } from 'viem/tempo'
import { customChain, tempoOtterTestnet } from './lib/chains'
import {
	cookieStorage,
	cookieToInitialState,
	createConfig,
	createStorage,
	serialize,
} from 'wagmi'
import { KeyManager, webAuthn } from 'wagmi/tempo'

const OTTER_TESTNET_RPC = 'https://rpc.pakxe.otterevm.com/'

export type WagmiConfig = ReturnType<typeof getWagmiConfig>
let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

// Get chain from environment or use default
function getActiveChain() {
	const env = import.meta.env.VITE_TEMPO_ENV
	if (env === 'custom' || import.meta.env.VITE_CHAIN_NAME) {
		return customChain
	}
	return tempoOtterTestnet
}

function getActiveRpcUrl() {
	return import.meta.env.VITE_RPC_URL || OTTER_TESTNET_RPC
}

export const getTempoChain = createIsomorphicFn()
	.client(() => getActiveChain())
	.server(() => getActiveChain())

const getActiveTransport = createIsomorphicFn()
	.client(() => http(getActiveRpcUrl()))
	.server(() => http(getActiveRpcUrl()))

export function getWagmiConfig() {
	if (wagmiConfigSingleton) return wagmiConfigSingleton
	const chain = getTempoChain()
	const transport = getActiveTransport()

	wagmiConfigSingleton = createConfig({
		ssr: true,
		chains: [chain, tempoLocalnet],
		connectors: [
			webAuthn({
				keyManager: KeyManager.http('https://key-manager.tokenine.workers.dev'),
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
	const transport = getActiveTransport()

	return createPublicClient({ chain, transport }).extend(tempoActions())
}

declare module 'wagmi' {
	interface Register {
		config: ReturnType<typeof getWagmiConfig>
	}
}
