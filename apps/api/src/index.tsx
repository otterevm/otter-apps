import { Hono } from 'hono'
import { cors } from 'hono/cors'
import { some } from 'hono/combine'
import { showRoutes } from 'hono/dev'
import { HTTPException } from 'hono/http-exception'

import { Docs } from '#route.docs.tsx'
import { geckoApp } from '#route.gecko.ts'
import { tokensApp } from '#route.tokens.tsx'
import { wagmiConfig } from '#wagmi.config.ts'
import { actionsApp } from '#route.actions.tsx'
import OpenAPISpec from '#schema/openapi.json' with { type: 'json' }

const app = new Hono<{ Bindings: Cloudflare.Env }>()

app.use('*', cors())

app
	.get('/ping', (context) => context.text('pong'))
	.get('/health', (context) => context.text('ok'))
	.get('/', (context) => context.redirect('/docs'))
	.get('/schema/openapi', (context) => context.json(OpenAPISpec))
	.get('/schema/openapi.json', (context) => context.json(OpenAPISpec))
	.get('/docs', (context) => context.html(<Docs baseUrl={new URL(context.req.url).origin} />))
	.get('/version', (context) =>
		context.json({
			timestamp: Date.now(),
			rev: __BUILD_VERSION__,
			url: new URL(context.req.url).origin,
			chains: wagmiConfig.chains.map((_) => _.id),
			source: 'https://github.com/tempoxyz/tempo-apps/apps/api',
		}),
	)

app.use(
	'*',
	some(
		// query param auth (?key=<token>)
		async (context, next) => {
			const key = context.req.query('key')
			if (key !== process.env.API_KEY) throw new HTTPException(401, { message: 'Unauthorized' })
			return await next()
		},
		// header auth (X-Tempo-API-Key: <token>)
		async (context, next) => {
			const key = context.req.header('X-Tempo-API-Key')
			if (key !== process.env.API_KEY) throw new HTTPException(401, { message: 'Unauthorized' })
			return await next()
		},
	),
)

app.route('/actions', actionsApp)
app.route('/gecko/:chainId', geckoApp)
app.route('/gecko', geckoApp)
app.route('/tokens', tokensApp)

if (process.env.NODE_ENV === 'development') showRoutes(app)

export default app satisfies ExportedHandler<Cloudflare.Env>
