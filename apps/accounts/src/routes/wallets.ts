import { Hono } from 'hono'
import * as Hex from 'ox/Hex'
import { createDb } from '../db/client'
import { createRepo } from '../db/repo'
import * as kv from '../kv'
import { getRpId } from '../rp-id'
import { getSessionUserId } from '../session'

const wallets = new Hono<{ Bindings: CloudflareBindings }>()

const RP_NAME = 'Tempo'

wallets.post('/register', async (c) => {
	const userId = await getSessionUserId(c.req.raw, c.env.SESSION_PUBLIC_KEY)
	if (!userId) return c.json({ error: 'Unauthorized' }, 401)

	const db = createDb(c.env.DB)
	const repo = createRepo(db)

	const user = await repo.getUserById(userId)
	if (!user) return c.json({ error: 'User not found' }, 404)

	const existingWallets = await repo.getWalletsByUserId(userId)
	const rpID = getRpId(new URL(c.req.url).hostname)

	const challenge = Hex.fromBytes(
		new Uint8Array(crypto.getRandomValues(new Uint8Array(32))),
	)

	await kv.setChallenge(c.env.KV, userId, challenge)

	return c.json({
		options: {
			challenge,
			rp: { id: rpID, name: RP_NAME },
			user: {
				id: Hex.fromString(user.id),
				name: user.email,
				displayName: user.email,
			},
			excludeCredentialIds: existingWallets.map((w) => w.credentialId),
			authenticatorSelection: {
				residentKey: 'preferred' as const,
				userVerification: 'preferred' as const,
			},
			attestation: 'none' as const,
		},
	})
})

wallets.post('/verify', async (c) => {
	const userId = await getSessionUserId(c.req.raw, c.env.SESSION_PUBLIC_KEY)
	if (!userId) return c.json({ error: 'Unauthorized' }, 401)

	const body = await c.req.json<{
		credentialId?: string
		publicKeyHex?: string
		address?: string
		transports?: string[]
		label?: string
	}>()
	const { credentialId, publicKeyHex, address } = body
	if (!credentialId) return c.json({ error: 'Credential ID is required' }, 400)
	if (!publicKeyHex) return c.json({ error: 'Public key is required' }, 400)
	if (!address) return c.json({ error: 'Address is required' }, 400)

	const db = createDb(c.env.DB)
	const repo = createRepo(db)

	const expectedChallenge = await kv.getChallenge(c.env.KV, userId)
	if (!expectedChallenge) {
		return c.json({ error: 'No pending registration challenge' }, 400)
	}
	await kv.deleteChallenge(c.env.KV, userId)

	const existingByAddress = await repo.getWalletByAddress(address)
	if (existingByAddress) {
		return c.json(
			{ error: 'This wallet is already associated with another account' },
			409,
		)
	}

	let label = body.label?.trim()
	if (!label) {
		const existingWallets = await repo.getWalletsByUserId(userId)
		const walletNumber = existingWallets.length + 1
		label = walletNumber === 1 ? 'Wallet' : `Wallet #${walletNumber}`
	}
	if (label.length > 64) {
		return c.json({ error: 'Label must be 64 characters or less' }, 400)
	}

	const wallet = await repo.createWallet({
		userId,
		credentialId,
		publicKey: '',
		publicKeyHex,
		transports: body.transports,
		label,
		address,
	})

	return c.json({
		wallet: {
			id: wallet.id,
			credentialId: wallet.credentialId,
			publicKeyHex: wallet.publicKeyHex,
			label: wallet.label,
			address: wallet.address,
		},
	})
})

wallets.get('/credential-key', async (c) => {
	const userId = await getSessionUserId(c.req.raw, c.env.SESSION_PUBLIC_KEY)
	if (!userId) return c.json({ error: 'Unauthorized' }, 401)

	const credentialId = c.req.query('credentialId')
	if (!credentialId) return c.json({ error: 'credentialId is required' }, 400)

	const db = createDb(c.env.DB)
	const repo = createRepo(db)
	const wallet = await repo.getWalletByCredentialId(credentialId)
	if (!wallet?.publicKeyHex || wallet.userId !== userId) {
		return c.json({ error: 'Not found' }, 404)
	}

	return c.json({ publicKey: wallet.publicKeyHex })
})

wallets.post('/rename', async (c) => {
	const userId = await getSessionUserId(c.req.raw, c.env.SESSION_PUBLIC_KEY)
	if (!userId) return c.json({ error: 'Unauthorized' }, 401)

	const body = await c.req.json<{ walletId?: string; label?: string }>()
	if (!body.walletId || typeof body.label !== 'string' || !body.label.trim()) {
		return c.json({ error: 'Missing walletId or label' }, 400)
	}

	const label = body.label.trim()
	const db = createDb(c.env.DB)
	const repo = createRepo(db)
	await repo.updateWalletLabel(body.walletId, userId, label)

	return c.json({ ok: true, label })
})

export { wallets }
