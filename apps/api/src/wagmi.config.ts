import { Address } from 'ox'
import * as z from 'zod/mini'
import { createConfig, fallback, http } from 'wagmi'
import { tempoDevnet as tempoDevnet_, tempoModerato as tempoTestnet_ } from 'wagmi/chains'

const PATH_USD = '0x20c0000000000000000000000000000000000000'
const ALPHA_USD = '0x20c0000000000000000000000000000000000001'

const tempoDevnet = tempoDevnet_.extend({ feeToken: ALPHA_USD })
const tempoTestnet = tempoTestnet_.extend({ feeToken: ALPHA_USD })
const tempoMainnet = {
	...tempoTestnet_.extend({ feeToken: PATH_USD }),
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

const batchHttp = (url: string | undefined) => http(url, { batch: { batchSize: 100, wait: 10 } })

export const supportedChainIds = [tempoDevnet.id, tempoMainnet.id, tempoTestnet.id] as const

export const supportedChains = {
	[tempoDevnet.id]: tempoDevnet,
	[tempoMainnet.id]: tempoMainnet,
	[tempoTestnet.id]: tempoTestnet,
} as const

export const wagmiConfig = createConfig({
	chains: [tempoDevnet, tempoMainnet, tempoTestnet],
	transports: {
		[tempoTestnet.id]: fallback([
			batchHttp(process.env.TEMPO_TESTNET_RPC_URL ?? tempoTestnet.rpcUrls.default.http.at(0)),
		]),
		[tempoDevnet.id]: fallback([batchHttp(tempoDevnet.rpcUrls.default.http.at(0))]),
		[tempoMainnet.id]: fallback([batchHttp(tempoMainnet.rpcUrls.default.http.at(0))]),
	},
})

export const zAddress = (opts?: { lowercase?: boolean }) =>
	z.pipe(
		z.string(),
		z.transform((x) => {
			if (opts?.lowercase) x = x.toLowerCase()
			Address.assert(x)
			return x
		}),
	)

export const zChainId = () =>
	z.pipe(z.coerce.number(), z.union(wagmiConfig.chains.map((chain) => z.literal(chain.id))))

declare module 'wagmi' {
	interface Register {
		config: typeof wagmiConfig
	}
}
