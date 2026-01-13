import { env } from 'cloudflare:workers'
import { tempoDevnet, tempoModerato, tempoTestnet } from 'viem/chains'

const chains = {
	devnet: tempoDevnet,
	moderato: tempoModerato,
	testnet: tempoTestnet,
}

type TempoEnv = keyof typeof chains

export const tempoChain = (
	chains[(env as { TEMPO_ENV: TempoEnv }).TEMPO_ENV] ?? tempoTestnet
).extend({
	feeToken: (env as { FEE_TOKEN: string }).FEE_TOKEN as `0x${string}`,
})
