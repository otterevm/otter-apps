interface Env {
	readonly PORT: string

	readonly DEFILLAMA_API_KEY: string
	readonly INDEX_SUPPLY_API_KEY: string
	readonly TEMPO_MAINNET_RPC_URL: string
}

declare namespace NodeJS {
	interface ProcessEnv extends Env {
		readonly NODE_ENV: 'development' | 'production' | 'test'
	}
}

interface ImportMetaEnv extends Env {}

interface ImportMeta {
	readonly env: ImportMetaEnv
}

declare const __BASE_URL__: string
declare const __BUILD_VERSION__: string
