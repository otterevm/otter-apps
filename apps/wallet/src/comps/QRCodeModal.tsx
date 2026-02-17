import * as React from 'react'
import { toCanvas } from 'qrcode'
import { cx } from '#lib/css'
import X from '~icons/lucide/x'
import Download from '~icons/lucide/download'

interface QRCodeModalProps {
	address: string
	onClose: () => void
}

export function QRCodeModal({ address, onClose }: QRCodeModalProps): React.JSX.Element {
	const canvasRef = React.useRef<HTMLCanvasElement>(null)
	const [isGenerating, setIsGenerating] = React.useState(true)

	React.useEffect(() => {
		const generateQR = async () => {
			if (!canvasRef.current) return
			
			try {
				// Generate QR Code
				await toCanvas(canvasRef.current, address, {
					width: 280,
					margin: 2,
					color: {
						dark: '#0a0a0a',
						light: '#ffffff',
					},
				})

				// Add logo in center
				const canvas = canvasRef.current
				const ctx = canvas.getContext('2d')
				if (!ctx) return

				const logoSize = 50
				const centerX = (canvas.width - logoSize) / 2
				const centerY = (canvas.height - logoSize) / 2

				// Draw white background for logo
				ctx.fillStyle = '#ffffff'
				ctx.beginPath()
				ctx.roundRect(centerX - 4, centerY - 4, logoSize + 8, logoSize + 8, 8)
				ctx.fill()

				// Load and draw logo
				const logo = new Image()
				logo.crossOrigin = 'anonymous'
				logo.onload = () => {
					ctx.drawImage(logo, centerX, centerY, logoSize, logoSize)
					setIsGenerating(false)
				}
				logo.onerror = () => {
					// If logo fails to load, just show QR without logo
					setIsGenerating(false)
				}
				logo.src = '/logo.svg'
			} catch {
				setIsGenerating(false)
			}
		}

		generateQR()
	}, [address])

	const handleDownload = () => {
		if (!canvasRef.current) return
		
		const link = document.createElement('a')
		link.download = `otter-wallet-${address.slice(0, 8)}.png`
		link.href = canvasRef.current.toDataURL('image/png')
		link.click()
	}

	return (
		<div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
			<div className="bg-surface border border-card-border rounded-2xl p-6 w-full max-w-sm">
				<div className="flex items-center justify-between mb-6">
					<h2 className="text-lg font-medium text-primary">Receive</h2>
					<button
						onClick={onClose}
						className="p-1 text-secondary hover:text-primary transition-colors press-down cursor-pointer"
					>
						<X className="size-5" />
					</button>
				</div>

				<div className="flex flex-col items-center">
					<div className="bg-white p-4 rounded-xl mb-4">
						{isGenerating && (
							<div className="w-[280px] h-[280px] flex items-center justify-center">
								<div className="animate-spin rounded-full h-8 w-8 border-b-2 border-accent" />
							</div>
						)}
						<canvas
							ref={canvasRef}
							className={cx(isGenerating && 'hidden')}
						/>
					</div>

					<p className="text-sm text-tertiary mb-1">Wallet Address</p>
					<p className="text-primary font-mono text-sm break-all text-center mb-6">
						{address}
					</p>

					<button
						onClick={handleDownload}
						disabled={isGenerating}
						className={cx(
							'w-full flex items-center justify-center gap-2 px-6 py-3 rounded-xl',
							'bg-accent text-white font-medium',
							'hover:bg-accent-hover transition-colors',
							'press-down cursor-pointer',
							isGenerating && 'opacity-50 cursor-not-allowed',
						)}
					>
						<Download className="size-4" />
						<span>Save QR Code</span>
					</button>
				</div>
			</div>
		</div>
	)
}
