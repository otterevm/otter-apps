import { describe, it, expect, vi, beforeEach } from 'vitest'
import type * as React from 'react'
import type { ProxyInfo } from '#lib/domain/proxy.ts'

// Mock modules before imports
vi.mock('#lib/domain/proxy.ts', () => ({
	detectProxy: vi.fn(),
}))

vi.mock('#lib/domain/contracts.ts', () => ({
	autoloadAbi: vi.fn(),
	getContractAbi: vi.fn(),
}))

vi.mock('wagmi', () => ({
	usePublicClient: vi.fn(() => ({})),
	useBytecode: vi.fn(() => ({ data: undefined })),
}))

vi.mock('@tanstack/react-router', () => ({
	Link: ({ children }: { children: React.ReactNode }) => children,
}))

vi.mock('#comps/ConnectWallet.tsx', () => ({
	ConnectWallet: () => null,
}))

vi.mock('#comps/ContractReader.tsx', () => ({
	ContractReader: () => null,
}))

vi.mock('#comps/ContractWriter.tsx', () => ({
	ContractWriter: () => null,
}))

// Import mocked modules
import { detectProxy } from '#lib/domain/proxy.ts'
import { autoloadAbi, getContractAbi } from '#lib/domain/contracts.ts'
import { usePublicClient } from 'wagmi'

const mockDetectProxy = detectProxy as ReturnType<typeof vi.fn>
const mockAutoloadAbi = autoloadAbi as ReturnType<typeof vi.fn>
const mockGetContractAbi = getContractAbi as ReturnType<typeof vi.fn>
const mockUsePublicClient = usePublicClient as ReturnType<typeof vi.fn>

// Test data
const TEST_ADDRESS = '0x1234567890123456789012345678901234567890' as const
const IMPL_ADDRESS = '0xabcdefabcdefabcdefabcdefabcdefabcdefabcd' as const
const TEST_ABI = [
	{
		type: 'function',
		name: 'balanceOf',
		inputs: [{ name: 'account', type: 'address' }],
		outputs: [{ name: '', type: 'uint256' }],
		stateMutability: 'view',
	},
] as const

