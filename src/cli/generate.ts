#!/usr/bin/env node
/**
 * Headless logo generator for CI/CD.
 *
 *   node src/cli/generate.ts --text "Acme\nCloud" --icon ./icon.svg --out dist/logo.png
 *
 * Requires Node >= 22.18 (native TypeScript type stripping).
 */
import { mkdir, readFile, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'
import { parseArgs } from 'node:util'
import type { LogoConfig } from '../core/index.ts'
import {
  generateLogo,
  registerBundledFonts,
  registerFontFile,
  registerFontsourceFont,
  type IconInput,
} from '../node/index.ts'

const HELP = `Usage: node src/cli/generate.ts [options]

Output
  -o, --out <file>          PNG output path ("-" writes raw PNG to stdout;
                            default: logo.png unless --stdout is set)
      --base64-out <file>   Also write the base64 string to a file
      --no-prefix           Omit "data:image/png;base64," in --base64-out / --stdout
      --stdout              Print the base64 string to stdout (skips writing logo.png unless --out is set)
      --json-layout <file>  Write the computed layout (geometry) as JSON

Input
  -c, --config <file>       JSON file with any LogoConfig fields (flags override it)
  -i, --icon <file>         PNG / SVG / JPEG / WebP icon (default: built-in sample)
      --no-icon             Text only

Logo settings (all optional)
  -t, --text <text>         Logo text, use \\n for line breaks
      --font-family <css>   CSS font-family list, e.g. "'Inter', sans-serif"
      --fontsource <id>     Download and use a font from Fontsource (e.g. poppins)
      --font-file <file>    Register a custom .ttf/.otf/.woff/.woff2 and use it
      --font-weight <n>     100-900
      --font-size <px>
      --line-spacing <px>
      --color <hex>         Text colour, e.g. EE0000
      --icon-height <px>
      --gap <px>
      --margin <px>

  -h, --help
`

const NUMERIC_FLAGS = {
  'font-weight': 'fontWeight',
  'font-size': 'fontSize',
  'line-spacing': 'lineSpacing',
  'icon-height': 'iconHeight',
  gap: 'gap',
  margin: 'outerMargin',
} as const satisfies Record<string, keyof LogoConfig>

async function main(): Promise<void> {
  const { values } = parseArgs({
    options: {
      out: { type: 'string', short: 'o' },
      'base64-out': { type: 'string' },
      'no-prefix': { type: 'boolean', default: false },
      stdout: { type: 'boolean', default: false },
      'json-layout': { type: 'string' },
      config: { type: 'string', short: 'c' },
      icon: { type: 'string', short: 'i' },
      'no-icon': { type: 'boolean', default: false },
      text: { type: 'string', short: 't' },
      'font-family': { type: 'string' },
      fontsource: { type: 'string' },
      'font-file': { type: 'string' },
      'font-weight': { type: 'string' },
      'font-size': { type: 'string' },
      'line-spacing': { type: 'string' },
      color: { type: 'string' },
      'icon-height': { type: 'string' },
      gap: { type: 'string' },
      margin: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
    strict: true,
  })

  if (values.help) {
    process.stdout.write(HELP)
    return
  }

  if (values.out === '-' && values.stdout) {
    throw new Error('Cannot combine --out - with --stdout (both write to stdout)')
  }

  // Config file first, flags override
  const config: Partial<LogoConfig> = values.config
    ? (JSON.parse(await readFile(values.config, 'utf8')) as Partial<LogoConfig>)
    : {}

  if (values.text !== undefined) config.text = values.text.replace(/\\n/g, '\n')
  if (values.color !== undefined) config.textColor = values.color
  if (values['font-family'] !== undefined) config.fontFamily = values['font-family']
  for (const [flag, key] of Object.entries(NUMERIC_FLAGS)) {
    const raw = values[flag as keyof typeof values]
    if (typeof raw !== 'string') continue
    const n = Number(raw)
    if (!Number.isFinite(n)) throw new Error(`--${flag} must be a number, got "${raw}"`)
    config[key] = n
  }

  registerBundledFonts()
  if (values.fontsource) {
    const font = await registerFontsourceFont(values.fontsource, { weight: config.fontWeight })
    config.fontWeight = font.weight
    if (values['font-family'] === undefined) config.fontFamily = font.cssFamily
  } else if (values['font-file']) {
    const family = registerFontFile(values['font-file'])
    if (values['font-family'] === undefined) config.fontFamily = `'${family}', sans-serif`
  }

  const icon: IconInput = values['no-icon']
    ? { kind: 'none' }
    : values.icon
      ? { kind: 'file', path: values.icon }
      : { kind: 'default' }

  const logo = await generateLogo({ config, icon })

  const out = values.out ?? (values.stdout ? undefined : 'logo.png')
  const writePngToStdout = out === '-'

  if (writePngToStdout) {
    process.stdout.write(logo.png)
  } else if (out) {
    await mkdir(dirname(out) || '.', { recursive: true })
    await writeFile(out, logo.png)
  }

  const base64Text = values['no-prefix'] ? logo.base64 : logo.dataUri
  if (values['base64-out']) {
    await mkdir(dirname(values['base64-out']) || '.', { recursive: true })
    await writeFile(values['base64-out'], base64Text)
  }
  if (values['json-layout']) {
    await mkdir(dirname(values['json-layout']) || '.', { recursive: true })
    await writeFile(values['json-layout'], JSON.stringify({ config: logo.config, layout: logo.layout }, null, 2))
  }

  if (values.stdout) {
    process.stdout.write(base64Text + '\n')
  } else if (out && !writePngToStdout) {
    const { canvasWidth, canvasHeight } = logo.layout
    console.log(`Wrote ${out} (${canvasWidth}×${canvasHeight}px, ${logo.byteLength} bytes)`)
  }
}

main().catch((error: unknown) => {
  console.error(`Error: ${error instanceof Error ? error.message : String(error)}`)
  process.exitCode = 1
})
