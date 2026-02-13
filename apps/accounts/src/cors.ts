import type { Context, Next } from 'hono'

function isValidOrigin(origin: string, isDev: boolean): boolean {
	let url: URL
	try {
		url = new URL(origin)
	} catch {
		return false
	}

	if (isDev && url.hostname === 'localhost') return true

	const hostname = url.hostname
	if (url.protocol !== 'https:') return false
	if (hostname === 'tempo.xyz') return true
	if (hostname.endsWith('.tempo.xyz') && hostname.split('.').length <= 4)
		return true

	return false
}

export function cors(isDev = false) {
	return async (c: Context<{ Bindings: CloudflareBindings }>, next: Next) => {
		const origin = c.req.header('origin')

		if (c.req.method === 'OPTIONS') {
			if (origin && isValidOrigin(origin, isDev)) {
				return new Response(null, {
					status: 204,
					headers: {
						'Access-Control-Allow-Origin': origin,
						'Access-Control-Allow-Methods': 'GET, POST',
						'Access-Control-Allow-Headers': 'Content-Type',
						'Access-Control-Allow-Credentials': 'true',
						'Access-Control-Max-Age': '86400',
					},
				})
			}
			return new Response(null, { status: 204 })
		}

		await next()

		if (origin && isValidOrigin(origin, isDev)) {
			c.res.headers.set('Access-Control-Allow-Origin', origin)
			c.res.headers.set('Access-Control-Allow-Credentials', 'true')
		}
	}
}
