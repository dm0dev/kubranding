import type { LogoConfig, LogoLayout, TextLineLayout, TextMetricsLike } from './types.ts'

export interface IconSize {
  width: number
  height: number
}

export function buildFontSpec(config: Pick<LogoConfig, 'fontWeight' | 'fontSize' | 'fontFamily'>): string {
  return `${config.fontWeight} ${config.fontSize}px ${config.fontFamily}`
}

/**
 * Pure layout computation: turns a config, an (optional) icon size and a text
 * measuring function into exact pixel geometry. No canvas needed, so it can be
 * unit-tested with a fake `measure` function.
 *
 * Text is measured by exact glyph ink bounds (`actualBoundingBox*`) so that the
 * multi-line block and the icon are centred pixel-accurately with no clipping.
 *
 * @param measure measures a single line using `config`'s font.
 */
export function computeLayout(
  config: LogoConfig,
  iconSize: IconSize | null,
  measure: (line: string) => TextMetricsLike,
): LogoLayout {
  // 1. Scaled icon dimensions
  let iconW = 0
  let iconH = 0
  if (iconSize) {
    const natW = iconSize.width || 140
    const natH = iconSize.height || 160
    iconH = Math.max(1, Math.round(config.iconHeight))
    iconW = Math.max(1, Math.round(iconH * (natW / natH)))
  }

  // 2. Measure every text line
  const rawLines = config.text.split(/\r?\n/)
  const hasText = rawLines.some((line) => line.length > 0)

  const lines: TextLineLayout[] = []
  let maxTextWidth = 0
  let totalTextHeight = 0

  if (hasText) {
    rawLines.forEach((line, idx) => {
      const isEmpty = line.length === 0
      // Blank lines still advance vertically: measure a space
      const m = measure(isEmpty ? ' ' : line)

      const leftInset = isEmpty ? 0 : (m.actualBoundingBoxLeft ?? 0)
      const rightExtent = isEmpty ? 0 : (m.actualBoundingBoxRight ?? m.width)
      const width = isEmpty ? 0 : leftInset + rightExtent

      const ascent = m.actualBoundingBoxAscent ?? config.fontSize * 0.78
      const descent = m.actualBoundingBoxDescent ?? config.fontSize * 0.22
      const height = Math.max(1, ascent + descent)

      lines.push({ text: line, leftInset, rightExtent, width, ascent, descent, height, top: totalTextHeight })

      maxTextWidth = Math.max(maxTextWidth, width)
      totalTextHeight += height
      if (idx < rawLines.length - 1) totalTextHeight += config.lineSpacing
    })
  }

  // Negative line spacing must never produce a negative block height
  totalTextHeight = Math.ceil(Math.max(0, totalTextHeight))
  maxTextWidth = Math.ceil(maxTextWidth)

  // 3. Canvas dimensions
  const hasVisibleText = hasText && maxTextWidth > 0
  const gap = iconW > 0 && hasVisibleText ? config.gap : 0
  const contentWidth = iconW + gap + maxTextWidth
  const contentHeight = Math.max(iconH, totalTextHeight)
  const margin = Math.max(0, Math.round(config.outerMargin))

  const canvasWidth = Math.max(1, Math.ceil(contentWidth + margin * 2))
  const canvasHeight = Math.max(1, Math.ceil(contentHeight + margin * 2))

  // 4. Placement (icon + text block vertically centred)
  const icon =
    iconW > 0 && iconH > 0
      ? {
          x: margin,
          y: margin + Math.round((contentHeight - iconH) / 2),
          width: iconW,
          height: iconH,
        }
      : null

  const text = hasVisibleText
    ? {
        x: margin + iconW + gap,
        y: margin + Math.round((contentHeight - totalTextHeight) / 2),
        width: maxTextWidth,
        height: totalTextHeight,
        lines,
      }
    : null

  return {
    canvasWidth,
    canvasHeight,
    margin,
    contentWidth,
    contentHeight,
    icon,
    text,
    gap,
    fontSpec: buildFontSpec(config),
  }
}
