import { createPublicClient, http } from 'viem'
import { tempoLocalnet } from 'viem/chains'
import { tempoActions } from 'viem/tempo'
import {
	cookieStorage,
	createConfig,
	createStorage,
} from 'wagmi'
import { KeyManager, webAuthn } from 'wagmi/tempo'

const OTTER_TESTNET_RPC = 'https://rpc.pakxe.otterevm.com/'

// Otter Testnet chain configuration
const tempoOtterTestnet = {
	id: 4217,
	name: 'Otter Testnet',
	nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
	rpcUrls: {
		default: { http: [OTTER_TESTNET_RPC] },
	},
	blockExplorers: {
		default: { name: 'Otter Explorer', url: 'https://explore.otterevm.com' },
	},
	testnet: true,
} as const

export type WagmiConfig = ReturnType<typeof getWagmiConfig>
let wagmiConfigSingleton: ReturnType<typeof createConfig> | null = null

export function getWagmiConfig() {
	if (wagmiConfigSingleton) return wagmiConfigSingleton

	wagmiConfigSingleton = createConfig({
		chains: [tempoOtterTestnet, tempoLocalnet],
		connectors: [
			webAuthn({
				keyManager: KeyManager.http('https://key-manager.tokenine.workers.dev'),
			}),
		],
		storage: createStorage({ storage: cookieStorage }),
		transports: {
			[tempoOtterTestnet.id]: http(OTTER_TESTNET_RPC),
			[tempoLocalnet.id]: http(undefined, { batch: true }),
		} as never,
	})

	return wagmiConfigSingleton
}

// Batched HTTP client for bulk RPC operations
export function getBatchedClient() {
	return createPublicClient({
		chain: tempoOtterTestnet,
		transport: http(OTTER_TESTNET_RPC),
	}).extend(tempoActions())
}

declare module 'wagmi' {
	interface Register {
		config: ReturnType<typeof getWagmiConfig>
	}
}
