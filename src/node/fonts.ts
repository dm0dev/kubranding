import { existsSync } from 'node:fs'
import { basename, extname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { GlobalFonts } from '@napi-rs/canvas'
import { cssFontStackForFamily, pickNearestFontWeight } from '../core/index.ts'

const FONTSOURCE_API = 'https://api.fontsource.org/v1/fonts'

/** Bundled families (npm `@fontsource/*`), resolved relative to node_modules. */
const BUNDLED: ReadonlyArray<{ id: string; family: string; pkg: string; file: string; weights: number[] }> = [
  { id: 'inter', family: 'Inter', pkg: '@fontsource/inter', file: 'inter', weights: [400, 500, 600, 700, 800] },
  {
    id: 'jetbrains-mono',
    family: 'JetBrains Mono',
    pkg: '@fontsource/jetbrains-mono',
    file: 'jetbrains-mono',
    weights: [400, 500, 600, 700, 800],
  },
]

let bundledRegistered = false

/**
 * Registers the same fonts the web UI ships (Inter, JetBrains Mono) so that
 * Node renders identical glyphs. Idempotent.
 */
export function registerBundledFonts(): void {
  if (bundledRegistered) return
  bundledRegistered = true
  for (const { family, pkg, file, weights } of BUNDLED) {
    for (const weight of weights) {
      const url = import.meta.resolve(`${pkg}/files/${file}-latin-${weight}-normal.woff`)
      GlobalFonts.registerFromPath(fileURLToPath(url), family)
    }
  }
}

/**
 * Registers a custom font file (.ttf/.otf/.woff/.woff2).
 * @returns the family name to use in `LogoConfig.fontFamily`.
 */
export function registerFontFile(path: string, family?: string): string {
  if (!existsSync(path)) throw new Error(`Font file not found: ${path}`)
  const name = family ?? basename(path, extname(path)).replace(/[^a-zA-Z0-9 _-]/g, '')
  const key = GlobalFonts.registerFromPath(path, name)
  if (!key) throw new Error(`Could not parse font file: ${path}`)
  return name
}

interface FontsourceApiResponse {
  id: string
  family: string
  category?: string
  defSubset?: string
  weights: number[]
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

const registeredFontsourceWeights = new Set<string>()

/**
 * Downloads and registers a font from Fontsource (e.g. `poppins`, `space-grotesk`)
 * into `@napi-rs/canvas`'s `GlobalFonts`.
 */
export async function registerFontsourceFont(
  idOrQuery: string,
  options: { weight?: number; subset?: string } = {},
): Promise<{ id: string; family: string; cssFamily: string; weight: number }> {
  const id = idOrQuery.trim().toLowerCase().replace(/^@fontsource\//, '').replace(/\s+/g, '-')
  if (!id) throw new Error('Fontsource font ID cannot be empty')

  const bundled = BUNDLED.find((b) => b.id === id)
  if (bundled) {
    registerBundledFonts()
    const weight = pickNearestFontWeight(options.weight ?? 700, bundled.weights)
    return {
      id: bundled.id,
      family: bundled.family,
      cssFamily: cssFontStackForFamily(bundled.family, id === 'jetbrains-mono' ? 'monospace' : 'sans-serif'),
      weight,
    }
  }

  const metaRes = await fetch(`${FONTSOURCE_API}/${encodeURIComponent(id)}`)
  if (metaRes.status === 404) throw new Error(`Font "${id}" was not found on Fontsource`)
  if (!metaRes.ok) throw new Error(`Failed to fetch Fontsource metadata for "${id}" (${metaRes.status})`)

  const details = (await metaRes.json()) as FontsourceApiResponse
  const weight = pickNearestFontWeight(options.weight ?? 700, details.weights)
  const cacheKey = `${details.id}@${weight}:${options.subset ?? details.defSubset ?? 'latin'}`

  const byStyle = details.variants[String(weight)]
  const bySubset = byStyle?.normal ?? (byStyle ? Object.values(byStyle)[0] : undefined)
  if (!bySubset) throw new Error(`No normal weight ${weight} variant found for "${details.family}"`)

  const preferredSubset = options.subset ?? details.defSubset ?? 'latin'
  const entry = bySubset[preferredSubset] ?? bySubset.latin ?? Object.values(bySubset)[0]
  const fontUrl = entry?.url.woff2 ?? entry?.url.woff ?? entry?.url.ttf
  if (!fontUrl) throw new Error(`No downloadable font URL found for "${details.family}" (${weight})`)

  if (!registeredFontsourceWeights.has(cacheKey)) {
    const fontRes = await fetch(fontUrl)
    if (!fontRes.ok) throw new Error(`Failed to download Fontsource font file (${fontRes.status}): ${fontUrl}`)
    const buffer = Buffer.from(await fontRes.arrayBuffer())
    const key = GlobalFonts.register(buffer, details.family)
    if (!key) throw new Error(`Could not register Fontsource font "${details.family}"`)
    registeredFontsourceWeights.add(cacheKey)
  }

  return {
    id: details.id,
    family: details.family,
    cssFamily: cssFontStackForFamily(details.family, details.category),
    weight,
  }
}
