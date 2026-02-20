import {
	createFileRoute,
	Link,
	useNavigate,
	useRouter,
	useRouterState,
} from '@tanstack/react-router'
import { waapi, stagger } from 'animejs'
import * as React from 'react'
import { ExploreInput } from '#comps/ExploreInput'
import { ChainInfo } from '#comps/ChainInfo'
import { cx } from '#lib/css'
import { springInstant, springBouncy, springSmooth } from '#lib/animation'
import { Intro, type IntroPhase, useIntroSeen } from '#comps/Intro'
import BoxIcon from '~icons/lucide/box'
import CoinsIcon from '~icons/lucide/coins'
import PlusIcon from '~icons/lucide/plus'
import ShieldCheckIcon from '~icons/lucide/shield-check'

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
				<div className="w-full flex justify-center px-4">
					<ChainInfo />
				</div>
				<SpotlightLinks />
			</div>
		</div>
	)
}

function SpotlightLinks() {
	const introSeen = useIntroSeen()
	const pillsRef = React.useRef<HTMLDivElement>(null)
	const introSeenOnMount = React.useRef(introSeen)

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

	return (
		<section className="text-center max-w-[500px] px-4">
			<div
				ref={pillsRef}
				className="group/pills flex items-center gap-2 text-[13px] flex-wrap justify-center"
			>
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
				<SpotlightPill
					to="/issue-token"
					icon={<PlusIcon className="size-[14px] text-accent" />}
					highlight
				>
					Issue Token
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
	highlight?: boolean
	children: React.ReactNode
}) {
	const { className, to, params, search, icon, badge, highlight, children } =
		props
	return (
		<Link
			to={to}
			{...(params ? { params } : {})}
			{...(search ? { search } : {})}
			preload="render"
			className={cx(
				'relative flex items-center gap-1.5 text-base-content-secondary hover:text-base-content border hover:border-accent focus-visible:border-accent py-1 rounded-full! press-down group-hover/pills:opacity-40 hover:opacity-100 bg-surface focus-visible:outline-none border-base-border transition-colors duration-300 ease-out focus-visible:duration-0',
				highlight && 'border-accent/50 hover:border-accent bg-accent/5',
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
