import { createFileRoute } from '@tanstack/react-router'
import * as IDX from 'idxs'
import { getChainId } from 'wagmi/actions'
import * as ABIS from '#lib/abis'
import { TOKEN_COUNT_MAX } from '#lib/constants'
import { getWagmiConfig } from '#wagmi.config.ts'

const IS = IDX.IndexSupply.create({
	apiKey: process.env.INDEXER_API_KEY,
})

const QB = IDX.QueryBuilder.from(IS)

// Average block time on Tempo is 0.5 seconds
const AVERAGE_BLOCK_TIME_SECONDS = 0.5
const BLOCKS_PER_DAY = Math.floor((24 * 60 * 60) / AVERAGE_BLOCK_TIME_SECONDS)

export type StatsApiResponse = {
	data: {
		transactions24h: number
		tokens: number
		accounts24h: number
	} | null
	error: string | null
}

export const Route = createFileRoute('/api/stats')({
	server: {
		handlers: {
			GET: async () => {
				try {
					const config = getWagmiConfig()
					const chainId = getChainId(config)
					const tokenCreatedSignature = ABIS.getTokenCreatedEvent(chainId)

					// Get latest block number to calculate 24h ago
					const latestBlockResult = await QB.selectFrom('blocks')
						.select('num')
						.where('chain', '=', chainId)
						.orderBy('num', 'desc')
						.limit(1)
						.executeTakeFirst()

					const latestBlock = BigInt(latestBlockResult?.num ?? 0)
					const block24hAgo = latestBlock - BigInt(BLOCKS_PER_DAY)
					const block24hAgoSafe = block24hAgo < 0n ? 0n : block24hAgo

					// Run queries in parallel
					const [tokensCountResult, txCount24hResult, accounts24hResult] =
						await Promise.all([
							// Total tokens (capped)
							QB.selectFrom(
								QB.withSignatures([tokenCreatedSignature])
									.selectFrom('tokencreated')
									.select((eb) => eb.lit(1).as('x'))
									.where('chain', '=', chainId as never)
									.limit(TOKEN_COUNT_MAX)
									.as('subquery'),
							)
								.select((eb) => eb.fn.count('x').as('count'))
								.executeTakeFirst(),

							// Transactions in last 24h (by block number)
							QB.selectFrom('txs')
								.select((eb) => eb.fn.count('hash').as('count'))
								.where('chain', '=', chainId)
								.where('block_num', '>=', block24hAgoSafe)
								.executeTakeFirst(),

							// Active accounts: sample recent txs and count unique senders
							QB.selectFrom('txs')
								.select(['from'])
								.where('chain', '=', chainId)
								.where('block_num', '>=', block24hAgoSafe)
								.limit(50000)
								.execute(),
						])

					const uniqueAccounts = new Set(
						accounts24hResult?.map((tx) => tx.from) ?? [],
					)

					return Response.json({
						data: {
							transactions24h: Number(txCount24hResult?.count ?? 0),
							tokens: Number(tokensCountResult?.count ?? 0),
							accounts24h: uniqueAccounts.size,
						},
						error: null,
					} satisfies StatsApiResponse)
				} catch (error) {
					console.error('Failed to fetch stats:', error)
					const errorMessage =
						error instanceof Error ? error.message : 'Unknown error'
					return Response.json(
						{ data: null, error: errorMessage } satisfies StatsApiResponse,
						{ status: 500 },
					)
				}
			},
		},
	},
})