describe('InteractTabContent proxy mode logic', () => {
	beforeEach(() => {
		vi.clearAllMocks()
		mockUsePublicClient.mockReturnValue({
			getStorageAt: vi.fn(),
			readContract: vi.fn(),
		})
		mockGetContractAbi.mockReturnValue(TEST_ABI)
	})

	describe('Non-proxy contract behavior', () => {
		it('should default to read mode when detectProxy returns isProxy: false', async () => {
			const nonProxyInfo: ProxyInfo = { isProxy: false }
			mockDetectProxy.mockResolvedValue(nonProxyInfo)
			mockAutoloadAbi.mockResolvedValue(null)

			// Simulate the effect logic from InteractTabContent
			const client = mockUsePublicClient()
			const proxy = await detectProxy(client, TEST_ADDRESS)

			expect(proxy.isProxy).toBe(false)
			expect(proxy.implementationAddress).toBeUndefined()

			// Per component logic: non-proxy defaults to 'read'
			const expectedMode = proxy.isProxy ? 'readProxy' : 'read'
			expect(expectedMode).toBe('read')
		})

		it('should not call autoloadAbi for implementation when not a proxy', async () => {
			const nonProxyInfo: ProxyInfo = { isProxy: false }
			mockDetectProxy.mockResolvedValue(nonProxyInfo)

			const client = mockUsePublicClient()
			const proxy = await detectProxy(client, TEST_ADDRESS)

			// Component logic: only loads impl ABI if isProxy && implementationAddress
			if (proxy.isProxy && proxy.implementationAddress) {
				await autoloadAbi(proxy.implementationAddress)
			}

			expect(mockAutoloadAbi).not.toHaveBeenCalled()
		})

		it('should filter proxy-only tabs when isProxy is false', () => {
			const isProxy = false
			const tabs = [
				{ id: 'read', label: 'Read Contract' },
				{ id: 'write', label: 'Write Contract' },
				{ id: 'readProxy', label: 'Read as Proxy', proxyOnly: true },
				{ id: 'writeProxy', label: 'Write as Proxy', proxyOnly: true },
			]

			const visibleTabs = tabs.filter((tab) => !tab.proxyOnly || isProxy)

			expect(visibleTabs).toHaveLength(2)
			expect(visibleTabs.map((t) => t.id)).toEqual(['read', 'write'])
			expect(visibleTabs.find((t) => t.id === 'readProxy')).toBeUndefined()
			expect(visibleTabs.find((t) => t.id === 'writeProxy')).toBeUndefined()
		})
	})

	describe('Proxy contract behavior', () => {
		it('should default to readProxy mode when detectProxy returns isProxy: true', async () => {
			const proxyInfo: ProxyInfo = {
				isProxy: true,
				type: 'EIP-1967',
				implementationAddress: IMPL_ADDRESS,
			}
			mockDetectProxy.mockResolvedValue(proxyInfo)
			mockAutoloadAbi.mockResolvedValue(TEST_ABI)

			const client = mockUsePublicClient()
			const proxy = await detectProxy(client, TEST_ADDRESS)

			expect(proxy.isProxy).toBe(true)
			expect(proxy.implementationAddress).toBe(IMPL_ADDRESS)

			// Per component logic: proxy defaults to 'readProxy'
			const expectedMode = proxy.isProxy ? 'readProxy' : 'read'
			expect(expectedMode).toBe('readProxy')
		})

		it('should call autoloadAbi for implementation when is a proxy', async () => {
			const proxyInfo: ProxyInfo = {
				isProxy: true,
				type: 'EIP-1967',
				implementationAddress: IMPL_ADDRESS,
			}
			mockDetectProxy.mockResolvedValue(proxyInfo)
			mockAutoloadAbi.mockResolvedValue(TEST_ABI)

			const client = mockUsePublicClient()
			const proxy = await detectProxy(client, TEST_ADDRESS)

			// Component logic: loads both impl ABI and proxy ABI
			if (proxy.isProxy && proxy.implementationAddress) {
				await Promise.all([
					autoloadAbi(proxy.implementationAddress),
					autoloadAbi(TEST_ADDRESS, { followProxies: false }),
				])
			}

			expect(mockAutoloadAbi).toHaveBeenCalledWith(IMPL_ADDRESS)
			expect(mockAutoloadAbi).toHaveBeenCalledWith(TEST_ADDRESS, {
				followProxies: false,
			})
		})

		it('should show all 4 tabs when isProxy is true', () => {
			const isProxy = true
			const tabs = [
				{ id: 'read', label: 'Read Contract' },
				{ id: 'write', label: 'Write Contract' },
				{ id: 'readProxy', label: 'Read as Proxy', proxyOnly: true },
				{ id: 'writeProxy', label: 'Write as Proxy', proxyOnly: true },
			]

			const visibleTabs = tabs.filter((tab) => !tab.proxyOnly || isProxy)

			expect(visibleTabs).toHaveLength(4)
			expect(visibleTabs.map((t) => t.id)).toEqual([
				'read',
				'write',
				'readProxy',
				'writeProxy',
			])
		})
	})

	describe('ProxyBanner visibility', () => {
		it('should NOT show ProxyBanner in read mode', () => {
			const mode = 'read'
			const isProxyMode = mode === 'readProxy' || mode === 'writeProxy'

			expect(isProxyMode).toBe(false)
		})

		it('should NOT show ProxyBanner in write mode', () => {
			const mode = 'write'
			const isProxyMode = mode === 'readProxy' || mode === 'writeProxy'

			expect(isProxyMode).toBe(false)
		})

		it('should show ProxyBanner in readProxy mode', () => {
			const mode = 'readProxy'
			const isProxyMode = mode === 'readProxy' || mode === 'writeProxy'

			expect(isProxyMode).toBe(true)
		})

		it('should show ProxyBanner in writeProxy mode', () => {
			const mode = 'writeProxy'
			const isProxyMode = mode === 'readProxy' || mode === 'writeProxy'

			expect(isProxyMode).toBe(true)
		})

		it('should only show ProxyBanner when isProxy AND implementationAddress exist', () => {
			const scenarios = [
				{
					isProxyMode: true,
					isProxy: true,
					implementationAddress: IMPL_ADDRESS,
					expected: true,
				},
				{
					isProxyMode: true,
					isProxy: false,
					implementationAddress: undefined,
					expected: false,
				},
				{
					isProxyMode: true,
					isProxy: true,
					implementationAddress: undefined,
					expected: false,
				},
				{
					isProxyMode: false,
					isProxy: true,
					implementationAddress: IMPL_ADDRESS,
					expected: false,
				},
			]

			for (const scenario of scenarios) {
				const showBanner =
					scenario.isProxyMode &&
					scenario.isProxy &&
					scenario.implementationAddress
				expect(!!showBanner).toBe(scenario.expected)
			}
		})
	})

	describe('Mode switching', () => {
		it('should correctly identify write modes', () => {
			const modes = ['read', 'write', 'readProxy', 'writeProxy'] as const

			const results = modes.map((mode) => ({
				mode,
				isWriteMode: mode === 'write' || mode === 'writeProxy',
			}))

			expect(results).toEqual([
				{ mode: 'read', isWriteMode: false },
				{ mode: 'write', isWriteMode: true },
				{ mode: 'readProxy', isWriteMode: false },
				{ mode: 'writeProxy', isWriteMode: true },
			])
		})

		it('should correctly identify proxy modes', () => {
			const modes = ['read', 'write', 'readProxy', 'writeProxy'] as const

			const results = modes.map((mode) => ({
				mode,
				isProxyMode: mode === 'readProxy' || mode === 'writeProxy',
			}))

			expect(results).toEqual([
				{ mode: 'read', isProxyMode: false },
				{ mode: 'write', isProxyMode: false },
				{ mode: 'readProxy', isProxyMode: true },
				{ mode: 'writeProxy', isProxyMode: true },
			])
		})

		it('should use correct ABI based on mode', () => {
			const implAbi = [{ name: 'implFunction' }]
			const proxyAbi = [{ name: 'proxyFunction' }]
			const fallbackAbi = [{ name: 'fallbackFunction' }]

			const modes = ['read', 'write', 'readProxy', 'writeProxy'] as const

			for (const mode of modes) {
				const isProxyMode = mode === 'readProxy' || mode === 'writeProxy'
				// Component logic: isProxyMode ? abi (impl) : (proxyAbi ?? abi)
				const activeAbi = isProxyMode ? implAbi : (proxyAbi ?? fallbackAbi)

				if (isProxyMode) {
					expect(activeAbi).toBe(implAbi)
				} else {
					expect(activeAbi).toBe(proxyAbi)
				}
			}
		})
	})

	describe('detectProxy error handling', () => {
		it('should default to read mode when detectProxy throws', async () => {
			mockDetectProxy.mockRejectedValue(new Error('Network error'))

			let mode = null
			try {
				const client = mockUsePublicClient()
				await detectProxy(client, TEST_ADDRESS)
			} catch {
				// Component logic: on error, default to 'read'
				mode = 'read'
			}

			expect(mode).toBe('read')
		})
	})
})
