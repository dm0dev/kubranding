import type { LogoConfig } from './types.ts'

export const DEFAULT_FONT_FAMILY = "'Inter', system-ui, -apple-system, sans-serif"

export const DEFAULT_CONFIG: Readonly<LogoConfig> = Object.freeze({
  iconHeight: 84,
  text: 'Your Fancy\nKubernetes',
  fontFamily: DEFAULT_FONT_FAMILY,
  fontWeight: 700,
  fontSize: 32,
  lineSpacing: 6,
  textColor: '#FFFFFF',
  gap: 18,
  outerMargin: 4,
})

export interface NumericLimits {
  /** Hard limits (numeric input, CLI, config files). */
  min: number
  max: number
  /** Convenience range of the UI slider. */
  sliderMin: number
  sliderMax: number
}

export type NumericConfigKey = 'iconHeight' | 'fontSize' | 'lineSpacing' | 'gap' | 'outerMargin'

export const LIMITS: Readonly<Record<NumericConfigKey, NumericLimits>> = {
  iconHeight: { min: 16, max: 512, sliderMin: 16, sliderMax: 320 },
  fontSize: { min: 10, max: 240, sliderMin: 12, sliderMax: 140 },
  lineSpacing: { min: -20, max: 100, sliderMin: -10, sliderMax: 60 },
  gap: { min: 0, max: 200, sliderMin: 0, sliderMax: 120 },
  outerMargin: { min: 0, max: 100, sliderMin: 0, sliderMax: 64 },
}

export const FONT_WEIGHT_LABELS: Readonly<Record<number, string>> = {
  100: '100 — Thin',
  200: '200 — Extra-Light',
  300: '300 — Light',
  400: '400 — Regular',
  500: '500 — Medium',
  600: '600 — Semi-Bold',
  700: '700 — Bold',
  800: '800 — Extra-Bold',
  900: '900 — Black',
}

export const FONT_WEIGHTS: ReadonlyArray<{ value: number; label: string }> = [
  { value: 400, label: FONT_WEIGHT_LABELS[400] },
  { value: 500, label: FONT_WEIGHT_LABELS[500] },
  { value: 600, label: FONT_WEIGHT_LABELS[600] },
  { value: 700, label: FONT_WEIGHT_LABELS[700] },
  { value: 800, label: FONT_WEIGHT_LABELS[800] },
]

export function fontWeightOptions(weights?: readonly number[]): ReadonlyArray<{ value: number; label: string }> {
  if (!weights || weights.length === 0) return FONT_WEIGHTS
  const unique = [...new Set(weights)].sort((a, b) => a - b)
  return unique.map((value) => ({
    value,
    label: FONT_WEIGHT_LABELS[value] ?? String(value),
  }))
}

export function pickNearestFontWeight(target: number, available: readonly number[]): number {
  if (available.length === 0) return target
  if (available.includes(target)) return target
  return available.reduce((best, candidate) =>
    Math.abs(candidate - target) < Math.abs(best - target) ? candidate : best,
  )
}

export function cssFontStackForFamily(family: string, category?: string): string {
  const safe = family.replace(/['\\]/g, '\\$&')
  switch (category) {
    case 'monospace':
      return `'${safe}', ui-monospace, SFMono-Regular, monospace`
    case 'serif':
      return `'${safe}', Georgia, 'Times New Roman', serif`
    default:
      return `'${safe}', system-ui, -apple-system, sans-serif`
  }
}

export const FONT_PRESETS: ReadonlyArray<{ value: string; label: string }> = [
  { value: DEFAULT_FONT_FAMILY, label: 'Inter (Sans-Serif)' },
  {
    value: "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif",
    label: 'System UI Sans',
  },
  { value: "'Helvetica Neue', Helvetica, Arial, sans-serif", label: 'Helvetica / Arial' },
  { value: "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace", label: 'JetBrains Mono' },
  { value: "ui-monospace, 'Cascadia Code', 'Fira Code', monospace", label: 'System Monospace' },
  { value: "Georgia, 'Times New Roman', serif", label: 'Georgia Serif' },
]

export const COLOR_SWATCHES: ReadonlyArray<{ value: string; title: string }> = [
  { value: '#FFFFFF', title: 'Pure White (#FFFFFF)' },
  { value: '#151515', title: 'Obsidian Black (#151515)' },
  { value: '#EE0000', title: 'Brand Red (#EE0000)' },
  { value: '#EAB308', title: 'Amber Gold (#EAB308)' },
  { value: '#38BDF8', title: 'Sky Blue (#38BDF8)' },
]

export function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value))
}

