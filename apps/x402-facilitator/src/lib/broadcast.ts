import { http, type Hex } from 'viem'
import type { PrivateKeyAccount } from 'viem/accounts'
import type { Chain } from 'viem/chains'
import { Handler } from 'tempo.ts/server'
import type { VerificationError } from './types'

export interface BroadcastParams {
	signedTransaction: Hex
	feePayerAccount: PrivateKeyAccount
	feeToken: Hex
	rpcUrl: string
	chain: Chain
}

export interface BroadcastResult {
	success: true
	transactionHash: Hex
}

export interface BroadcastError {
	success: false
	error: VerificationError
}

/**
 * Broadcast a signed transaction with fee payer signature.
 */
export async function broadcastWithFeePayer(
	params: BroadcastParams,
): Promise<BroadcastResult | BroadcastError> {
	const { signedTransaction, feePayerAccount, rpcUrl, chain } = params

	try {
		const handler = Handler.feePayer({
			account: feePayerAccount,
			chain,
			transport: http(rpcUrl),
		})

		const request = new Request('https://internal/', {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({
				jsonrpc: '2.0',
				id: 1,
				method: 'eth_sendRawTransactionSync',
				params: [signedTransaction],
			}),
		})

		const response = await handler.fetch(request)

		const data = (await response.json()) as {
			result?: { transactionHash: Hex } | Hex
			error?: { code: number; message: string; data?: unknown }
		}

		if (data.error) {
			return {
				success: false,
				error: {
					code: 'BROADCAST_FAILED',
					message: data.error.message || 'Transaction broadcast failed',
				},
			}
		}

		const transactionHash =
			typeof data.result === 'object' && data.result !== null
				? data.result.transactionHash
				: data.result

		if (!transactionHash) {
			return {
				success: false,
				error: {
					code: 'BROADCAST_FAILED',
					message: 'No transaction hash returned from RPC',
				},
			}
		}

		return {
			success: true,
			transactionHash,
		}
	} catch (error) {
		return {
			success: false,
			error: {
				code: 'BROADCAST_FAILED',
				message: `Failed to broadcast transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
			},
		}
	}
}
