import { testClient } from 'hono/testing'
import { describe, it, expect } from 'vitest'

import app from '#index.tsx'

describe('Basic API Endpoints', () => {
	const client = testClient(app)

	it('should respond to /ping', async () => {
		const response = await client.ping.$get()
		expect(response.status).toBe(200)
		expect(await response.text()).toBe('pong')
	})

	it('should respond to /health', async () => {
		const response = await client.health.$get()
		expect(response.status).toBe(200)
		expect(await response.text()).toBe('ok')
	})

	it('should redirect / to /docs', async () => {
		const response = await client.index.$get('/')
		expect(response.status).toBe(302)
		expect(response.headers.get('Location')).toBe('/docs')
	})

	it('should return OpenAPI spec at /schema/openapi and /schema/openapi.json', async () => {
		const response1 = await client.schema.openapi.$get()
		expect(response1.status).toBe(200)
		const spec1 = await response1.json()

		const response2 = await client.schema['openapi.json'].$get()
		expect(response2.status).toBe(200)
		const spec2 = await response2.json()

		expect(spec1).toEqual(spec2)
	})

	it('should return html for /docs', async () => {
		const response = await client.docs.$get()
		expect(response.status).toBe(200)
		expect(response.headers.get('Content-Type')).toContain('text/html')
		const text = await response.text()
		expect(text).toContain('<main id="app"></main>')
	})

	it('should return version info at /version', async () => {
		const response = await client.version.$get()
		expect(response.status).toBe(200)
		const data = await response.json()
		expect(data).toHaveProperty('timestamp')
		expect(data).toHaveProperty('rev')
		expect(data).toHaveProperty('url')
		expect(data).toHaveProperty('chains')
		expect(Array.isArray(data.chains)).toBe(true)
		expect(data).toHaveProperty('source')
	})
})

describe('gecko')
