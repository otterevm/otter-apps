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
	name: 'Pakxe',
	nativeCurrency: {
		name: 'Otter',
		symbol: 'OTTER',
		decimals: 6,
	},
	rpcUrls: {
		default: {
			http: ['https://rpc.pakxe.otterevm.com/'],
		},
	},
	blockExplorers: {
		default: { name: 'Otter Explorer', url: 'http://localhost:3000' },
	},
} as const

// Custom chain from environment variables
function getCustomChain() {
	const chainName = import.meta.env.VITE_CHAIN_NAME || 'Custom Chain'
	const chainId = Number(import.meta.env.VITE_CHAIN_ID || '7447')
	const rpcUrl =
		import.meta.env.VITE_RPC_URL || 'https://rpc.pakxe.otterevm.com/'

	return {
		...tempoModerato,
		id: chainId,
		name: chainName,
		nativeCurrency: {
			name: 'Otter',
			symbol: 'OTTER',
			decimals: 6,
		},
		rpcUrls: {
			default: {
				http: [rpcUrl],
			},
		},
		blockExplorers: {
			default: { name: `${chainName} Explorer`, url: 'http://localhost:3000' },
		},
	} as const
}

export const customChain = getCustomChain()
