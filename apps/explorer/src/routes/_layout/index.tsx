import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { waapi, stagger } from 'animejs'
import type { Address, Hex } from 'ox'
import * as React from 'react'
import { ExploreInput } from '#comps/ExploreInput'
import { cx } from '#lib/css'
import { springInstant, springBouncy, springSmooth } from '#lib/animation'
import { Intro, type IntroPhase, useIntroSeen } from '#comps/Intro'
import { useChainConfig } from '#hooks/useChainConfig'
import BoxIcon from '~icons/lucide/box'
import ChevronDownIcon from '~icons/lucide/chevron-down'
import CoinsIcon from '~icons/lucide/coins'
import FileIcon from '~icons/lucide/file'
import ReceiptIcon from '~icons/lucide/receipt'
import ShieldCheckIcon from '~icons/lucide/shield-check'
import ShuffleIcon from '~icons/lucide/shuffle'
import UserIcon from '~icons/lucide/user'
import ZapIcon from '~icons/lucide/zap'

const SPOTLIGHT_DATA: Record<
	string,
	{
		accountAddress: Address.Address
		contractAddress: Address.Address
		receiptHash: Hex.Hex | null
		paymentHash: Hex.Hex | null
		swapHash: Hex.Hex | null
		mintHash: Hex.Hex | null
	}
> = {
	testnet: {
		accountAddress: '0x5bc1473610754a5ca10749552b119df90c1a1877',
		contractAddress: '0x9b400b4c962463E840cCdbE2493Dc6Ab78768266',
		receiptHash:
			'0x6d6d8c102064e6dee44abad2024a8b1d37959230baab80e70efbf9b0c739c4fd',
		paymentHash:
			'0x33cdfc39dcda535aac88e7fe3a79954e0740ec26a2fe54eb5481a4cfc0cb8024',
		swapHash:
			'0x8b6cdb1f6193c17a3733aec315441ab92bca3078b462b27863509a279a5ea6e0',
		mintHash:
			'0xe5c909ef42674965a8b805118f08b58f215a98661838ae187737841531097b70',
	},
	moderato: {
		accountAddress: '0xa726a1CD723409074DF9108A2187cfA19899aCF8',
		contractAddress: '0x52db6B29F1032b55F1C28354055539b1931CB26e',
		receiptHash:
			'0x429eb0d8a4565138aec97fe11c8f2f4e56f26725e3a428881bbeba6c4e8ecdc9',
		paymentHash:
			'0x429eb0d8a4565138aec97fe11c8f2f4e56f26725e3a428881bbeba6c4e8ecdc9',
		swapHash:
			'0xc61b40cfc6714a893e3d758f2db3e19cd54f175369e17c48591654b294332cf9',
		mintHash:
			'0x58fcdd78477f7ee402320984e990e7a1623d80b768afb03f9b27fd2eac395032',
	},
	presto: {
		accountAddress: '0x85269497F0b602a718b85DB5ce490A6c88d01c0E',
		contractAddress: '0x271c4d8616ed81c2cc006446c61f25219b182f8a',
		receiptHash:
			'0x2e455936243560a540a1cf25203ef6bb70eb5410667922a1d2e3ad69eb891983',
		paymentHash:
			'0x2e455936243560a540a1cf25203ef6bb70eb5410667922a1d2e3ad69eb891983',
		swapHash: null,
		mintHash:
			'0xc2ecd6749cac0ddce9511cbffe91c2a3de7c2b93d28e35d2d57b7ef4380bc37b',
	},
	// Fallback for custom chains - uses testnet data as placeholder
	custom: {
		accountAddress: '0x0000000000000000000000000000000000000000',
		contractAddress: '0x0000000000000000000000000000000000000000',
		receiptHash: null,
		paymentHash: null,
		swapHash: null,
		mintHash: null,
	},
}

const spotlightData =
	SPOTLIGHT_DATA[import.meta.env.VITE_TEMPO_ENV] ?? SPOTLIGHT_DATA.custom

export const Route = createFileRoute('/_layout/')({
	component: Component,
})

