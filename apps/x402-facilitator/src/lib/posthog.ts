import { env } from 'cloudflare:workers'

const POSTHOG_HOST = 'https://us.i.posthog.com'

export const FacilitatorEvents = {
	VERIFY_REQUEST: 'x402_facilitator.verify_request',
	VERIFY_SUCCESS: 'x402_facilitator.verify_success',
	VERIFY_FAILURE: 'x402_facilitator.verify_failure',
	SETTLE_REQUEST: 'x402_facilitator.settle_request',
	SETTLE_SUCCESS: 'x402_facilitator.settle_success',
	SETTLE_FAILURE: 'x402_facilitator.settle_failure',
	SUPPORTED_QUERY: 'x402_facilitator.supported_query',
	HEALTH_CHECK: 'x402_facilitator.health_check',
} as const

type EventProperties = Record<string, unknown>

interface CaptureParams {
	distinctId: string
	event: string
	properties?: EventProperties
}

export async function captureEvent({
	distinctId,
	event,
	properties = {},
}: CaptureParams): Promise<void> {
	if (!env.POSTHOG_API_KEY) {
		console.warn('PostHog API key not configured, skipping event capture')
		return
	}

	const payload = {
		api_key: env.POSTHOG_API_KEY,
		event,
		timestamp: new Date().toISOString(),
		properties: {
			distinct_id: distinctId,
			environment: env.TEMPO_ENV,
			...properties,
		},
	}

	try {
		const response = await fetch(`${POSTHOG_HOST}/capture/`, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify(payload),
		})

		if (!response.ok) {
			const body = await response
				.text()
				.catch(() => 'Unable to read response body')
			console.error(`PostHog capture failed: ${response.status} - ${body}`)
		}
	} catch (error) {
		console.error('PostHog capture error:', error)
	}
}

export function getRequestContext(request: Request): {
	origin: string | null
	referer: string | null
	userAgent: string | null
	serviceDomain: string
} {
	const url = new URL(request.url)
	return {
		origin: request.headers.get('origin'),
		referer: request.headers.get('referer'),
		userAgent: request.headers.get('user-agent'),
		serviceDomain: url.host,
	}
}
