import { getRpId } from './rp-id'

function base64urlDecode(str: string): Uint8Array {
	const padded = str.replace(/-/g, '+').replace(/_/g, '/')
	const binary = atob(padded)
	const bytes = new Uint8Array(binary.length)
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i)
	return bytes
}

function hexToBytes(hex: string): Uint8Array {
	const clean = hex.startsWith('0x') ? hex.slice(2) : hex
	const bytes = new Uint8Array(clean.length / 2)
	for (let i = 0; i < bytes.length; i++)
		bytes[i] = Number.parseInt(clean.slice(i * 2, i * 2 + 2), 16)
	return bytes
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
	if (a.length !== b.length) return false
	for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) return false
	return true
}

function parseDerSignature(der: Uint8Array): Uint8Array {
	if (der[0] !== 0x30) throw new Error('Invalid DER signature')
	let offset = 2
	if (der[1] & 0x80) offset += der[1] & 0x7f

	function readInteger(pos: number): { value: Uint8Array; next: number } {
		if (der[pos] !== 0x02) throw new Error('Expected INTEGER tag')
		const len = der[pos + 1]
		const start = pos + 2
		let intBytes = der.slice(start, start + len)
		if (intBytes[0] === 0x00) intBytes = intBytes.slice(1)
		return { value: intBytes, next: start + len }
	}

	const r = readInteger(offset)
	const s = readInteger(r.next)

	const raw = new Uint8Array(64)
	raw.set(r.value, 32 - r.value.length)
	raw.set(s.value, 64 - s.value.length)
	return raw
}

async function importP256PublicKey(publicKeyHex: string): Promise<CryptoKey> {
	const rawBytes = hexToBytes(publicKeyHex)
	return crypto.subtle.importKey(
		'raw',
		rawBytes,
		{ name: 'ECDSA', namedCurve: 'P-256' },
		false,
		['verify'],
	)
}

export async function verifyAssertion(params: {
	credentialId: string
	authenticatorData: string
	clientDataJSON: string
	signature: string
	publicKeyHex: string
	expectedChallenge: string
	hostname: string
}): Promise<{ ok: true } | { ok: false; error: string }> {
	const authenticatorData = base64urlDecode(params.authenticatorData)
	const clientDataJSON = base64urlDecode(params.clientDataJSON)
	const signature = base64urlDecode(params.signature)

	const clientData = JSON.parse(new TextDecoder().decode(clientDataJSON)) as {
		type: string
		challenge: string
		origin: string
	}

	if (clientData.type !== 'webauthn.get')
		return { ok: false, error: 'Invalid assertion type' }

	if (clientData.challenge !== params.expectedChallenge)
		return { ok: false, error: 'Challenge mismatch' }

	const rpId = getRpId(params.hostname)
	const rpIdHash = new Uint8Array(
		await crypto.subtle.digest('SHA-256', new TextEncoder().encode(rpId)),
	)

	if (!bytesEqual(rpIdHash, authenticatorData.slice(0, 32)))
		return { ok: false, error: 'RP ID mismatch' }

	const flags = authenticatorData[32]
	if ((flags & 0x01) === 0) return { ok: false, error: 'User not present' }

	const clientDataHash = new Uint8Array(
		await crypto.subtle.digest('SHA-256', clientDataJSON),
	)

	const signedData = new Uint8Array(
		authenticatorData.length + clientDataHash.length,
	)
	signedData.set(authenticatorData)
	signedData.set(clientDataHash, authenticatorData.length)

	try {
		const key = await importP256PublicKey(params.publicKeyHex)
		const rawSig = parseDerSignature(signature)

		const valid = await crypto.subtle.verify(
			{ name: 'ECDSA', hash: 'SHA-256' },
			key,
			rawSig,
			signedData,
		)

		if (!valid) return { ok: false, error: 'Invalid signature' }
		return { ok: true }
	} catch {
		return { ok: false, error: 'Invalid signature' }
	}
}
