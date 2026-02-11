import { defineConfig } from 'vitest/config'

export default defineConfig({
	test: {
		include: ['test/**/*.test.ts'],
	},
	define: {
		__BUILD_VERSION__: JSON.stringify('dev'),
	},
})
