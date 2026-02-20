import {
	Link,
	useNavigate,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import * as React from 'react'
import { ExploreInput } from '#comps/ExploreInput'
import { HeaderWallet } from '#comps/HeaderWallet'
import { useAnimatedBlockNumber, useLiveBlockNumber } from '#lib/block-number'
import { cx } from '#lib/css'
import { isTestnet } from '#lib/env'
import { useIsMounted } from '#lib/hooks'
import SquareSquare from '~icons/lucide/square-square'
import { ThemeToggle } from '#comps/ThemeToggle'

export function Header(props: Header.Props) {
	const { initialBlockNumber } = props

	return (
		<header className="@container relative z-1">
			<div className="px-[24px] @min-[1240px]:pt-[48px] @min-[1240px]:px-[84px] flex items-center justify-between min-h-16 pt-[36px] select-none relative z-1 print:justify-center">
				<div className="flex items-center gap-[12px] relative z-1 h-[28px]">
					<Link to="/" className="flex items-center press-down py-[4px]">
						<Header.Logo />
					</Link>
				</div>
				<Header.Search />
				<div className="relative z-1 print:hidden flex items-center gap-[8px]">
					<ThemeToggle />
					<Header.BlockNumber initial={initialBlockNumber} />
					<HeaderWallet />
				</div>
			</div>
			<Header.Search compact />
		</header>
	)
}

export namespace Header {
	export interface Props {
		initialBlockNumber?: bigint
	}

	export function Search(props: { compact?: boolean }) {
		const { compact = false } = props
		const router = useRouter()
		const navigate = useNavigate()
		const [inputValue, setInputValue] = React.useState('')

		const [delayedNavigating, setDelayedNavigating] = React.useState(false)
		const { resolvedPathname, isNavigating } = useRouterState({
			select: (state) => ({
				resolvedPathname:
					state.resolvedLocation?.pathname ?? state.location.pathname,
				isNavigating: state.status === 'pending',
			}),
		})
		const showSearch = resolvedPathname !== '/'

		const isMounted = useIsMounted()

		React.useEffect(() => {
			return router.subscribe('onResolved', ({ hrefChanged }) => {
				if (hrefChanged) setInputValue('')
			})
		}, [router])

		// delay disabling the input to avoid blinking on fast navigations
		React.useEffect(() => {
			if (!isNavigating) {
				setDelayedNavigating(false)
				return
			}
			const timer = setTimeout(() => setDelayedNavigating(true), 100)
			return () => clearTimeout(timer)
		}, [isNavigating])

		if (!showSearch) return null

		const exploreInput = (
			<ExploreInput
				value={inputValue}
				onChange={setInputValue}
				disabled={isMounted && delayedNavigating}
				onActivate={({ value, type }) => {
					if (type === 'block') {
						navigate({ to: '/block/$id', params: { id: value } })
						return
					}
					if (type === 'hash') {
						navigate({ to: '/receipt/$hash', params: { hash: value } })
						return
					}
					if (type === 'token') {
						navigate({ to: '/token/$address', params: { address: value } })
						return
					}
					if (type === 'address') {
						navigate({
							to: '/address/$address',
							params: { address: value },
						})
						return
					}
				}}
			/>
		)

		if (compact)
			return (
				<div className="@min-[800px]:hidden sticky top-0 z-10 px-4 pt-[16px] pb-[12px] print:hidden">
					<ExploreInput
						wide
						value={inputValue}
						onChange={setInputValue}
						disabled={isMounted && delayedNavigating}
						onActivate={({ value, type }) => {
							if (type === 'block') {
								navigate({ to: '/block/$id', params: { id: value } })
								return
							}
							if (type === 'hash') {
								navigate({ to: '/receipt/$hash', params: { hash: value } })
								return
							}
							if (type === 'token') {
								navigate({ to: '/token/$address', params: { address: value } })
								return
							}
							if (type === 'address') {
								navigate({
									to: '/address/$address',
									params: { address: value },
								})
								return
							}
						}}
					/>
				</div>
			)

		return (
			<>
				<div className="absolute left-0 right-0 justify-center flex z-1 h-0 items-center @max-[1239px]:hidden print:hidden">
					{exploreInput}
				</div>
				<div className="flex-1 flex justify-center px-[24px] @max-[799px]:hidden @min-[1240px]:hidden print:hidden">
					<ExploreInput
						wide
						value={inputValue}
						onChange={setInputValue}
						disabled={isMounted && delayedNavigating}
						onActivate={({ value, type }) => {
							if (type === 'block') {
								navigate({ to: '/block/$id', params: { id: value } })
								return
							}
							if (type === 'hash') {
								navigate({ to: '/receipt/$hash', params: { hash: value } })
								return
							}
							if (type === 'token') {
								navigate({ to: '/token/$address', params: { address: value } })
								return
							}
							if (type === 'address') {
								navigate({
									to: '/address/$address',
									params: { address: value },
								})
								return
							}
						}}
					/>
				</div>
			</>
		)
	}

	export function BlockNumber(props: BlockNumber.Props) {
		const { initial, className } = props
		const resolvedPathname = useRouterState({
			select: (state) =>
				state.resolvedLocation?.pathname ?? state.location.pathname,
		})
		const optimisticBlockNumber = useAnimatedBlockNumber(initial)
		const liveBlockNumber = useLiveBlockNumber(initial)
		const blockNumber =
			resolvedPathname === '/blocks' ? liveBlockNumber : optimisticBlockNumber
		const isMounted = useIsMounted()

		// Prevent hydration mismatch by not rendering interactive element until mounted
		if (!isMounted) {
			return (
				<div
					className={cx(
						className,
						'flex items-center gap-[6px] text-[15px] font-medium text-secondary',
					)}
					title="View latest block"
				>
					<SquareSquare className="size-[18px] text-accent" />
					<div className="text-nowrap">
						<span className="text-primary font-medium tabular-nums font-mono min-w-[6ch] inline-block">
							{blockNumber != null ? String(blockNumber) : '…'}
						</span>
					</div>
				</div>
			)
		}

		return (
			<Link
				disabled={!isTestnet()}
				to="/block/$id"
				params={{ id: blockNumber != null ? String(blockNumber) : 'latest' }}
				className={cx(
					className,
					'flex items-center gap-[6px] text-[15px] font-medium text-secondary press-down',
				)}
				title="View latest block"
			>
				<SquareSquare className="size-[18px] text-accent" />
				<div className="text-nowrap">
					<span className="text-primary font-medium tabular-nums font-mono min-w-[6ch] inline-block">
						{blockNumber != null ? String(blockNumber) : '…'}
					</span>
				</div>
			</Link>
		)
	}

	export namespace BlockNumber {
		export interface Props {
			initial?: bigint
			className?: string | undefined
		}
	}

	export function Logo(props: Logo.Props) {
		const { className } = props

		const baseClass = 'h-14 w-auto'
		const classes = className ? `${baseClass} ${className}` : baseClass
		const logoUrl = import.meta.env.VITE_LOGO_URL || '/logo.svg'
		const chainName = import.meta.env.VITE_CHAIN_NAME || 'OtterEVM'

		return <img alt={chainName} className={classes} src={logoUrl} />
	}

	export namespace Logo {
		export interface Props {
			className?: string
		}
	}
}
