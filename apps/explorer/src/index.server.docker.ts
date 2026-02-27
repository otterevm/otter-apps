import handler, { createServerEntry } from '@tanstack/react-start/server-entry'
import * as Sentry from '@sentry/node'

export const RPC_AUTH_COOKIE = 'rpc_auth'

export const redirects: Array<{
	from: RegExp
	to: (match: RegExpMatchArray) => string
}> = [
	{ from: /^\/blocks\/(latest|\d+)$/, to: (m) => `/block/${m[1]}` },
	{ from: /^\/transaction\/(.+)$/, to: (m) => `/tx/${m[1]}` },
	{ from: /^\/tokens\/(.+)$/, to: (m) => `/token/${m[1]}` },
]

function normalizeApiPath(pathname: string): string {
	return pathname
		.replace(/\/0x[a-fA-F0-9]+/g, '/:hash')
		.replace(/\/\d+/g, '/:id')
}

const SENSITIVE_HEADERS = new Set([
	'authorization',
	'cookie',
	'set-cookie',
	'x-api-key',
	'x-forwarded-for',
])

const SENSITIVE_QUERY_PARAMS = ['auth', 'token', 'apikey', 'api_key', 'key']

function redactHeaders(
	headers: Record<string, string> | undefined,
): Record<string, string> | undefined {
	if (!headers) return headers
	return Object.fromEntries(
		Object.entries(headers).map(([key, value]) => [
			key,
			SENSITIVE_HEADERS.has(key.toLowerCase()) ? '[Filtered]' : value,
		]),
	)
}

function sanitizeUrl(rawUrl: string): string {
	try {
		const url = new URL(rawUrl)
		for (const param of SENSITIVE_QUERY_PARAMS) {
			url.searchParams.delete(param)
		}
		return url.toString()
	} catch {
		return rawUrl
	}
}

function getRpcAuthFromCookie(request: Request): string | null {
	const cookies = request.headers.get('cookie')
	if (!cookies) return null
	const prefix = `${RPC_AUTH_COOKIE}=`
	const cookie = cookies.split('; ').find((c) => c.startsWith(prefix))
	if (!cookie) return null
	return `Basic ${cookie.slice(prefix.length)}`
}

function handleAuthParam(request: Request): Response | null {
	const url = new URL(request.url)
	const auth = url.searchParams.get('auth')
	if (!auth) return null

	url.searchParams.delete('auth')
	return new Response(null, {
		status: 302,
		headers: {
			Location: url.toString(),
			'Set-Cookie': `${RPC_AUTH_COOKIE}=${auth.includes(':') ? btoa(auth) : auth}; Path=/; HttpOnly; SameSite=Lax; Max-Age=31536000`,
		},
	})
}

async function checkRpcAuth(request: Request): Promise<Response | null> {
	if (process.env.FORWARD_RPC_AUTH !== '1') return null

	const rpcUrl = process.env.VITE_TEMPO_RPC_HTTP
	if (!rpcUrl) return null

	const unauthorized = new Response('Unauthorized', {
		status: 401,
		headers: { 'WWW-Authenticate': 'Basic realm="Explorer"' },
	})

	const authHeader =
		request.headers.get('Authorization') ?? getRpcAuthFromCookie(request)
	if (!authHeader) return unauthorized

	try {
		const response = await fetch(rpcUrl, {
			method: 'POST',
			headers: {
				'Content-Type': 'application/json',
				Authorization: authHeader,
			},
			body: JSON.stringify({
				jsonrpc: '2.0',
				method: 'eth_chainId',
				params: [],
				id: 1,
			}),
		})
		if (!response.ok) return unauthorized
	} catch {
		return unauthorized
	}

	return null
}

// Initialize Sentry if DSN is provided
function initSentry() {
	const dsn = process.env.SENTRY_DSN
	if (!dsn) return

	Sentry.init({
		dsn,
		release: process.env.BUILD_VERSION || 'unknown',
		tracesSampleRate: process.env.SENTRY_TRACES_SAMPLE_RATE
			? Number(process.env.SENTRY_TRACES_SAMPLE_RATE)
			: 0.1,
		sendDefaultPii: false,
		beforeSend: (event) => {
			if (event.request?.url) {
				event.request.url = sanitizeUrl(event.request.url)
			}
			if (event.request?.headers) {
				event.request.headers = redactHeaders(event.request.headers)
			}
			return event
		},
		beforeSendTransaction: (event) => {
			if (event.request?.url) {
				const url = new URL(sanitizeUrl(event.request.url))
				if (url.pathname.startsWith('/api/')) {
					event.transaction = `${event.request.method ?? 'GET'} ${normalizeApiPath(url.pathname)}`
				}
			}
			if (event.request?.headers) {
				event.request.headers = redactHeaders(event.request.headers)
			}
			return event
		},
	})
}

initSentry()

const serverEntry = createServerEntry({
	fetch: async (request, opts) => {
		const authParamResponse = handleAuthParam(request)
		if (authParamResponse) return authParamResponse

		const authResponse = await checkRpcAuth(request)
		if (authResponse) return authResponse

		const url = new URL(request.url)

		for (const { from, to } of redirects) {
			const match = url.pathname.match(from)
			if (match) {
				url.pathname = to(match)
				return Response.redirect(url, 301)
			}
		}

		return handler.fetch(request, opts)
	},
})

// Export สำหรับ Nitro/Node.js
export default {
	fetch: (request: Request) => {
		return Sentry.wrapRequestHandler(() => serverEntry.fetch(request, undefined))(request)
	},
}
