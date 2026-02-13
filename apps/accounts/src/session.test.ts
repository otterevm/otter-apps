import { describe, expect, it } from 'vitest'
import { signSession, verifySession } from './session'

async function generateEd25519KeyPair() {
	const keyPair = await crypto.subtle.generateKey('Ed25519', true, [
		'sign',
		'verify',
	])
	const privateJwk = JSON.stringify(
		await crypto.subtle.exportKey('jwk', keyPair.privateKey),
	)
	const publicJwk = JSON.stringify(
		await crypto.subtle.exportKey('jwk', keyPair.publicKey),
	)
	return { privateJwk, publicJwk }
}

describe('session', () => {
	it('round-trips sign and verify', async () => {
		const { privateJwk, publicJwk } = await generateEd25519KeyPair()
		const token = await signSession(privateJwk, 'usr_123', 'sid_abc')
		const result = await verifySession(publicJwk, token)
		expect(result).toEqual({ sub: 'usr_123', sid: 'sid_abc' })
	})

	it('rejects tampered signature', async () => {
		const { privateJwk, publicJwk } = await generateEd25519KeyPair()
		const token = await signSession(privateJwk, 'usr_123', 'sid_abc')
		const [payload, sig] = token.split('.')
		const flipped = `${sig.slice(0, 4)}AAAA${sig.slice(8)}`
		const result = await verifySession(publicJwk, `${payload}.${flipped}`)
		expect(result).toBeNull()
	})

	it('rejects expired cookie', async () => {
		const { privateJwk, publicJwk } = await generateEd25519KeyPair()

		const privateKey = await crypto.subtle.importKey(
			'jwk',
			JSON.parse(privateJwk),
			{ name: 'Ed25519' },
			false,
			['sign'],
		)

		const payload = JSON.stringify({
			sub: 'usr_123',
			sid: 'sid_abc',
			iat: 0,
			exp: 1,
		})
		const payloadBytes = new TextEncoder().encode(payload)
		const payloadB64 = btoa(String.fromCharCode(...payloadBytes))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
		const sig = await crypto.subtle.sign(
			'Ed25519',
			privateKey,
			new TextEncoder().encode(payloadB64),
		)
		const sigB64 = btoa(String.fromCharCode(...new Uint8Array(sig)))
			.replace(/\+/g, '-')
			.replace(/\//g, '_')
			.replace(/=+$/, '')
		const token = `${payloadB64}.${sigB64}`

		const result = await verifySession(publicJwk, token)
		expect(result).toBeNull()
	})

	it('rejects wrong key', async () => {
		const keys1 = await generateEd25519KeyPair()
		const keys2 = await generateEd25519KeyPair()
		const token = await signSession(keys1.privateJwk, 'usr_123', 'sid_abc')
		const result = await verifySession(keys2.publicJwk, token)
		expect(result).toBeNull()
	})
})
