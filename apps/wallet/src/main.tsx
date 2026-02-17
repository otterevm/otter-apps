import React from 'react'
import ReactDOM from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { WagmiProvider } from 'wagmi'
import { getWagmiConfig } from '#wagmi.config'
import { ThemeProvider } from '#lib/theme'
import { BlockNumberProvider } from '#lib/block-number'
import App from './App'
import './styles.css'

const queryClient = new QueryClient()
const wagmiConfig = getWagmiConfig()

ReactDOM.createRoot(document.getElementById('root')!).render(
	<React.StrictMode>
		<WagmiProvider config={wagmiConfig}>
			<QueryClientProvider client={queryClient}>
				<ThemeProvider>
					<BlockNumberProvider>
						<App />
					</BlockNumberProvider>
				</ThemeProvider>
			</QueryClientProvider>
		</WagmiProvider>
	</React.StrictMode>,
)