function Component() {
	const router = useRouter()
	const navigate = useNavigate()
	const introSeen = useIntroSeen()
	const introSeenOnMount = React.useRef(introSeen)
	const [inputValue, setInputValue] = React.useState('')
	const [isMounted, setIsMounted] = React.useState(false)
	const [inputReady, setInputReady] = React.useState(false)
	const exploreInputRef = React.useRef<HTMLInputElement>(null)
	const exploreWrapperRef = React.useRef<HTMLDivElement>(null)
	const isNavigating = useRouterState({
		select: (state) => state.status === 'pending',
	})

	React.useEffect(() => setIsMounted(true), [])

	React.useEffect(() => {
		return router.subscribe('onResolved', ({ hrefChanged }) => {
			if (hrefChanged) setInputValue('')
		})
	}, [router])

	const handlePhaseChange = React.useCallback((phase: IntroPhase) => {
		if (phase !== 'start' || !exploreWrapperRef.current) return

		const seen = introSeenOnMount.current
		setTimeout(
			() => {
				setInputReady(true)
				if (exploreWrapperRef.current) {
					exploreWrapperRef.current.style.pointerEvents = 'auto'
					waapi.animate(exploreWrapperRef.current, {
						opacity: [0, 1],
						scale: [seen ? 0.97 : 0.94, 1],
						ease: seen ? springInstant : springBouncy,
					})
				}
				exploreInputRef.current?.focus()
			},
			seen ? 0 : 240,
		)
	}, [])

	return (
		<div className="flex flex-1 size-full items-center justify-center text-[16px]">
			<div className="grid place-items-center relative grid-flow-row gap-5 select-none w-full pt-15 pb-10 z-1">
				<Intro onPhaseChange={handlePhaseChange} />
				<div className="w-full my-3 px-4 flex justify-center relative z-20">
					<ExploreInput
						inputRef={exploreInputRef}
						wrapperRef={exploreWrapperRef}
						size="large"
						value={inputValue}
						onChange={setInputValue}
						disabled={isMounted && isNavigating}
						tabIndex={inputReady ? 0 : -1}
						onActivate={(data) => {
							if (data.type === 'block') {
								navigate({
									to: '/block/$id',
									params: { id: data.value },
								})
								return
							}
							if (data.type === 'hash') {
								navigate({
									to: '/receipt/$hash',
									params: { hash: data.value },
								})
								return
							}
							if (data.type === 'token') {
								navigate({
									to: '/token/$address',
									params: { address: data.value },
								})
								return
							}
							if (data.type === 'address') {
								navigate({
									to: '/address/$address',
									params: { address: data.value },
								})
								return
							}
						}}
					/>
				</div>
				<ChainInfo />
				<SpotlightLinks />
			</div>
		</div>
	)
}

function ChainInfo() {
	const { data: config, isLoading } = useChainConfig()

	if (isLoading || !config) {
		return (
			<div className="flex flex-col items-center gap-3 px-4">
				<div className="text-[15px] text-secondary">Loading...</div>
			</div>
		)
	}

	const { chainName, chainId, rpcUrl, expUrl, nativeCurrency } = config

	const addToMetaMask = async () => {
		const eth = (
			window as unknown as {
				ethereum?: {
					request: (args: {
						method: string
						params?: unknown[]
					}) => Promise<unknown>
				}
			}
		).ethereum
		if (typeof window === 'undefined' || !eth) {
			alert('Please install MetaMask or a Web3 wallet')
			return
		}

		try {
			await eth.request({
				method: 'wallet_addEthereumChain',
				params: [
					{
						chainId: `0x${Number(chainId).toString(16)}`,
						chainName: chainName,
						nativeCurrency: {
							name: nativeCurrency,
							symbol: nativeCurrency,
							decimals: 18,
						},
						rpcUrls: [rpcUrl || `${window.location.origin}/rpc`],
						blockExplorerUrls: [expUrl || window.location.origin],
					},
				],
			})
		} catch (error) {
			console.error('Failed to add chain:', error)
		}
	}

	return (
		<div className="flex flex-col items-center gap-3 px-4">
			<div className="flex items-center gap-2 text-[15px] text-secondary">
				<span className="font-medium">Blockchain:</span>
				<span className="text-primary font-semibold">{chainName}</span>
				<span className="text-muted">|</span>
				<span className="font-medium">Chain ID:</span>
				<span className="text-primary font-mono">{chainId}</span>
			</div>
			<button
				type="button"
				onClick={addToMetaMask}
				className="flex items-center gap-2 px-4 py-2 bg-orange-500 hover:bg-orange-600 text-white rounded-lg font-medium transition-colors text-[14px]"
			>
				<svg
					className="w-5 h-5"
					viewBox="0 0 24 24"
					fill="currentColor"
					role="img"
					aria-label="MetaMask"
				>
					<title>MetaMask</title>
					<path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
					<path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
					<path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
					<path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
				</svg>
				Add to MetaMask
			</button>
		</div>
	)
}

