import { whatsabi, providers } from '@shazow/whatsabi'
import type { Address } from 'ox'
import { createPublicClient, http } from 'viem'

import { chains } from '#chains.ts'

/**
 * Proxy types that can be detected.
 * Matches the OpenAPI schema in openapi.json.
 */
export type ProxyType =
	| 'EIP1167Proxy'
	| 'FixedProxy'
	| 'EIP1967Proxy'
	| 'GnosisSafeProxy'
	| 'DiamondProxy'
	| 'PROXIABLEProxy'
	| 'ZeppelinOSProxy'
	| 'SequenceWalletProxy'

export type ProxyResolution = {
	isProxy: boolean
	proxyType: ProxyType | null
	implementations: Array<{
		address: string
	}>
}

/**
 * Map whatsabi proxy resolver names to our ProxyType enum.
 */
function mapProxyType(name: string): ProxyType | null {
	const mapping: Record<string, ProxyType> = {
		EIP1167Proxy: 'EIP1167Proxy',
		FixedProxy: 'FixedProxy',
		EIP1967Proxy: 'EIP1967Proxy',
		GnosisSafeProxy: 'GnosisSafeProxy',
		DiamondProxy: 'DiamondProxy',
		PROXIABLEProxy: 'PROXIABLEProxy',
		ZeppelinOSProxy: 'ZeppelinOSProxy',
		SequenceWalletProxy: 'SequenceWalletProxy',
	}
	return mapping[name] ?? null
}

/**
 * Check if an address is the zero address.
 */
function isZeroAddress(address: string): boolean {
	return (
		address === '0x0000000000000000000000000000000000000000' ||
		address === '0x0'
	)
}

export type ProxyDetection = {
	isProxy: boolean
	proxyType: ProxyType | null
}

/**
 * Detect if a contract is a proxy based purely on bytecode analysis.
 *
 * This function does NOT make any RPC calls - it only analyzes bytecode patterns.
 * Use this at verification time to store proxy information in the database.
 *
 * @param runtimeBytecode - The runtime bytecode of the contract
 * @returns ProxyDetection with isProxy and proxyType, or null if detection fails
 */
export async function detectProxy(
	runtimeBytecode: string,
): Promise<ProxyDetection | null> {
	const dummyAddress = '0x0000000000000000000000000000000000000001' as const

	try {
		// Create a minimal mock provider that only returns cached bytecode
		const mockProvider = providers.WithCachedCode(
			{
				getStorageAt: () => Promise.reject(new Error('No RPC calls allowed')),
				call: () => Promise.reject(new Error('No RPC calls allowed')),
				getCode: () => Promise.resolve(runtimeBytecode),
			},
			{ [dummyAddress]: runtimeBytecode },
		)

		const result = await whatsabi.autoload(dummyAddress, {
			provider: mockProvider,
			followProxies: false,
			abiLoader: false,
			signatureLookup: false,
		})

		if (!result.proxies || result.proxies.length === 0) {
			return {
				isProxy: false,
				proxyType: null,
			}
		}

		const primaryProxy = result.proxies[0]!
		return {
			isProxy: true,
			proxyType: mapProxyType(primaryProxy.name),
		}
	} catch {
		return null
	}
}

/**
 * Resolve proxy information for a contract.
 *
 * Uses whatsabi to detect proxy patterns and resolve implementation addresses.
 *
 * @param chainId - The chain ID where the contract is deployed
 * @param address - The contract address to analyze
 * @param runtimeBytecode - The runtime bytecode of the contract (to avoid eth_getCode RPC call)
 * @returns ProxyResolution or null if resolution fails
 */
export async function resolveProxy(
	chainId: number,
	address: Address.Address,
	runtimeBytecode?: string,
): Promise<ProxyResolution | null> {
	const chain = chains[chainId as keyof typeof chains]
	if (!chain) return null

	const rpcUrl = chain.rpcUrls.default.http.at(0)
	if (!rpcUrl) return null

	try {
		const viemClient = createPublicClient({
			chain,
			transport: http(rpcUrl, { timeout: 5_000 }),
		})

		// Wrap viem client to match whatsabi's expected interface
		// Use WithCachedCode to skip eth_getCode RPC call if we have the bytecode
		let provider = providers.CompatibleProvider(viemClient)
		if (runtimeBytecode) {
			provider = providers.WithCachedCode(provider, {
				[address]: runtimeBytecode,
			})
		}

		const result = await whatsabi.autoload(address, {
			provider,
			followProxies: false,
			abiLoader: false,
			signatureLookup: false,
		})

		if (!result.proxies || result.proxies.length === 0) {
			return {
				isProxy: false,
				proxyType: null,
				implementations: [],
			}
		}

		const primaryProxy = result.proxies[0]!
		const proxyType = mapProxyType(primaryProxy.name)

		const implementations: Array<{ address: string }> = []

		for (const proxy of result.proxies) {
			try {
				const implAddress = await proxy.resolve(provider, address)
				if (implAddress && !isZeroAddress(implAddress)) {
					const exists = implementations.some(
						(impl) => impl.address.toLowerCase() === implAddress.toLowerCase(),
					)
					if (!exists) {
						implementations.push({ address: implAddress })
					}
				}
			} catch {
				// Skip proxies that fail to resolve
			}
		}

		return {
			isProxy: true,
			proxyType,
			implementations,
		}
	} catch {
		return null
	}
}
