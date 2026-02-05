/**
 * Test fixtures for E2E testing of proxy contract support.
 *
 * These contracts were deployed specifically for testing the explorer's
 * proxy detection and interaction features.
 *
 * Deployed by agent wallet: 0xB1d06991Ec388EA23094Ea46fCeEd4f9DB44412A
 *
 * To redeploy if needed:
 *   cd /tmp/proxy-contracts && forge create src/Counter.sol:Counter --broadcast ...
 *   See scripts/deploy-test-proxy.ts for full deployment script
 */

/**
 * Test proxy contract on Moderato (chain 42431).
 *
 * This is an EIP-1967 transparent proxy pointing to a Counter implementation.
 * Both proxy and implementation are verified on Tempo's contract verification service.
 */
export const TEST_PROXY_MODERATO = {
	chainId: 42431,
	proxyAddress: '0x208bCdDAEF21A04877B8aB34b13a3975a4f84d69' as const,
	implementationAddress: '0x81BD4C60469e59Aa89aF09C804c0808D935DB8bb' as const,
	proxyType: 'EIP-1967' as const,
	deployedAt: '2026-02-05',
	txHashes: {
		implementation:
			'0xd7b15fd41464a8fe2c6b945a2cee2a085f95b9ee52f47f463f459507ca8dae23',
		proxy: '0x6a5f89a6146f3b4274e210ac742110980489bfdbc7f375dab9faba90c27ba7d8',
	},
}

/**
 * Implementation contract ABI (Counter).
 * Functions: count(), increment(), decrement(), setCount(uint256)
 */
export const COUNTER_ABI = [
	{
		inputs: [],
		name: 'count',
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
		type: 'function',
	},
	{
		inputs: [],
		name: 'decrement',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [],
		name: 'increment',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
	{
		inputs: [{ name: '_count', type: 'uint256' }],
		name: 'setCount',
		outputs: [],
		stateMutability: 'nonpayable',
		type: 'function',
	},
] as const

/**
 * Proxy contract ABI (TransparentProxy).
 * Note: The proxy itself has no functions - it delegates all calls.
 * This ABI is for the proxy's own storage, not the implementation.
 */
export const TRANSPARENT_PROXY_ABI = [
	{
		inputs: [{ name: 'implementation_', type: 'address' }],
		stateMutability: 'nonpayable',
		type: 'constructor',
	},
	{ stateMutability: 'payable', type: 'fallback' },
	{ stateMutability: 'payable', type: 'receive' },
] as const
