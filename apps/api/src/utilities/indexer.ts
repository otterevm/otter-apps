import * as IDX from 'idxs'

export function idxClient() {
	const indexer = IDX.IndexSupply.create({
		apiKey: process.env.INDEX_SUPPLY_API_KEY,
	})
	const QB = IDX.QueryBuilder.from(indexer)

	return { indexer, queryBuilder: QB }
}
