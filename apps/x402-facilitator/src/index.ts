import { env } from 'cloudflare:workers'
import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { createPublicClient, http, type PublicClient } from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import { tempoChain } from './lib/chain'
import { rateLimitMiddleware } from './lib/rate-limit'
import verifyRoute from './routes/verify'
import settleRoute from './routes/settle'
import supportedRoute from './routes/supported'

// Type assertion for cloudflare env
const cfEnv = env as {
	ALLOWED_ORIGINS: string
	SPONSOR_PRIVATE_KEY: string
	TEMPO_RPC_URL?: string
}

const app = new Hono()

// Request ID middleware for tracing
app.use('*', async (c, next) => {
	const requestId =
		c.req.header('x-request-id') ??
		`${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 9)}`
	c.set('requestId', requestId)
	c.header('x-request-id', requestId)
	await next()
})

// CORS middleware
app.use(
	'*',
	cors({
		origin: (origin) => {
			const allowedOrigins = cfEnv.ALLOWED_ORIGINS
			if (allowedOrigins === '*') return '*'
			if (origin && allowedOrigins.includes(origin)) return origin
			return null
		},
		allowMethods: ['GET', 'POST', 'OPTIONS'],
		allowHeaders: ['Content-Type', 'Authorization', 'X-Request-ID'],
		exposeHeaders: ['X-Request-ID'],
		maxAge: 86400,
	}),
)

// Initialize dependencies middleware
app.use('*', async (c, next) => {
	const feePayerAccount = privateKeyToAccount(
		cfEnv.SPONSOR_PRIVATE_KEY as `0x${string}`,
	)
	const rpcUrl = cfEnv.TEMPO_RPC_URL ?? tempoChain.rpcUrls.default.http[0]

	const viemClient = createPublicClient({
		chain: tempoChain,
		transport: http(rpcUrl),
	})

	c.set('feePayerAccount', feePayerAccount)
	c.set('feePayerAddress', feePayerAccount.address)
	c.set('viemClient', viemClient as PublicClient)
	c.set('network', tempoChain)
	c.set('rpcUrl', rpcUrl)

	await next()
})

// Rate limiting
app.use('*', rateLimitMiddleware)

// Routes
app.route('/verify', verifyRoute)
app.route('/settle', settleRoute)
app.route('/supported', supportedRoute)

// Health check
app.get('/health', (c) => {
	const feePayerAddress = c.get('feePayerAddress')
	const rpcUrl = c.get('rpcUrl')
	const requestId = c.get('requestId')

	return c.json({
		status: 'ok',
		timestamp: new Date().toISOString(),
		requestId,
		facilitator: {
			address: feePayerAddress,
			rpcUrl: rpcUrl,
		},
	})
})

export default app
