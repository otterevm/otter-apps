import {
	tempoDevnet,
	tempoLocalnet,
	tempoModerato,
	tempoAndantino,
} from 'wagmi/chains'
import { createConfig, fallback, http } from 'wagmi'

export const tempoPresto = {
	...tempoModerato,
	id: 4217,
	name: 'Tempo Mainnet',
	blockExplorers: {
		default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
	},
	rpcUrls: {
		default: {
			http: [process.env.TEMPO_MAINNET_RPC_URL],
		},
	},
} as const

export const wagmiConfig = createConfig({
	chains: [
		tempoDevnet,
		tempoPresto,
		tempoLocalnet,
		tempoModerato,
		tempoAndantino,
	],
	transports: {
		[tempoLocalnet.id]: fallback([
			http(tempoLocalnet.rpcUrls.default.http.at(0)),
		]),
		[tempoModerato.id]: fallback([
			http(tempoModerato.rpcUrls.default.http.at(0)),
		]),
		[tempoAndantino.id]: fallback([
			http(tempoAndantino.rpcUrls.default.http.at(0)),
		]),
		[tempoDevnet.id]: fallback([http(tempoDevnet.rpcUrls.default.http.at(0))]),
		[tempoPresto.id]: fallback([http(tempoPresto.rpcUrls.default.http.at(0))]),
	},
})

declare module 'wagmi' {
	interface Register {
		config: typeof wagmiConfig
	}
}
