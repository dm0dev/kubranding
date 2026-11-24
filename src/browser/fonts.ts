import {
  DEFAULT_FONT_FAMILY,
  buildFontSpec,
  cssFontStackForFamily,
  pickNearestFontWeight,
  type LogoConfig,
} from '../core/index.ts'

const FONTSOURCE_API = 'https://api.fontsource.org/v1/fonts'

export interface FontsourceCatalogEntry {
  id: string
  family: string
  subsets: string[]
  weights: number[]
  styles: string[]
  defSubset: string
  variable: boolean
  category: string
}

export interface FontsourceFont {
  /** Fontsource font ID (e.g. `poppins`, `space-grotesk`). */
  id: string
  /** Font family name (e.g. `Poppins`, `Space Grotesk`). */
  family: string
  /** Value for `LogoConfig.fontFamily`. */
  cssFamily: string
  /** Display category (`sans-serif`, `serif`, `monospace`, …). */
  category: string
  /** Supported numeric font weights. */
  weights: number[]
  defSubset: string
  version: string
}

interface FontsourceFontDetails extends FontsourceCatalogEntry {
  npmVersion?: string
  version?: string
  unicodeRange?: Record<string, string>
  variants: Record<
    string,
    Record<
      string,
      Record<
        string,
        {
          url: {
            woff2?: string
            woff?: string
            ttf?: string
          }
        }
      >
    >
  >
}

const BUNDLED_PRESET_STACKS: Readonly<Record<string, string>> = {
  inter: DEFAULT_FONT_FAMILY,
  'jetbrains-mono': "'JetBrains Mono', ui-monospace, SFMono-Regular, monospace",
}

let catalogPromise: Promise<FontsourceCatalogEntry[]> | null = null
const loadedFonts = new Map<string, FontsourceFont>()

export function normalizeFontsourceId(input: string): string {
  return input
    .trim()
    .toLowerCase()
    .replace(/^@fontsource\//, '')
    .replace(/\s+/g, '-')
}

/** Fetches and caches the Fontsource font directory (`api.fontsource.org/v1/fonts`). */
export async function fetchFontsourceCatalog(): Promise<FontsourceCatalogEntry[]> {
  if (!catalogPromise) {
    catalogPromise = fetch(FONTSOURCE_API)
      .then(async (response) => {
        if (!response.ok) throw new Error(`Fontsource catalog request failed (${response.status})`)
        return (await response.json()) as FontsourceCatalogEntry[]
      })
      .catch((error) => {
        catalogPromise = null
        throw error
      })
  }
  return catalogPromise
}

/**
 * Loads a font from Fontsource by ID and registers its weights/subsets with the
 * browser's `FontFace` API so `<canvas>` measures and renders exact glyphs.
 */
export async function loadFontsourceFont(idOrQuery: string, preferredWeight = 700): Promise<FontsourceFont> {
  const id = normalizeFontsourceId(idOrQuery)
  if (!id) throw new Error('Enter a Fontsource font name or ID.')

  const cached = loadedFonts.get(id)
  if (cached) return cached

  const response = await fetch(`${FONTSOURCE_API}/${encodeURIComponent(id)}`)
  if (response.status === 404) throw new Error(`Font "${id}" was not found on Fontsource.`)
  if (!response.ok) throw new Error(`Failed to fetch font "${id}" from Fontsource (${response.status}).`)

  const details = (await response.json()) as FontsourceFontDetails
  const weights = [...new Set(details.weights)].sort((a, b) => a - b)
  const bundledStack = BUNDLED_PRESET_STACKS[details.id]
  const cssFamily = bundledStack ?? cssFontStackForFamily(details.family, details.category)

  if (!bundledStack) {
    const registeredFaces: FontFace[] = []

    for (const weight of weights) {
      const byStyle = details.variants[String(weight)]
      if (!byStyle) continue
      const bySubset = byStyle.normal ?? Object.values(byStyle)[0]
      if (!bySubset) continue

      for (const [subset, entry] of Object.entries(bySubset)) {
        const url = entry.url.woff2 ?? entry.url.woff ?? entry.url.ttf
        if (!url) continue
        const unicodeRange = details.unicodeRange?.[subset]
        const face = new FontFace(details.family, `url(${url})`, {
          weight: String(weight),
          style: 'normal',
          ...(unicodeRange ? { unicodeRange } : {}),
        })
        document.fonts.add(face)
        registeredFaces.push(face)
      }
    }

    if (registeredFaces.length === 0) {
      throw new Error(`No usable webfont files found for "${details.family}" on Fontsource.`)
    }
  }

  const activeWeight = pickNearestFontWeight(preferredWeight, weights)
  const loaded = await document.fonts.load(`${activeWeight} 32px ${cssFamily}`, 'AaBbCc123')
  if (loaded.length === 0 && !bundledStack) {
    throw new Error(`Could not load font "${details.family}" from Fontsource CDN.`)
  }

  const font: FontsourceFont = {
    id: details.id,
    family: details.family,
    cssFamily,
    category: details.category,
    weights,
    defSubset: details.defSubset,
    version: details.npmVersion ?? details.version ?? 'latest',
  }
  loadedFonts.set(details.id, font)
  return font
}

/**
 * Makes sure the font used by `config` is loaded before measuring — canvas text
 * silently falls back otherwise, which would produce wrong glyph metrics.
 */
export async function ensureFontLoaded(config: LogoConfig): Promise<void> {
  try {
    await document.fonts.load(buildFontSpec(config), config.text || ' ')
  } catch {
    // Unknown/system font stacks: nothing to load.
  }
}
