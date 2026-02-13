import { Hono } from 'hono'
import * as Hex from 'ox/Hex'
import { createDb } from '../db/client'
import { createRepo } from '../db/repo'
import * as kv from '../kv'
import { checkOtpRateLimit } from '../rate-limit'
import { getRpId } from '../rp-id'
import {
	clearSessionCookieHeaders,
	getSessionUserId,
	sessionCookieHeaders,
} from '../session'
import { verifyAssertion } from '../webauthn'

const auth = new Hono<{ Bindings: CloudflareBindings }>()

async function hashCode(code: string): Promise<string> {
	const encoded = new TextEncoder().encode(code)
	const digest = await crypto.subtle.digest('SHA-256', encoded)
	return Array.from(new Uint8Array(digest))
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')
}

function generateOtp(): string {
	const buf = new Uint32Array(1)
	crypto.getRandomValues(buf)
	return String(buf[0] % 1_000_000).padStart(6, '0')
}

function formatWallets(
	wallets: {
		id: string
		credentialId: string
		publicKeyHex: string | null
		label: string
		address: string
	}[],
) {
	return wallets.map((w) => ({
		id: w.id,
		credentialId: w.credentialId,
		publicKeyHex: w.publicKeyHex,
		label: w.label,
		address: w.address,
	}))
}

auth.post('/send-otp', async (c) => {
	const body = await c.req.json<{ email?: string }>()
	const email = body?.email?.trim()?.toLowerCase()

	if (!email) return c.json({ error: 'Email is required' }, 400)

	const ip = c.req.header('cf-connecting-ip') ?? 'unknown'
	const { limited } = await checkOtpRateLimit(email, ip, c.env)
	if (limited) {
		return c.json({ error: 'Too many requests. Please try again later.' }, 429)
	}

	const code = generateOtp()
	const codeHash = await hashCode(code)

	await kv.storeOtp(c.env.KV, email, codeHash)

	const form = new FormData()
	form.append('from', 'noreply@tempo.xyz')
	form.append('to', email)
	form.append('subject', 'Your Tempo verification code')
	form.append(
		'text',
		`Your verification code is: ${code}\n\nThis code expires in 5 minutes. If you didn't request this, you can ignore this email.`,
	)

	const res = await fetch(
		`https://api.mailgun.net/v3/${c.env.MAILGUN_DOMAIN}/messages`,
		{
			method: 'POST',
			headers: {
				Authorization: `Basic ${btoa(`api:${c.env.MAILGUN_API_KEY}`)}`,
			},
			body: form,
		},
	)
	if (!res.ok) {
		return c.json({ error: 'Failed to send verification email' }, 500)
	}

	return c.json({ ok: true })
})

auth.post('/verify-otp', async (c) => {
	const body = await c.req.json<{ email?: string; code?: string }>()
	const email = body?.email?.trim()?.toLowerCase()
	const code = body?.code?.trim()
	const hostname = new URL(c.req.url).hostname

	if (!email || !code) {
		return c.json({ error: 'Email and code are required' }, 400)
	}

	const otp = await kv.getOtp(c.env.KV, email)
	if (!otp) return c.json({ error: 'Invalid or expired code' }, 400)

	const submittedHash = await hashCode(code)
	if (submittedHash !== otp.codeHash) {
		await kv.incrementOtpAttempts(c.env.KV, email, otp)
		return c.json({ error: 'Invalid or expired code' }, 400)
	}

	await kv.deleteOtp(c.env.KV, email)

	const db = createDb(c.env.DB)
	const repo = createRepo(db)
	const { user } = await repo.upsertUserByEmail(email)
	const wallets = await repo.getWalletsByUserId(user.id)
	const headers = await sessionCookieHeaders(
		c.env.SESSION_PRIVATE_KEY,
		user.id,
		hostname,
	)

	return c.json(
		{
			user: { id: user.id, email: user.email },
			wallets: formatWallets(wallets),
		},
		200,
		Object.fromEntries(headers.entries()),
	)
})

auth.get('/session', async (c) => {
	const userId = await getSessionUserId(c.req.raw, c.env.SESSION_PUBLIC_KEY)
	if (!userId) {
		const headers = clearSessionCookieHeaders()
		return c.json(
			{ error: 'Unauthorized' },
			401,
			Object.fromEntries(headers.entries()),
		)
	}

	const db = createDb(c.env.DB)
	const repo = createRepo(db)
	const user = await repo.getUserById(userId)
	if (!user) {
		const headers = clearSessionCookieHeaders()
		return c.json(
			{ error: 'User not found' },
			401,
			Object.fromEntries(headers.entries()),
		)
	}

	const wallets = await repo.getWalletsByUserId(userId)
	return c.json({
		user: { id: user.id, email: user.email },
		wallets: formatWallets(wallets),
	})
})

auth.post('/passkey-challenge', async (c) => {
	const challenge = Hex.fromBytes(
		new Uint8Array(crypto.getRandomValues(new Uint8Array(32))),
	)

	await kv.setChallenge(c.env.KV, `passkey:${challenge}`, challenge)

	const rpId = getRpId(new URL(c.req.url).hostname)

	return c.json({
		options: {
			challenge,
			rpId,
			userVerification: 'preferred' as const,
		},
	})
})

auth.post('/passkey-login', async (c) => {
	const body = await c.req.json<{
		credentialId?: string
		authenticatorData?: string
		clientDataJSON?: string
		signature?: string
	}>()
	const { credentialId, authenticatorData, clientDataJSON, signature } = body
	if (!credentialId || !authenticatorData || !clientDataJSON || !signature) {
		return c.json({ error: 'Missing assertion fields' }, 400)
	}

	const db = createDb(c.env.DB)
	const repo = createRepo(db)

	const wallet = await repo.getWalletByCredentialId(credentialId)
	if (!wallet?.publicKeyHex) {
		return c.json({ error: 'Unknown credential' }, 400)
	}

	const clientData = JSON.parse(
		new TextDecoder().decode(
			Uint8Array.from(
				atob(clientDataJSON.replace(/-/g, '+').replace(/_/g, '/')),
				(ch) => ch.charCodeAt(0),
			),
		),
	) as { challenge?: string }
	const challenge = clientData.challenge
	if (!challenge) return c.json({ error: 'Missing challenge' }, 400)

	const stored = await kv.getChallenge(c.env.KV, `passkey:${challenge}`)
	if (!stored) return c.json({ error: 'Invalid or expired challenge' }, 400)
	await kv.deleteChallenge(c.env.KV, `passkey:${challenge}`)

	const hostname = new URL(c.req.url).hostname
	const result = await verifyAssertion({
		credentialId,
		authenticatorData,
		clientDataJSON,
		signature,
		publicKeyHex: wallet.publicKeyHex,
		expectedChallenge: challenge,
		hostname,
	})

	if (!result.ok) return c.json({ error: result.error }, 400)

	const user = await repo.getUserById(wallet.userId)
	if (!user) return c.json({ error: 'User not found' }, 404)

	const wallets = await repo.getWalletsByUserId(user.id)
	const headers = await sessionCookieHeaders(
		c.env.SESSION_PRIVATE_KEY,
		user.id,
		hostname,
	)

	return c.json(
		{
			user: { id: user.id, email: user.email },
			wallets: formatWallets(wallets),
		},
		200,
		Object.fromEntries(headers.entries()),
	)
})

auth.post('/sign-out', (c) => {
	const headers = clearSessionCookieHeaders()
	return c.json({ ok: true }, 200, Object.fromEntries(headers.entries()))
})

export { auth }