function SpotlightLinks() {
	const introSeen = useIntroSeen()
	const [actionOpen, setActionOpen] = React.useState(false)
	const [menuMounted, setMenuMounted] = React.useState(false)
	const dropdownRef = React.useRef<HTMLDivElement>(null)
	const dropdownMenuRef = React.useRef<HTMLDivElement>(null)
	const hoverTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
		null,
	)
	const closingRef = React.useRef(false)
	const pillsRef = React.useRef<HTMLDivElement>(null)
	const introSeenOnMount = React.useRef(introSeen)

	const closeMenu = React.useCallback(() => {
		setActionOpen(false)
		if (dropdownMenuRef.current) {
			closingRef.current = true
			waapi
				.animate(dropdownMenuRef.current, {
					opacity: [1, 0],
					scale: [1, 0.97],
					translateY: [0, -4],
					ease: springInstant,
				})
				.then(() => {
					if (!closingRef.current) return
					setMenuMounted(false)
				})
		} else {
			setMenuMounted(false)
		}
	}, [])

	React.useEffect(() => {
		function handleClickOutside(event: MouseEvent) {
			if (
				dropdownRef.current &&
				!dropdownRef.current.contains(event.target as Node)
			) {
				closeMenu()
			}
		}
		document.addEventListener('mousedown', handleClickOutside)
		return () => document.removeEventListener('mousedown', handleClickOutside)
	}, [closeMenu])

	React.useEffect(() => {
		if (!pillsRef.current) return
		const seen = introSeenOnMount.current
		const children = [...pillsRef.current.children]
		const delay = seen ? 0 : 320
		setTimeout(() => {
			for (const child of children) {
				;(child as HTMLElement).style.pointerEvents = 'auto'
			}
		}, delay)
		const anim = waapi.animate(children as HTMLElement[], {
			opacity: [0, 1],
			translateY: [seen ? 4 : 8, 0],
			scale: [0.97, 1],
			ease: seen ? springInstant : springSmooth,
			delay: seen ? stagger(10) : stagger(20, { start: delay, from: 'first' }),
		})
		anim.then(() => {
			for (const child of children) {
				;(child as HTMLElement).style.transform = ''
			}
		})
		return () => {
			try {
				anim.cancel()
			} catch {}
		}
	}, [])

	React.useEffect(() => {
		if (actionOpen) setMenuMounted(true)
	}, [actionOpen])

	React.useLayoutEffect(() => {
		if (!dropdownMenuRef.current) return
		if (actionOpen && menuMounted) {
			waapi.animate(dropdownMenuRef.current, {
				opacity: [0, 1],
				scale: [0.97, 1],
				translateY: [-4, 0],
				ease: springInstant,
			})
		}
	}, [actionOpen, menuMounted])

	const handleMouseEnter = () => {
		if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current)
		if (closingRef.current && dropdownMenuRef.current) {
			closingRef.current = false
			waapi.animate(dropdownMenuRef.current, {
				opacity: 1,
				scale: 1,
				ease: springInstant,
			})
		}
		setActionOpen(true)
	}

	const handleMouseLeave = () => {
		hoverTimeoutRef.current = setTimeout(() => closeMenu(), 150)
	}

	const actionTypes = spotlightData
		? [
				{ label: 'Payment', hash: spotlightData.paymentHash },
				{ label: 'Swap', hash: spotlightData.swapHash },
				{ label: 'Mint', hash: spotlightData.mintHash },
			].filter((a): a is { label: string; hash: Hex.Hex } => a.hash !== null)
		: []

	return (
		<section className="text-center max-w-[500px] px-4">
			<div
				ref={pillsRef}
				className="group/pills flex items-center gap-2 text-[13px] flex-wrap justify-center"
			>
				{spotlightData && (
					<>
						<SpotlightPill
							to="/address/$address"
							params={{ address: spotlightData.accountAddress }}
							icon={<UserIcon className="size-[14px] text-accent" />}
							badge={<ShuffleIcon className="size-[10px] text-secondary" />}
						>
							Account
						</SpotlightPill>
						<SpotlightPill
							to="/address/$address"
							params={{ address: spotlightData.contractAddress }}
							search={{ tab: 'contract' }}
							icon={<FileIcon className="size-[14px] text-accent" />}
							badge={<ShuffleIcon className="size-[10px] text-secondary" />}
						>
							Contract
						</SpotlightPill>
						{spotlightData.receiptHash && (
							<SpotlightPill
								to="/receipt/$hash"
								params={{ hash: spotlightData.receiptHash }}
								icon={<ReceiptIcon className="size-[14px] text-accent" />}
							>
								Receipt
							</SpotlightPill>
						)}
						{/** biome-ignore lint/a11y/noStaticElementInteractions: _ */}
						<div
							className="relative group-hover/pills:opacity-40 hover:opacity-100"
							ref={dropdownRef}
							onMouseEnter={handleMouseEnter}
							onMouseLeave={handleMouseLeave}
							style={{
								opacity: 0,
								pointerEvents: 'none',
								zIndex: actionOpen ? 100 : 'auto',
							}}
						>
							<button
								type="button"
								onClick={() => (actionOpen ? closeMenu() : setActionOpen(true))}
								className="flex items-center gap-1.5 text-base-content-secondary hover:text-base-content border border-base-border hover:border-accent focus-visible:border-accent px-2.5 py-1 rounded-full! press-down bg-surface focus-visible:outline-none cursor-pointer"
							>
								<ZapIcon className="size-[14px] text-accent" />
								<span>Action</span>
								<ChevronDownIcon
									className={`size-[12px] transition-transform ${
										actionOpen ? 'rotate-180' : ''
									}`}
								/>
							</button>
							{menuMounted && (
								<div className="absolute top-full left-1/2 -translate-x-1/2 pt-2 z-50">
									<div
										ref={dropdownMenuRef}
										className="bg-base-plane rounded-full p-1 border border-base-border shadow-xl flex items-center relative z-60"
										style={{ opacity: 0 }}
									>
										{actionTypes.map((action, i) => (
											<Link
												key={action.label}
												to="/tx/$hash"
												params={{ hash: action.hash }}
												preload="render"
												className={`px-2.5 py-1 text-[12px] text-base-content-secondary hover:text-base-content hover:bg-base-border/40 whitespace-nowrap focus-visible:outline-offset-0 press-down cursor-pointer ${
													i === 0
														? 'rounded-l-[14px]! rounded-r-[2px]!'
														: i === actionTypes.length - 1
															? 'rounded-r-[14px]! rounded-l-[2px]!'
															: 'rounded-[2px]!'
												}`}
											>
												{action.label}
											</Link>
										))}
									</div>
								</div>
							)}
						</div>
					</>
				)}
				<SpotlightPill
					to="/blocks"
					icon={<BoxIcon className="size-[14px] text-accent" />}
				>
					Blocks
				</SpotlightPill>
				<SpotlightPill
					to="/tokens"
					icon={<CoinsIcon className="size-[14px] text-accent" />}
				>
					Tokens
				</SpotlightPill>
				<SpotlightPill
					to="/validators"
					icon={<ShieldCheckIcon className="size-[14px] text-accent" />}
				>
					Validators
				</SpotlightPill>
			</div>
		</section>
	)
}

function SpotlightPill(props: {
	className?: string
	to: string
	params?: Record<string, string>
	search?: Record<string, string>
	icon: React.ReactNode
	badge?: React.ReactNode
	children: React.ReactNode
}) {
	const { className, to, params, search, icon, badge, children } = props
	return (
		<Link
			to={to}
			{...(params ? { params } : {})}
			{...(search ? { search } : {})}
			preload="render"
			className={cx(
				'relative flex items-center gap-1.5 text-base-content-secondary hover:text-base-content border hover:border-accent focus-visible:border-accent py-1 rounded-full! press-down group-hover/pills:opacity-40 hover:opacity-100 bg-surface focus-visible:outline-none border-base-border transition-colors duration-300 ease-out focus-visible:duration-0',
				badge ? 'pl-2.5 pr-4' : 'px-2.5',
				className,
			)}
			style={{ opacity: 0, pointerEvents: 'none' }}
		>
			{icon}
			<span>{children}</span>
			{badge && (
				<span className="absolute -top-1.5 -right-1.5 size-[18px] flex items-center justify-center rounded-full bg-base-plane border border-base-border text-base-content">
					{badge}
				</span>
			)}
		</Link>
	)
}
