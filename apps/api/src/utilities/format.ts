import { formatUnits } from 'viem'

export const toUnixTimestamp = (value: unknown): number => new Date(String(value)).getTime() / 1_000

export function computePriceNative(
	tickPrice: bigint,
	baseDecimals: number,
	quoteDecimals: number,
	scale: bigint,
): string {
	const PRICE_PRECISION = 36
	const priceBig =
		(tickPrice * 10n ** BigInt(baseDecimals + PRICE_PRECISION)) /
		(scale * 10n ** BigInt(quoteDecimals))
	return formatUnits(priceBig, PRICE_PRECISION)
}
