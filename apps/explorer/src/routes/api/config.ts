import { createFileRoute } from '@tanstack/react-router'

export const Route = createFileRoute('/api/config')({
	server: {
		handlers: {
			GET: async () => {
				const config = {
					chainName: process.env.VITE_CHAIN_NAME || 'OtterEVM',
					chainId: process.env.VITE_CHAIN_ID || '7447',
					rpcUrl: process.env.VITE_RPC_URL || '',
					expUrl: process.env.VITE_EXP_URL || '',
					nativeCurrency: process.env.VITE_NATIVE || 'OTTER',
					logoUrl: process.env.VITE_LOGO_URL || '/logo.svg',
				}
				return Response.json(config)
			},
		},
	},
})
