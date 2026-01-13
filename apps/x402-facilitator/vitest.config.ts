import { join } from 'node:path'
import { defineWorkersConfig } from '@cloudflare/vitest-pool-workers/config'
import { Mnemonic } from 'ox'

const testMnemonic =
	'test test test test test test test test test test test junk'
const sponsorPrivateKey = Mnemonic.toPrivateKey(testMnemonic, {
	as: 'Hex',
	path: Mnemonic.path({ account: 0 }),
})

export default defineWorkersConfig({
	test: {
		include: ['**/test/*.test.ts', '**/*.test.ts'],
		poolOptions: {
			workers: {
				wrangler: { configPath: './wrangler.jsonc' },
				miniflare: {
					bindings: {
						ALLOWED_ORIGINS: '*',
						SPONSOR_PRIVATE_KEY: sponsorPrivateKey,
						TEMPO_RPC_URL: 'https://rpc.testnet.tempo.xyz',
						TEMPO_ENV: 'testnet',
						FEE_TOKEN: '0x20c0000000000000000000000000000000000001',
					},
				},
			},
		},
	},
})
