import { Hono } from 'hono'
import { cors } from './cors'
import { auth } from './routes/auth'
import { wallets } from './routes/wallets'

const app = new Hono<{ Bindings: CloudflareBindings }>()

app.use('*', cors())
app.route('/auth', auth)
app.route('/wallets', wallets)

export default app
