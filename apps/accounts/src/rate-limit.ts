export async function checkOtpRateLimit(
	email: string,
	ip: string,
	env: CloudflareBindings,
): Promise<{ limited: boolean; key?: string }> {
	if (env.OTP_EMAIL_RATE_LIMITER) {
		const { success } = await env.OTP_EMAIL_RATE_LIMITER.limit({ key: email })
		if (!success) return { limited: true, key: 'email' }
	}

	if (env.OTP_IP_RATE_LIMITER) {
		const { success } = await env.OTP_IP_RATE_LIMITER.limit({ key: ip })
		if (!success) return { limited: true, key: 'ip' }
	}

	return { limited: false }
}
