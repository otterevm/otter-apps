import { env } from 'cloudflare:workers'
import type { MiddlewareHandler } from 'hono'

// Type assertion for cloudflare env with rate limiter
const cfEnv = env as {
	AddressRateLimiter?: {
		limit: (options: { key: string }) => Promise<{ success: boolean }>
	}
}

/**
 * Rate limiting middleware that limits requests by IP address.
 * Uses Cloudflare's Rate Limiting binding for distributed rate limiting.
 *
 * Falls back to allowing all requests if rate limiter is not configured.
 */
export const rateLimitMiddleware: MiddlewareHandler = async (c, next) => {
	if (!cfEnv.AddressRateLimiter) {
		// No rate limiter configured, allow request
		await next()
		return
	}

	try {
		// Get client IP from CF headers or connection
		const clientIp =
			c.req.header('cf-connecting-ip') ??
			c.req.header('x-forwarded-for')?.split(',')[0]?.trim() ??
			'unknown'

		const { success } = await cfEnv.AddressRateLimiter.limit({ key: clientIp })

		if (!success) {
			return c.json(
				{
					isValid: false,
					invalidReason: 'Rate limit exceeded. Please try again later.',
					requestId: c.get('requestId'),
				},
				429,
			)
		}
	} catch (error) {
		// Log error but don't block request on rate limiter failure
		console.error('Rate limiter error:', error)
	}

	await next()
}

/**
 * Rate limit by sender address (for settle/verify endpoints)
 * This can be used to prevent spam from specific wallet addresses.
 */
export async function checkAddressRateLimit(
	address: string,
): Promise<{ allowed: boolean; retryAfter?: number }> {
	if (!cfEnv.AddressRateLimiter) {
		return { allowed: true }
	}

	try {
		const { success } = await cfEnv.AddressRateLimiter.limit({
			key: `addr:${address.toLowerCase()}`,
		})
		return { allowed: success, retryAfter: success ? undefined : 60 }
	} catch {
		// Allow on error
		return { allowed: true }
	}
}
