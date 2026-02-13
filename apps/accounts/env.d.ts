interface CloudflareBindings {
	readonly DB: D1Database
	readonly KV: KVNamespace
	readonly SESSION_PRIVATE_KEY: string
	readonly SESSION_PUBLIC_KEY: string
	readonly MAILGUN_API_KEY: string
	readonly MAILGUN_DOMAIN: string
	readonly OTP_EMAIL_RATE_LIMITER: RateLimit
	readonly OTP_IP_RATE_LIMITER: RateLimit
}
