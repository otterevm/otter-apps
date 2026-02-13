export function getRpId(hostname: string): string {
	const parts = hostname.split('.')
	if (parts.length <= 2) return hostname
	if (hostname.endsWith('.workers.dev')) return parts.slice(-3).join('.')
	return parts.slice(-2).join('.')
}
