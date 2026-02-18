import { QueryClient } from '@tanstack/react-query'
import { http } from 'viem'
import { createConfig } from 'wagmi'
import { KeyManager, webAuthn } from 'wagmi/tempo'

const OTTER_TESTNET_RPC = 'https://rpc.pakxe.otterevm.com/'

// Otter Testnet chain configuration (Chain ID from RPC: 7447)
const tempoOtterTestnet = {
	id: 7447,
	name: 'Otter Testnet',
	nativeCurrency: { name: 'USD', symbol: 'USD', decimals: 18 },
	rpcUrls: {
		default: { http: [OTTER_TESTNET_RPC] },
	},
	blockExplorers: {
		default: { name: 'Otter Explorer', url: 'https://exp.pakxe.otterevm.com' },
	},
	testnet: true,
} as const

export const queryClient = new QueryClient()

export const config = createConfig({
	connectors: [
		webAuthn({
			keyManager: KeyManager.http('https://key-manager.tokenine.workers.dev'),
			// Force platform authenticator (Touch ID/Face ID) - no QR code
			createOptions: {
				// @ts-expect-error - authenticatorSelection is supported at runtime
				authenticatorSelection: {
					authenticatorAttachment: 'platform',
					userVerification: 'required',
				},
			},
		}),
	],
	chains: [tempoOtterTestnet],
	transports: {
		[tempoOtterTestnet.id]: http(OTTER_TESTNET_RPC),
	},
})

declare module 'wagmi' {
	interface Register {
		config: typeof config
	}
}
