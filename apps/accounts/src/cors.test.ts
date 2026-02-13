import { Hono } from 'hono'
import { describe, expect, it } from 'vitest'
import { cors } from './cors'

function createApp(isDev = false) {
	const app = new Hono()
	app.use('*', cors(isDev))
	app.get('/test', (c) => c.json({ ok: true }))
	app.post('/test', (c) => c.json({ ok: true }))
	return app
}

describe('cors', () => {
	it('allows https://tempo.xyz', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'https://tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://tempo.xyz',
		)
		expect(res.headers.get('access-control-allow-credentials')).toBe('true')
	})

	it('allows https://app.tempo.xyz', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'https://app.tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://app.tempo.xyz',
		)
	})

	it('allows https://sub.app.tempo.xyz (3 levels)', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'https://sub.app.tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'https://sub.app.tempo.xyz',
		)
	})

	it('blocks https://a.b.c.tempo.xyz (5 parts)', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'https://a.b.c.tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('blocks https://evil-tempo.xyz', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'https://evil-tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('blocks http://tempo.xyz (non-https)', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			headers: { origin: 'http://tempo.xyz' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('allows localhost in dev mode', async () => {
		const app = createApp(true)
		const res = await app.request('/test', {
			headers: { origin: 'http://localhost:3000' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBe(
			'http://localhost:3000',
		)
	})

	it('blocks localhost in production', async () => {
		const app = createApp(false)
		const res = await app.request('/test', {
			headers: { origin: 'http://localhost:3000' },
		})
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})

	it('handles OPTIONS preflight', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			method: 'OPTIONS',
			headers: { origin: 'https://tempo.xyz' },
		})
		expect(res.status).toBe(204)
		expect(res.headers.get('access-control-allow-methods')).toBe('GET, POST')
		expect(res.headers.get('access-control-allow-headers')).toBe('Content-Type')
	})

	it('OPTIONS without valid origin returns 204 without CORS headers', async () => {
		const app = createApp()
		const res = await app.request('/test', {
			method: 'OPTIONS',
			headers: { origin: 'https://evil.com' },
		})
		expect(res.status).toBe(204)
		expect(res.headers.get('access-control-allow-origin')).toBeNull()
	})
})
