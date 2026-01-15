import * as React from 'react'
import { useTranslation } from 'react-i18next'
import { StretchingWordmark } from './StretchingWordmark'
import { useActivitySummary, type ActivityType } from '#lib/activity-context'
import GlobeIcon from '~icons/lucide/globe'
import BookOpenIcon from '~icons/lucide/book-open'

// Animation duration in ms
const WORDMARK_ANIMATION_DURATION = 4000

// Letter paths with their original x positions in the full wordmark
const TEMPO_LETTERS = {
	T: {
		path: 'M61.5297 181.489H12.6398L57.9524 43.1662H0L12.6398 2.62335H174.096L161.456 43.1662H106.604L61.5297 181.489Z',
		x: 0,
		width: 174.096,
	},
	E: {
		path: 'M115.905 181.489H0L58.191 2.62335H173.619L162.648 36.727H95.633L83.47 75.1235H148.339L137.369 108.75H72.262L60.099 147.385H126.637L115.905 181.489Z',
		x: 127.559,
		width: 173.619,
	},
	M: {
		path: 'M38.873 181.489H0L58.429 2.62335H123.298L121.152 99.2107L184.351 2.62335H255.42L197.229 181.489H148.578L187.212 61.2912H186.497L107.081 181.489H78.224L79.416 59.8603H78.939L38.873 181.489Z',
		x: 257.05,
		width: 255.42,
	},
	P: {
		path: 'M48.22 35.7731L29.38 93.487H34.627C46.551 93.487 56.488 90.7046 64.438 85.1399C72.387 79.4162 77.554 71.3077 79.939 60.8142C82.006 51.7517 80.893 45.3126 76.6 41.4968C72.308 37.681 65.153 35.7731 55.136 35.7731H48.22ZM0 181.489H-48.89L9.301 2.62335H68.684C82.358 2.62335 94.123 4.84923 103.98 9.30099C113.997 13.5938 121.31 19.7944 125.921 27.903C130.691 35.8526 132.281 45.1536 130.691 55.806C128.624 69.7973 123.218 82.1191 114.474 92.7715C105.729 103.424 94.361 111.692 80.37 117.574C66.538 123.298 51.036 126.16 33.865 126.16H17.886L0 181.489Z',
		x: 519.973,
		width: 179.581,
	},
	O: {
		path: 'M116.859 170.041C100.641 179.581 83.391 184.351 65.107 184.351H64.63C48.413 184.351 34.74 180.773 23.61 173.619C12.64 166.305 4.77 156.448 0 144.046C-4.611 131.645 -5.724 118.051 -3.339 103.265C-0.318 84.6629 6.598 67.4919 17.409 51.7517C28.221 36.0116 41.735 23.4512 57.952 14.0707C74.169 4.69025 91.5 0 109.943 0H110.419C127.273 0 141.184 3.57731 152.155 10.7319C163.284 17.8865 170.995 27.6645 175.288 40.0658C179.74 52.3082 180.694 66.061 178.15 81.3241C175.129 99.2902 168.213 116.223 157.401 132.122C146.59 147.862 133.076 160.502 116.859 170.041ZM49.367 139.277C53.659 147.385 61.132 151.439 71.785 151.439H72.261C81.006 151.439 89.115 148.18 96.587 141.661C104.219 134.984 110.658 126.08 115.905 114.951C121.31 103.821 125.285 91.4201 127.829 77.7468C130.214 64.3915 129.26 53.6596 124.967 45.551C120.674 37.2835 113.281 33.1497 102.788 33.1497H102.311C94.202 33.1497 86.332 36.4885 78.701 43.1662C71.228 49.8438 64.709 58.8268 59.145 70.1152C53.58 81.4036 49.526 93.646 46.982 106.842C44.438 120.198 45.233 131.009 49.367 139.277Z',
		x: 650.336,
		width: 180.358,
	},
}

// Full wordmark width
const FULL_WIDTH = 830
// Collapsed width (just the T)
const COLLAPSED_WIDTH = 174.096