/**
 * Parses `RGB`, `#RGB`, `RRGGBB` or `#RRGGBB` into upper-case `#RRGGBB`.
 * Returns `null` when the input is not a valid hex colour.
 */
export function parseHexColor(input: string): string | null {
  const raw = input.trim().replace(/^#/, '')
  if (/^[0-9a-f]{3}$/i.test(raw)) {
    return `#${raw
      .split('')
      .map((c) => c + c)
      .join('')
      .toUpperCase()}`
  }
  if (/^[0-9a-f]{6}$/i.test(raw)) return `#${raw.toUpperCase()}`
  return null
}

/** WCAG relative luminance in [0, 1] for a `#RRGGBB` hex colour. */
export function hexLuminance(hex: string): number {
  const parsed = parseHexColor(hex) ?? '#FFFFFF'
  const channels = [1, 3, 5].map((offset) => {
    const c = parseInt(parsed.slice(offset, offset + 2), 16) / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  })
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2]
}

/**
 * Derives readable light-theme and dark-theme text colours from the active
 * `textColor`: light neutrals pair with `#151515` on light UIs, dark neutrals
 * pair with `#FFFFFF` on dark UIs, and chromatic colours stay unchanged.
 */
export function resolveThemedTextColors(textColor: string): { light: string; dark: string } {
  const normalized = parseHexColor(textColor) ?? DEFAULT_CONFIG.textColor
  const luminance = hexLuminance(normalized)
  if (luminance > 0.6) return { light: '#151515', dark: normalized }
  if (luminance < 0.15) return { light: normalized, dark: '#FFFFFF' }
  return { light: normalized, dark: normalized }
}

function finiteOr(value: unknown, fallback: number): number {
  const n = typeof value === 'string' && value.trim() !== '' ? Number(value) : value
  return typeof n === 'number' && Number.isFinite(n) ? n : fallback
}

/**
 * Merges a partial config over the defaults and clamps/sanitises every field.
 * Use this for all untrusted input (CLI flags, JSON files, URL params).
 */
export function normalizeConfig(partial: Partial<LogoConfig> = {}): LogoConfig {
  const merged = { ...DEFAULT_CONFIG, ...partial }
  const num = (key: NumericConfigKey, round: boolean): number => {
    const { min, max } = LIMITS[key]
    const v = clamp(finiteOr(merged[key], DEFAULT_CONFIG[key]), min, max)
    return round ? Math.round(v) : v
  }
  return {
    iconHeight: num('iconHeight', true),
    text: typeof merged.text === 'string' ? merged.text : DEFAULT_CONFIG.text,
    fontFamily:
      typeof merged.fontFamily === 'string' && merged.fontFamily.trim()
        ? merged.fontFamily
        : DEFAULT_CONFIG.fontFamily,
    fontWeight: clamp(Math.round(finiteOr(merged.fontWeight, DEFAULT_CONFIG.fontWeight)), 100, 900),
    fontSize: num('fontSize', false),
    lineSpacing: num('lineSpacing', false),
    textColor: parseHexColor(String(merged.textColor)) ?? DEFAULT_CONFIG.textColor,
    gap: num('gap', true),
    outerMargin: num('outerMargin', true),
  }
}
