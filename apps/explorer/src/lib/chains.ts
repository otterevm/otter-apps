import { tempoModerato } from 'viem/chains'

export const tempoPresto = {
	...tempoModerato,
	id: 4217,
	name: 'Tempo Mainnet',
	blockExplorers: {
		default: { name: 'Tempo Explorer', url: 'https://explore.tempo.xyz' },
	},
	rpcUrls: {
		default: {
			http: ['https://rpc.presto.tempo.xyz'],
			webSocket: ['wss://rpc.presto.tempo.xyz'],
		},
	},
} as const

// Otter Testnet (Chain ID 7447)
export const tempoOtterTestnet = {
	...tempoModerato,
	id: 7447,
	name: 'Otter Testnet',
	rpcUrls: {
		default: {
			http: ['http://46.225.112.16:8545'],
		},
	},
	blockExplorers: {
		default: { name: 'Otter Explorer', url: 'http://localhost:3000' },
	},
} as const