function TempoWordmark() {
	const [progress, setProgress] = React.useState(0)

	React.useEffect(() => {
		let animationId: number
		let startTime: number | null = null

		const animate = (timestamp: number) => {
			if (!startTime) startTime = timestamp
			const elapsed = timestamp - startTime
			const rawProgress = (elapsed % WORDMARK_ANIMATION_DURATION) / WORDMARK_ANIMATION_DURATION
			// Ping-pong: 0->1->0
			const pingPong = rawProgress < 0.5 ? rawProgress * 2 : 2 - rawProgress * 2
			// Ease in-out cubic
			const eased = pingPong < 0.5
				? 4 * pingPong * pingPong * pingPong
				: 1 - (-2 * pingPong + 2) ** 3 / 2
			setProgress(eased)
			animationId = requestAnimationFrame(animate)
		}

		animationId = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(animationId)
	}, [])

	// Calculate dynamic viewBox width based on progress
	const currentWidth = FULL_WIDTH - (FULL_WIDTH - COLLAPSED_WIDTH) * progress

	// Letter opacity - E, M, P, O fade out as they collapse
	const letterOpacity = Math.max(0, 1 - progress * 1.8)

	// Calculate letter positions - they slide toward the T
	const getLetterTransform = (letter: keyof typeof TEMPO_LETTERS) => {
		if (letter === 'T') {
			// T stays in place but its left bar retracts (simulated by scaling from right)
			const scaleX = 1 - progress * 0.3
			return `translate(${TEMPO_LETTERS.T.x}, 0) scale(${scaleX}, 1)`
		}
		// Other letters slide left toward the T
		const originalX = TEMPO_LETTERS[letter].x
		const targetX = TEMPO_LETTERS.T.width - 20 // Slide to just past the T
		const currentX = originalX - (originalX - targetX) * progress
		return `translate(${currentX}, 0)`
	}

	return (
		<svg
			aria-label="Tempo"
			viewBox={`0 0 ${currentWidth} 185`}
			className="h-4 sm:h-5 w-auto"
			role="img"
			style={{ overflow: 'visible' }}
		>
			{/* T - always visible */}
			<g transform={getLetterTransform('T')} style={{ transformOrigin: 'right center' }}>
				<path d={TEMPO_LETTERS.T.path} fill="currentColor" />
			</g>

			{/* E, M, P, O - fade out as they collapse */}
			{letterOpacity > 0.01 && (
				<>
					<g transform={getLetterTransform('E')} opacity={letterOpacity}>
						<path d={TEMPO_LETTERS.E.path} fill="currentColor" />
					</g>
					<g transform={getLetterTransform('M')} opacity={letterOpacity}>
						<path d={TEMPO_LETTERS.M.path} fill="currentColor" />
					</g>
					<g transform={getLetterTransform('P')} opacity={letterOpacity}>
						<path d={TEMPO_LETTERS.P.path} fill="currentColor" />
					</g>
					<g transform={getLetterTransform('O')} opacity={letterOpacity}>
						<path d={TEMPO_LETTERS.O.path} fill="currentColor" />
					</g>
				</>
			)}
		</svg>
	)
}

const activityColors: Record<ActivityType, string> = {
	send: '#3b82f6', // blue
	received: '#22c55e', // green
	swap: '#8b5cf6', // purple
	mint: '#f97316', // orange
	burn: '#ef4444', // red
	approve: '#06b6d4', // cyan
	unknown: '#6b7280', // gray
}

