import { Link } from '@tanstack/react-router'
import type { Address } from 'ox'
import { cx } from '#lib/css'
import type { ContractSource } from '#lib/domain/contract-source.ts'
import ArrowRightIcon from '~icons/lucide/arrow-right'

type ProxyResolution = NonNullable<ContractSource['proxyResolution']>

const PROXY_TYPE_LABELS: Record<ProxyResolution['proxyType'] & string, string> =
	{
		EIP1167Proxy: 'EIP-1167 Minimal Proxy',
		FixedProxy: 'Fixed Proxy',
		EIP1967Proxy: 'EIP-1967 Proxy',
		GnosisSafeProxy: 'Gnosis Safe Proxy',
		DiamondProxy: 'ERC-2535 Diamond',
		PROXIABLEProxy: 'UUPS (ERC-1822)',
		ZeppelinOSProxy: 'ZeppelinOS Proxy',
		SequenceWalletProxy: 'Sequence Wallet Proxy',
	}

export function ProxyBadge(props: ProxyBadge.Props) {
	const { proxyResolution, className } = props

	if (!proxyResolution?.isProxy) return null

	const proxyLabel = proxyResolution.proxyType
		? PROXY_TYPE_LABELS[proxyResolution.proxyType]
		: 'Proxy Contract'

	const implementations = proxyResolution.implementations

	return (
		<div className={cx('flex flex-col gap-2', className)}>
			<div className="flex items-center gap-2 flex-wrap">
				<span className="inline-flex items-center gap-1.5 text-[11px] font-medium bg-accent/10 text-accent rounded-md px-[8px] py-[3px]">
					{proxyLabel}
				</span>
				{implementations.length > 0 && (
					<div className="flex items-center gap-1.5 text-[12px] text-secondary">
						<ArrowRightIcon className="size-[12px]" />
						<span className="text-tertiary">Implementation:</span>
						{implementations.map((impl, index) => (
							<Link
								key={impl.address}
								to="/address/$address"
								params={{ address: impl.address as Address.Address }}
								className="font-mono text-accent hover:underline"
							>
								{impl.address.slice(0, 10)}...{impl.address.slice(-8)}
								{index < implementations.length - 1 && ', '}
							</Link>
						))}
					</div>
				)}
			</div>
		</div>
	)
}

export declare namespace ProxyBadge {
	type Props = {
		proxyResolution: ProxyResolution | null
		className?: string
	}
}
