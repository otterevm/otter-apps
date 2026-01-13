import {
	type Address,
	type Hex,
	type PublicClient,
	decodeFunctionData,
	isAddressEqual,
	parseTransaction,
	recoverTransactionAddress,
} from 'viem'
import { Abis } from 'viem/tempo'
import {
	type PaymentRequirements,
	type Result,
	type TempoPaymentPayload,
	type VerificationError,
	err,
	ok,
} from './types'

const TIP20_PREFIX = '0x20c000000'
const TRANSFER_SELECTOR = '0xa9059cbb'

export interface ParsedTransaction {
	to: Address
	value: bigint
	data: Hex
	chainId: number
	from: Address
	serialized: Hex
}

export interface TransferParams {
	recipient: Address
	amount: bigint
}

/**
 * Parse and validate a signed transaction
 */
export async function parseSignedTransaction(
	signedTransaction: Hex,
): Promise<Result<ParsedTransaction>> {
	try {
		const parsed = parseTransaction(signedTransaction)

		if (!parsed.to) {
			return err({
				code: 'INVALID_TRANSACTION',
				message: 'Transaction missing "to" field',
			})
		}

		if (!parsed.data) {
			return err({
				code: 'INVALID_TRANSACTION',
				message: 'Transaction missing "data" field',
			})
		}

		if (parsed.chainId === undefined) {
			return err({
				code: 'INVALID_TRANSACTION',
				message: 'Transaction missing chain ID',
			})
		}

		// Type cast needed as viem expects specific transaction type prefixes
		// but validation happens at runtime via parseTransaction above
		const from = await recoverTransactionAddress({
			serializedTransaction: signedTransaction as `0x02${string}`,
		})

		return ok({
			to: parsed.to,
			value: parsed.value ?? 0n,
			data: parsed.data,
			chainId: parsed.chainId,
			from,
			serialized: signedTransaction,
		})
	} catch (error) {
		return err({
			code: 'INVALID_TRANSACTION',
			message: `Failed to parse transaction: ${error instanceof Error ? error.message : 'Unknown error'}`,
		})
	}
}

/**
 * Decode and validate transfer calldata
 */
export function decodeTransferCalldata(data: Hex): Result<TransferParams> {
	// Check function selector
	const selector = data.slice(0, 10).toLowerCase()
	if (selector !== TRANSFER_SELECTOR) {
		return err({
			code: 'INVALID_FUNCTION_CALL',
			message: `Expected transfer function selector ${TRANSFER_SELECTOR}, got ${selector}`,
		})
	}

	try {
		const decoded = decodeFunctionData({
			abi: Abis.tip20,
			data,
		})

		if (decoded.functionName !== 'transfer') {
			return err({
				code: 'INVALID_FUNCTION_CALL',
				message: 'Transaction does not call transfer function',
			})
		}

		if (!decoded.args || decoded.args.length < 2) {
			return err({
				code: 'INVALID_FUNCTION_CALL',
				message: 'Transfer calldata missing required arguments',
			})
		}

		const recipient = decoded.args[0]
		const amount = decoded.args[1]
		return ok({ recipient, amount })
	} catch (error) {
		return err({
			code: 'INVALID_FUNCTION_CALL',
			message: `Failed to decode transfer calldata: ${error instanceof Error ? error.message : 'Unknown error'}`,
		})
	}
}

/**
 * Extract chain ID from network string (e.g., "eip155:42429" -> 42429)
 */
export function parseNetworkChainId(network: string): number | null {
	const match = network.match(/^eip155:(\d+)$/)
	return match ? Number.parseInt(match[1], 10) : null
}

/**
 * Validate payment timeout
 */
export function validateTimeout(
	createdAt: number | undefined,
	maxTimeoutSeconds: number,
): VerificationError | null {
	if (createdAt === undefined) {
		// If no createdAt, we can't validate timeout - allow it but log warning
		return null
	}

	const now = Math.floor(Date.now() / 1000)
	const expiresAt = createdAt + maxTimeoutSeconds

	if (now > expiresAt) {
		return {
			code: 'TIMEOUT_EXCEEDED',
			message: `Payment expired at ${new Date(expiresAt * 1000).toISOString()}, current time is ${new Date(now * 1000).toISOString()}`,
		}
	}

	return null
}

/**
 * Validate payment requirements against parsed transaction
 */
