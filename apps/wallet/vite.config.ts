import tailwindcss from '@tailwindcss/vite'
import react from '@vitejs/plugin-react'
import Icons from 'unplugin-icons/vite'
import { defineConfig } from 'vite'

export default defineConfig({
	plugins: [
		react(),
		tailwindcss(),
		Icons({
			compiler: 'jsx',
			jsx: 'react',
			autoInstall: true,
		}),
	],
	build: {
		outDir: 'dist',
		emptyOutDir: true,
	},
	resolve: {
		alias: {
			'#': '/src',
		},
	},
})
