import { describe, expect, it } from 'vitest'
import { verifyAssertion } from './webauthn'

function base64urlEncode(bytes: Uint8Array): string {
	let binary = ''
	for (const byte of bytes) binary += String.fromCharCode(byte)
	return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
}

function hexFromBytes(bytes: Uint8Array): string {
	return `0x${Array.from(bytes)
		.map((b) => b.toString(16).padStart(2, '0'))
		.join('')}`
}

function encodeDerSignature(r: Uint8Array, s: Uint8Array): Uint8Array {
	function encodeInteger(val: Uint8Array): Uint8Array {
		const needsPad = val[0] >= 0x80
		const len = val.length + (needsPad ? 1 : 0)
		const out = new Uint8Array(2 + len)
		out[0] = 0x02
		out[1] = len
		if (needsPad) {
			out[2] = 0x00
			out.set(val, 3)
		} else {
			out.set(val, 2)
		}
		return out
	}
	const rEnc = encodeInteger(r)
	const sEnc = encodeInteger(s)
	const seq = new Uint8Array(2 + rEnc.length + sEnc.length)
	seq[0] = 0x30
	seq[1] = rEnc.length + sEnc.length
	seq.set(rEnc, 2)
	seq.set(sEnc, 2 + rEnc.length)
	return seq
}

async function buildAssertion(params: {
	rpId: string
	challenge: string
	origin: string
}) {
	const keyPair = await crypto.subtle.generateKey(
		{ name: 'ECDSA', namedCurve: 'P-256' },
		true,
		['sign', 'verify'],
	)
	const rawKey = new Uint8Array(
		await crypto.subtle.exportKey('raw', keyPair.publicKey),
	)
	const publicKeyHex = hexFromBytes(rawKey)

	const rpIdHash = new Uint8Array(
		await crypto.subtle.digest(
			'SHA-256',
			new TextEncoder().encode(params.rpId),
		),
	)
	const authenticatorData = new Uint8Array(37)
	authenticatorData.set(rpIdHash)
	authenticatorData[32] = 0x05 // UP + UV flags

	const clientData = JSON.stringify({
		type: 'webauthn.get',
		challenge: params.challenge,
		origin: params.origin,
	})
	const clientDataJSON = new TextEncoder().encode(clientData)

	const clientDataHash = new Uint8Array(
		await crypto.subtle.digest('SHA-256', clientDataJSON),
	)
	const signedData = new Uint8Array(
		authenticatorData.length + clientDataHash.length,
	)
	signedData.set(authenticatorData)
	signedData.set(clientDataHash, authenticatorData.length)

	const rawSig = new Uint8Array(
		await crypto.subtle.sign(
			{ name: 'ECDSA', hash: 'SHA-256' },
			keyPair.privateKey,
			signedData,
		),
	)
	const r = rawSig.slice(0, 32)
	const s = rawSig.slice(32)
	const derSig = encodeDerSignature(r, s)

	return {
		publicKeyHex,
		authenticatorData: base64urlEncode(authenticatorData),
		clientDataJSON: base64urlEncode(clientDataJSON),
		signature: base64urlEncode(derSig),
	}
}

describe('verifyAssertion', () => {
	const challenge = 'dGVzdC1jaGFsbGVuZ2U'
	const rpId = 'tempo.xyz'
	const origin = 'https://tempo.xyz'

	it('accepts a valid assertion', async () => {
		const assertion = await buildAssertion({ rpId, challenge, origin })
		const result = await verifyAssertion({
			credentialId: 'cred-1',
			...assertion,
			expectedChallenge: challenge,
			hostname: 'accounts.tempo.xyz',
		})
		expect(result).toEqual({ ok: true })
	})

	it('rejects wrong challenge', async () => {
		const assertion = await buildAssertion({ rpId, challenge, origin })
		const result = await verifyAssertion({
			credentialId: 'cred-1',
			...assertion,
			expectedChallenge: 'wrong-challenge',
			hostname: 'accounts.tempo.xyz',
		})
		expect(result).toEqual({ ok: false, error: 'Challenge mismatch' })
	})

	it('rejects wrong RP ID', async () => {
		const assertion = await buildAssertion({
			rpId: 'evil.com',
			challenge,
			origin,
		})
		const result = await verifyAssertion({
			credentialId: 'cred-1',
			...assertion,
			expectedChallenge: challenge,
			hostname: 'accounts.tempo.xyz',
		})
		expect(result).toEqual({ ok: false, error: 'RP ID mismatch' })
	})

	it('rejects tampered signature', async () => {
		const assertion = await buildAssertion({ rpId, challenge, origin })
		const badSig = base64urlEncode(new Uint8Array(64))
		const result = await verifyAssertion({
			credentialId: 'cred-1',
			...assertion,
			signature: badSig,
			expectedChallenge: challenge,
			hostname: 'accounts.tempo.xyz',
		})
		expect(result.ok).toBe(false)
	})
})