export function validatePaymentRequirements(
	tx: ParsedTransaction,
	transfer: TransferParams,
	requirements: PaymentRequirements,
	feePayerAddress: Address,
): VerificationError | null {
	const asset = requirements.asset as Address
	const payTo = requirements.payTo as Address

	// 1. Verify asset starts with TIP-20 prefix
	if (!asset.toLowerCase().startsWith(TIP20_PREFIX.toLowerCase())) {
		return {
			code: 'INVALID_ASSET_FORMAT',
			message: `Asset must start with TIP-20 prefix ${TIP20_PREFIX}`,
		}
	}

	// 2. Verify transaction "to" equals asset
	if (!isAddressEqual(tx.to, asset)) {
		return {
			code: 'ASSET_MISMATCH',
			message: `Transaction target ${tx.to} does not match asset ${asset}`,
		}
	}

	// 3. Verify transaction value is 0
	if (tx.value !== 0n) {
		return {
			code: 'NONZERO_VALUE',
			message: 'Transaction value must be 0 for TIP-20 transfers',
		}
	}

	// 4. Verify transfer recipient matches payTo
	if (!isAddressEqual(transfer.recipient, payTo)) {
		return {
			code: 'RECIPIENT_MISMATCH',
			message: `Transfer recipient ${transfer.recipient} does not match payTo ${payTo}`,
		}
	}

	// 5. Verify transfer amount matches exactly
	const expectedAmount = BigInt(requirements.amount)
	if (transfer.amount !== expectedAmount) {
		return {
			code: 'AMOUNT_MISMATCH',
			message: `Transfer amount ${transfer.amount} does not match expected ${expectedAmount}`,
		}
	}

	// 6. Verify chain ID matches network
	const expectedChainId = parseNetworkChainId(requirements.network)
	if (expectedChainId === null) {
		return {
			code: 'CHAIN_ID_MISMATCH',
			message: `Invalid network format: ${requirements.network}`,
		}
	}
	if (tx.chainId !== expectedChainId) {
		return {
			code: 'CHAIN_ID_MISMATCH',
			message: `Transaction chain ID ${tx.chainId} does not match network ${requirements.network}`,
		}
	}

	// 7. Verify fee payer is not sender or recipient
	if (isAddressEqual(tx.from, feePayerAddress)) {
		return {
			code: 'FEE_PAYER_CONFLICT',
			message: 'Fee payer cannot be the transaction sender',
		}
	}
	if (isAddressEqual(transfer.recipient, feePayerAddress)) {
		return {
			code: 'FEE_PAYER_CONFLICT',
			message: 'Fee payer cannot be the transfer recipient',
		}
	}

	return null
}

/**
 * Check if the sender has sufficient token balance
 */
export async function checkSenderBalance(
	client: PublicClient,
	token: Address,
	sender: Address,
	requiredAmount: bigint,
): Promise<VerificationError | null> {
	try {
		const balance = await client.readContract({
			address: token,
			abi: Abis.tip20,
			functionName: 'balanceOf',
			args: [sender],
		})

		if (balance < requiredAmount) {
			return {
				code: 'INSUFFICIENT_BALANCE',
				message: `Sender balance ${balance} is less than required ${requiredAmount}`,
			}
		}

		return null
	} catch (error) {
		return {
			code: 'INSUFFICIENT_BALANCE',
			message: `Failed to check balance: ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}

/**
 * Simulate the transaction to ensure it will succeed
 */
export async function simulateTransaction(
	client: PublicClient,
	tx: ParsedTransaction,
): Promise<VerificationError | null> {
	try {
		await client.call({
			account: tx.from,
			to: tx.to,
			data: tx.data,
			value: tx.value,
		})
		return null
	} catch (error) {
		return {
			code: 'SIMULATION_FAILED',
			message: `Transaction simulation failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
		}
	}
}

export interface VerifyPayloadResult {
	tx: ParsedTransaction
	payer: Address
}

/**
 * Verify the full payment payload
 */
export async function verifyPaymentPayload(
	payload: TempoPaymentPayload,
	client: PublicClient,
	feePayerAddress: Address,
): Promise<Result<VerifyPayloadResult>> {
	const { accepted: requirements, payload: txPayload, createdAt } = payload

	// 1. Check timeout first (fast fail)
	const timeoutError = validateTimeout(
		createdAt,
		requirements.maxTimeoutSeconds,
	)
	if (timeoutError) {
		return err(timeoutError)
	}

	// 2. Parse and validate signed transaction
	const txResult = await parseSignedTransaction(txPayload.signedTransaction)
	if (!txResult.ok) {
		return txResult
	}
	const tx = txResult.value

	// 3. Decode and validate transfer calldata
	const transferResult = decodeTransferCalldata(tx.data)
	if (!transferResult.ok) {
		return transferResult
	}
	const transfer = transferResult.value

	// 4. Validate against payment requirements
	const validationError = validatePaymentRequirements(
		tx,
		transfer,
		requirements,
		feePayerAddress,
	)
	if (validationError) {
		return err(validationError)
	}

	// 5. Check sender balance
	const balanceError = await checkSenderBalance(
		client,
		requirements.asset as Address,
		tx.from,
		transfer.amount,
	)
	if (balanceError) {
		return err(balanceError)
	}

	// 6. Simulate transaction
	const simulationError = await simulateTransaction(client, tx)
	if (simulationError) {
		return err(simulationError)
	}

	return ok({ tx, payer: tx.from })
}
