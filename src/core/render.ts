import { buildFontSpec, computeLayout } from './layout.ts'
import type { CanvasLike, DrawContext, IconAsset, LogoConfig, LogoLayout } from './types.ts'

function getContext(canvas: CanvasLike): DrawContext {
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('2D canvas context is not available')
  return ctx
}

/** Draws an already computed layout onto a correctly sized canvas context. */
export function drawLogo(
  ctx: DrawContext,
  layout: LogoLayout,
  icon: IconAsset | null,
  config: LogoConfig,
): void {
  // True alpha transparency
  ctx.clearRect(0, 0, layout.canvasWidth, layout.canvasHeight)
  ctx.imageSmoothingEnabled = true
  ctx.imageSmoothingQuality = 'high'

  if (icon && layout.icon) {
    const { x, y, width, height } = layout.icon
    ctx.drawImage(icon.source, x, y, width, height)
  }

  if (layout.text) {
    ctx.font = layout.fontSpec
    ctx.fillStyle = config.textColor
    ctx.textBaseline = 'alphabetic'
    ctx.textAlign = 'left'

    for (const line of layout.text.lines) {
      if (line.text.length === 0) continue
      // Compensate for actualBoundingBoxLeft/Ascent so ink starts flush at the box edge
      ctx.fillText(line.text, layout.text.x + line.leftInset, layout.text.y + line.top + line.ascent)
    }
  }
}

/**
 * Renders a logo onto `canvas`: measures, resizes the canvas to fit exactly,
 * then draws. Returns the layout (also useful for guides and metadata).
 *
 * The canvas is resized to the logo dimensions. The caller owns encoding
 * (`toDataURL`, `toBuffer`, …).
 */
export function renderLogo(
  canvas: CanvasLike,
  icon: IconAsset | null,
  config: LogoConfig,
): LogoLayout {
  const measureCtx = getContext(canvas)
  measureCtx.font = buildFontSpec(config)
  measureCtx.textBaseline = 'alphabetic'
  measureCtx.textAlign = 'left'

  const layout = computeLayout(config, icon, (line) => measureCtx.measureText(line))

  // Resizing resets context state, so fetch + draw afterwards
  canvas.width = layout.canvasWidth
  canvas.height = layout.canvasHeight
  drawLogo(getContext(canvas), layout, icon, config)

  return layout
}

/** Draws non-destructive alignment guides (never part of the export). */
export function drawGuides(canvas: CanvasLike, layout: LogoLayout): void {
  const { canvasWidth: width, canvasHeight: height } = layout
  canvas.width = width
  canvas.height = height
  const ctx = getContext(canvas)
  ctx.clearRect(0, 0, width, height)
  ctx.lineWidth = 1
  ctx.setLineDash([3, 3])

  // Outer canvas border
  ctx.strokeStyle = 'rgba(239, 68, 68, 0.65)'
  ctx.strokeRect(0.5, 0.5, width - 1, height - 1)

  // Horizontal centre axis
  ctx.strokeStyle = 'rgba(56, 189, 248, 0.55)'
  ctx.beginPath()
  ctx.moveTo(0, Math.floor(height / 2) + 0.5)
  ctx.lineTo(width, Math.floor(height / 2) + 0.5)
  ctx.stroke()

  if (layout.icon) {
    ctx.strokeStyle = 'rgba(250, 204, 21, 0.75)'
    ctx.strokeRect(layout.icon.x + 0.5, layout.icon.y + 0.5, layout.icon.width - 1, layout.icon.height - 1)
  }

  if (layout.text && layout.text.height > 0) {
    ctx.strokeStyle = 'rgba(52, 211, 153, 0.75)'
    ctx.strokeRect(layout.text.x + 0.5, layout.text.y + 0.5, layout.text.width - 1, layout.text.height - 1)
  }
}