function AmbientGradient() {
	const { summary } = useActivitySummary()
	const [time, setTime] = React.useState(0)

	const hasActivity = summary && summary.types.length > 0

	const colors = React.useMemo(() => {
		if (!hasActivity || !summary.typeCounts) return []
		// Build colors array proportional to type counts
		const totalCount = Object.values(summary.typeCounts).reduce(
			(a, b) => a + b,
			0,
		)
		if (totalCount === 0) return []

		const proportionalColors: string[] = []
		for (const type of summary.types) {
			const count = summary.typeCounts[type] ?? 0
			const proportion = count / totalCount
			// Add color multiple times based on proportion (min 1, max 5)
			const repetitions = Math.max(1, Math.round(proportion * 5))
			for (let i = 0; i < repetitions; i++) {
				proportionalColors.push(activityColors[type])
			}
		}

		if (proportionalColors.length === 1) {
			return [
				proportionalColors[0],
				proportionalColors[0],
				proportionalColors[0],
			]
		}
		return proportionalColors
	}, [hasActivity, summary?.types, summary?.typeCounts])

	const intensity = React.useMemo(() => {
		if (!summary) return 0
		const count = summary.count
		if (count >= 10) return 1
		if (count >= 5) return 0.7
		if (count >= 2) return 0.5
		return 0.3
	}, [summary])

	React.useEffect(() => {
		if (!hasActivity) return
		let frame: number
		const animate = () => {
			setTime((t) => t + 1)
			frame = requestAnimationFrame(animate)
		}
		frame = requestAnimationFrame(animate)
		return () => cancelAnimationFrame(frame)
	}, [hasActivity])

	const gradientStops = React.useMemo(() => {
		if (colors.length === 0) return ''
		const step = 360 / colors.length
		return colors.map((color, i) => `${color} ${i * step}deg`).join(', ')
	}, [colors])

	if (!hasActivity) return null

	const rotation = (time * 0.3 * (0.5 + intensity * 0.5)) % 360
	const posX = 30 + Math.sin(time * 0.008) * 20 * intensity
	const posY = 70 + Math.cos(time * 0.006) * 15 * intensity
	const pulse = 0.12 + Math.sin(time * 0.02) * 0.08 * intensity
	const scale = 1 + Math.sin(time * 0.01) * 0.15 * intensity

	return (
		<div
			className="absolute inset-6 pointer-events-none transition-opacity duration-700 rounded-2xl"
			style={{
				opacity: pulse + intensity * 0.1,
				background: `conic-gradient(from ${rotation}deg at ${posX}% ${posY}%, ${gradientStops}, ${colors[0]} 360deg)`,
				filter: 'blur(80px)',
				transform: `scale(${scale})`,
			}}
		/>
	)
}

export function Intro() {
	const { t } = useTranslation()

	return (
		<div className="relative flex min-h-full flex-col items-start justify-end rounded-[20px] liquid-glass-premium px-5 sm:px-6 py-5 overflow-hidden max-md:min-h-[120px] max-md:rounded-none max-md:py-3">
			<AmbientGradient />
			<StretchingWordmark className="absolute inset-0 max-md:hidden" />
			<div className="relative flex flex-col items-start gap-y-2 z-10 max-md:gap-y-1.5">
				<TempoWordmark />
				<p className="text-[15px] sm:text-[17px] leading-[22px] sm:leading-[24px] text-secondary max-md:text-[13px] max-md:leading-[18px]">
					{t('intro.tagline')}
				</p>
				<div className="flex gap-1.5 flex-wrap isolate">
					<a
						className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium text-white/90 bg-white/10 border border-white/15 rounded-full hover:text-white hover:border-white/30 hover:bg-white/15 transition-all"
						href="https://tempo.xyz"
						rel="noreferrer"
						target="_blank"
					>
						<GlobeIcon className="size-[12px]" />
						{t('intro.website')}
					</a>
					<a
						className="flex items-center gap-1 px-2 py-0.5 text-[12px] font-medium text-white/90 bg-white/10 border border-white/15 rounded-full hover:text-white hover:border-white/30 hover:bg-white/15 transition-all"
						href="https://docs.tempo.xyz"
						rel="noreferrer"
						target="_blank"
					>
						<BookOpenIcon className="size-[12px]" />
						{t('intro.docs')}
					</a>
				</div>
			</div>
		</div>
	)
}
