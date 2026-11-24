import { readFile } from 'node:fs/promises'
import { basename } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createCanvas, loadImage } from '@napi-rs/canvas'
import {
  DEFAULT_ICON_FILE,
  base64ByteLength,
  normalizeConfig,
  pngBase64ToDataUri,
  renderLogo,
  type CanvasLike,
  type IconAsset,
  type LogoConfig,
  type LogoLayout,
} from '../core/index.ts'
import { registerBundledFonts } from './fonts.ts'

/** `public/preset_logo.svg` – shared with the web app. */
const DEFAULT_ICON_PATH = fileURLToPath(new URL(`../../public/${DEFAULT_ICON_FILE}`, import.meta.url))

export type IconInput =
  /** Built-in sample cube. */
  | { kind: 'default' }
  /** PNG / SVG / JPEG / WebP file on disk. */
  | { kind: 'file'; path: string }
  /** Raw encoded image bytes. */
  | { kind: 'buffer'; data: Uint8Array }
  /** No icon, text only. */
  | { kind: 'none' }

export interface GenerateLogoOptions {
  /** Partial config; missing/invalid fields fall back to the defaults. */
  config?: Partial<LogoConfig>
  /** Defaults to the built-in sample icon. */
  icon?: IconInput
}

export interface GeneratedLogo {
  png: Uint8Array
  /** Raw base64 (no `data:` prefix). */
  base64: string
  /** `data:image/png;base64,…` */
  dataUri: string
  /** Encoded PNG size in bytes. */
  byteLength: number
  layout: LogoLayout
  config: LogoConfig
}

export async function loadIcon(input: IconInput): Promise<IconAsset | null> {
  let data: Uint8Array
  switch (input.kind) {
    case 'none':
      return null
    case 'default':
      data = await readFile(DEFAULT_ICON_PATH)
      break
    case 'file':
      data = await readFile(input.path)
      break
    case 'buffer':
      data = input.data
      break
  }
  try {
    const image = await loadImage(Buffer.from(data))
    return { source: image, width: image.width, height: image.height }
  } catch (error) {
    const label = input.kind === 'file' ? basename(input.path) : input.kind
    throw new Error(`Failed to decode icon (${label}): ${(error as Error).message}`)
  }
}

/**
 * Headless equivalent of the in-browser studio: same core renderer, rendered
 * with @napi-rs/canvas. Works in a plain Node container (no browser, no system
 * libraries).
 */
export async function generateLogo(options: GenerateLogoOptions = {}): Promise<GeneratedLogo> {
  registerBundledFonts()

  const config = normalizeConfig(options.config)
  const icon = await loadIcon(options.icon ?? { kind: 'default' })

  const canvas = createCanvas(1, 1)
  const layout = renderLogo(canvas as unknown as CanvasLike, icon, config)

  const png = canvas.toBuffer('image/png')
  const base64 = png.toString('base64')
  return {
    png,
    base64,
    dataUri: pngBase64ToDataUri(base64),
    byteLength: base64ByteLength(base64),
    layout,
    config,
  }
}
