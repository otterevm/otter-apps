const CHALLENGE_TTL_SECONDS = 5 * 60
const OTP_TTL_SECONDS = 5 * 60
const OTP_MAX_ATTEMPTS = 5

export type OtpEntry = {
	codeHash: string
	attempts: number
}

export async function setChallenge(
	kv: KVNamespace,
	key: string,
	challenge: string,
): Promise<void> {
	await kv.put(`challenge:${key}`, challenge, {
		expirationTtl: CHALLENGE_TTL_SECONDS,
	})
}

export async function getChallenge(
	kv: KVNamespace,
	key: string,
): Promise<string | undefined> {
	const value = await kv.get(`challenge:${key}`)
	return value ?? undefined
}

export async function deleteChallenge(
	kv: KVNamespace,
	key: string,
): Promise<void> {
	await kv.delete(`challenge:${key}`)
}

export async function storeOtp(
	kv: KVNamespace,
	email: string,
	codeHash: string,
): Promise<void> {
	const entry: OtpEntry = { codeHash, attempts: 0 }
	await kv.put(`otp:${email}`, JSON.stringify(entry), {
		expirationTtl: OTP_TTL_SECONDS,
	})
}

export async function getOtp(
	kv: KVNamespace,
	email: string,
): Promise<OtpEntry | null> {
	const value = await kv.get(`otp:${email}`)
	if (!value) return null
	return JSON.parse(value) as OtpEntry
}

export async function incrementOtpAttempts(
	kv: KVNamespace,
	email: string,
	current: OtpEntry,
): Promise<boolean> {
	const next = current.attempts + 1
	if (next >= OTP_MAX_ATTEMPTS) {
		await kv.delete(`otp:${email}`)
		return false
	}
	await kv.put(`otp:${email}`, JSON.stringify({ ...current, attempts: next }), {
		expirationTtl: OTP_TTL_SECONDS,
	})
	return true
}

export async function deleteOtp(kv: KVNamespace, email: string): Promise<void> {
	await kv.delete(`otp:${email}`)
}
