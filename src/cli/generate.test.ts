import assert from 'node:assert/strict'
import { execFile as execFileCb } from 'node:child_process'
import { existsSync } from 'node:fs'
import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { after, before, describe, it } from 'node:test'
import { fileURLToPath } from 'node:url'
import { promisify } from 'node:util'
import type { LogoConfig, LogoLayout } from '../core/index.ts'

const execFile = promisify(execFileCb)
const CLI_PATH = fileURLToPath(new URL('./generate.ts', import.meta.url))
const PNG_SIGNATURE = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])

interface CliResult {
  exitCode: number
  stdout: string
  stderr: string
}

interface JsonLayoutOutput {
  config: LogoConfig
  layout: LogoLayout
}

async function runCli(args: string[], cwd: string): Promise<CliResult> {
  try {
    const { stdout, stderr } = await execFile(process.execPath, [CLI_PATH, ...args], {
      cwd,
      encoding: 'utf8',
    })
    return { exitCode: 0, stdout, stderr }
  } catch (error) {
    const err = error as NodeJS.ErrnoException & { code?: number | string; stdout?: string; stderr?: string }
    return {
      exitCode: typeof err.code === 'number' ? err.code : 1,
      stdout: err.stdout ?? '',
      stderr: err.stderr ?? '',
    }
  }
}

function readPngDimensions(png: Buffer): { width: number; height: number } {
  assert.ok(png.length >= 24, `PNG buffer too short (${png.length} bytes)`)
  assert.deepEqual(png.subarray(0, 8), PNG_SIGNATURE, 'Output does not start with PNG signature')
  assert.equal(png.subarray(12, 16).toString('ascii'), 'IHDR', 'Missing IHDR chunk')
  return {
    width: png.readUInt32BE(16),
    height: png.readUInt32BE(20),
  }
}

describe('CLI (src/cli/generate.ts)', { concurrency: true }, () => {
  let rootDir = ''

  before(async () => {
    rootDir = await mkdtemp(join(tmpdir(), 'kubranding-cli-test-'))
  })

  after(async () => {
    if (rootDir) await rm(rootDir, { recursive: true, force: true })
  })

  async function makeCaseDir(name: string): Promise<string> {
    const dir = join(rootDir, name)
    await mkdir(dir, { recursive: true })
    return dir
  }

  it('prints usage text and exits 0 on --help and -h', async () => {
    const dir = await makeCaseDir('help')
    for (const flag of ['--help', '-h']) {
      const res = await runCli([flag], dir)
      assert.equal(res.exitCode, 0, res.stderr)
      assert.match(res.stdout, /^Usage: node src\/cli\/generate\.ts \[options\]/)
      assert.match(res.stdout, /--out <file>/)
      assert.match(res.stdout, /--config <file>/)
      assert.equal(res.stderr, '')
    }
  })

  it('writes default logo.png when called with no arguments', async () => {
    const dir = await makeCaseDir('default-out')
    const res = await runCli([], dir)
    assert.equal(res.exitCode, 0, res.stderr)

    const png = await readFile(join(dir, 'logo.png'))
    const { width, height } = readPngDimensions(png)
    assert.ok(width > 0 && height > 0)
    assert.match(res.stdout, new RegExp(`Wrote logo\\.png \\(${width}×${height}px, ${png.length} bytes\\)`))
  })

  it('applies typography, colour, spacing, nested output dirs, and --json-layout', async () => {
    const dir = await makeCaseDir('flags-and-layout')
    const outPath = join(dir, 'nested', 'dir', 'brand.png')
    const layoutPath = join(dir, 'nested', 'meta', 'layout.json')

    const res = await runCli(
      [
        '--text',
        'Acme\\nCloud',
        '--color',
        'ee0000',
        '--font-family',
        "'Inter', sans-serif",
        '--font-weight',
        '600',
        '--font-size',
        '32',
        '--line-spacing',
        '6',
        '--icon-height',
        '48',
        '--gap',
        '20',
        '--margin',
        '12',
        '--out',
        outPath,
        '--json-layout',
        layoutPath,
      ],
      dir,
    )
    assert.equal(res.exitCode, 0, res.stderr)

    const png = await readFile(outPath)
    const { width, height } = readPngDimensions(png)
    const meta = JSON.parse(await readFile(layoutPath, 'utf8')) as JsonLayoutOutput

    assert.equal(meta.config.text, 'Acme\nCloud')
    assert.equal(meta.config.textColor, '#EE0000')
    assert.equal(meta.config.fontWeight, 600)
    assert.equal(meta.config.fontSize, 32)
    assert.equal(meta.config.lineSpacing, 6)
    assert.equal(meta.config.iconHeight, 48)
    assert.equal(meta.config.gap, 20)
    assert.equal(meta.config.outerMargin, 12)
    assert.equal(meta.layout.text?.lines.length, 2)
    assert.equal(meta.layout.icon?.height, 48)
    assert.equal(meta.layout.canvasWidth, width)
    assert.equal(meta.layout.canvasHeight, height)
  })

  it('loads --config JSON and allows CLI flags to override it', async () => {
    const dir = await makeCaseDir('config-override')
    const configPath = join(dir, 'logo.json')
    const outPath = join(dir, 'logo.png')
    const layoutPath = join(dir, 'layout.json')

    await writeFile(
      configPath,
      JSON.stringify({
        text: 'From Config',
        textColor: '#123456',
        fontSize: 40,
        gap: 24,
        outerMargin: 16,
      }),
    )

    const res = await runCli(
      [
        '-c',
        configPath,
        '-t',
        'Overridden',
        '--gap',
        '8',
        '-o',
        outPath,
        '--json-layout',
        layoutPath,
      ],
      dir,
    )
    assert.equal(res.exitCode, 0, res.stderr)

    const meta = JSON.parse(await readFile(layoutPath, 'utf8')) as JsonLayoutOutput
    assert.equal(meta.config.text, 'Overridden')
    assert.equal(meta.config.gap, 8)
    // Unoverridden values from logo.json are preserved
    assert.equal(meta.config.textColor, '#123456')
    assert.equal(meta.config.fontSize, 40)
    assert.equal(meta.config.outerMargin, 16)
  })

  it('supports --no-icon and custom --icon SVG files', async () => {
    const dir = await makeCaseDir('icons')

    // Text-only (--no-icon)
    const noIconLayoutPath = join(dir, 'no-icon.json')
    const noIconRes = await runCli(
      ['--text', 'Text Only', '--no-icon', '--out', join(dir, 'no-icon.png'), '--json-layout', noIconLayoutPath],
      dir,
    )
    assert.equal(noIconRes.exitCode, 0, noIconRes.stderr)
    const noIconMeta = JSON.parse(await readFile(noIconLayoutPath, 'utf8')) as JsonLayoutOutput
    assert.equal(noIconMeta.layout.icon, null)
    assert.equal(noIconMeta.layout.gap, 0)

    // Custom 100x50 SVG icon scaled to height 40 -> width 80
    const svgPath = join(dir, 'custom.svg')
    await writeFile(
      svgPath,
      '<svg xmlns="http://www.w3.org/2000/svg" width="100" height="50" viewBox="0 0 100 50"><rect width="100" height="50" fill="#EE0000"/></svg>',
    )
    const customLayoutPath = join(dir, 'custom.json')
    const customOutPath = join(dir, 'custom.png')
    const customRes = await runCli(
      [
        '--icon',
        svgPath,
        '--icon-height',
        '40',
        '--text',
        'Custom',
        '--out',
        customOutPath,
        '--json-layout',
        customLayoutPath,
      ],
      dir,
    )
    assert.equal(customRes.exitCode, 0, customRes.stderr)
    const customMeta = JSON.parse(await readFile(customLayoutPath, 'utf8')) as JsonLayoutOutput
    assert.equal(customMeta.layout.icon?.width, 80)
    assert.equal(customMeta.layout.icon?.height, 40)
    const { width, height } = readPngDimensions(await readFile(customOutPath))
    assert.equal(width, customMeta.layout.canvasWidth)
    assert.equal(height, customMeta.layout.canvasHeight)
  })

  it('supports --base64-out, --stdout, and --no-prefix', async () => {
    const dir = await makeCaseDir('base64')
    const prefixedPng = join(dir, 'prefixed.png')
    const prefixedB64 = join(dir, 'prefixed.b64')

    const resPrefixed = await runCli(
      ['--text', 'Base64', '--out', prefixedPng, '--base64-out', prefixedB64, '--stdout'],
      dir,
    )
    assert.equal(resPrefixed.exitCode, 0, resPrefixed.stderr)
    const pngBytes = await readFile(prefixedPng)
    const fileContent = await readFile(prefixedB64, 'utf8')
    const stdoutContent = resPrefixed.stdout.trim()

    assert.equal(stdoutContent, fileContent)
    assert.ok(fileContent.startsWith('data:image/png;base64,'))
    const decodedPrefixed = Buffer.from(fileContent.slice('data:image/png;base64,'.length), 'base64')
    assert.deepEqual(decodedPrefixed, pngBytes)

    // Without data URI prefix (--no-prefix)
    const rawPng = join(dir, 'raw.png')
    const rawB64 = join(dir, 'raw.b64')
    const resRaw = await runCli(
      ['--text', 'Base64', '--out', rawPng, '--base64-out', rawB64, '--no-prefix', '--stdout'],
      dir,
    )
    assert.equal(resRaw.exitCode, 0, resRaw.stderr)
    const rawPngBytes = await readFile(rawPng)
    const rawFileContent = await readFile(rawB64, 'utf8')
    assert.equal(resRaw.stdout.trim(), rawFileContent)
    assert.ok(!rawFileContent.startsWith('data:'))
    assert.deepEqual(Buffer.from(rawFileContent, 'base64'), rawPngBytes)

    // --stdout without --out skips writing default logo.png
    const stdoutOnlyDir = await makeCaseDir('stdout-only')
    const resStdoutOnly = await runCli(['--text', 'Stdout Only', '--stdout'], stdoutOnlyDir)
    assert.equal(resStdoutOnly.exitCode, 0, resStdoutOnly.stderr)
    assert.ok(resStdoutOnly.stdout.trim().startsWith('data:image/png;base64,'))
    assert.equal(existsSync(join(stdoutOnlyDir, 'logo.png')), false)
  })

  it('writes raw PNG bytes to stdout when --out - is passed', async () => {
    const dir = await makeCaseDir('png-stdout')
    const { stdout, stderr } = await execFile(process.execPath, [CLI_PATH, '--text', 'Pipe', '--out', '-'], {
      cwd: dir,
      encoding: 'buffer',
    })
    assert.equal(stderr.length, 0)
    const { width, height } = readPngDimensions(stdout)
    assert.ok(width > 0 && height > 0)
    assert.equal(existsSync(join(dir, 'logo.png')), false)

    // Combining --out - with --stdout is rejected
    const conflict = await runCli(['--text', 'Conflict', '--out', '-', '--stdout'], dir)
    assert.equal(conflict.exitCode, 1)
    assert.match(conflict.stderr, /Cannot combine --out - with --stdout/)
  })

  it('supports bundled --fontsource and local --font-file without network access', async () => {
    const dir = await makeCaseDir('fonts')

    // Bundled Fontsource family (resolved locally from @fontsource/jetbrains-mono)
    const fsLayoutPath = join(dir, 'fontsource.json')
    const fsRes = await runCli(
      [
        '--text',
        'Mono',
        '--fontsource',
        'jetbrains-mono',
        '--font-weight',
        '450',
        '--out',
        join(dir, 'fontsource.png'),
        '--json-layout',
        fsLayoutPath,
      ],
      dir,
    )
    assert.equal(fsRes.exitCode, 0, fsRes.stderr)
    const fsMeta = JSON.parse(await readFile(fsLayoutPath, 'utf8')) as JsonLayoutOutput
    assert.match(fsMeta.config.fontFamily, /^'JetBrains Mono'/)
    assert.equal(fsMeta.config.fontWeight, 400)

    // Local font file via --font-file
    const woffPath = fileURLToPath(import.meta.resolve('@fontsource/inter/files/inter-latin-400-normal.woff'))
    const ffLayoutPath = join(dir, 'fontfile.json')
    const ffRes = await runCli(
      [
        '--text',
        'CustomFont',
        '--font-file',
        woffPath,
        '--out',
        join(dir, 'fontfile.png'),
        '--json-layout',
        ffLayoutPath,
      ],
      dir,
    )
    assert.equal(ffRes.exitCode, 0, ffRes.stderr)
    const ffMeta = JSON.parse(await readFile(ffLayoutPath, 'utf8')) as JsonLayoutOutput
    assert.match(ffMeta.config.fontFamily, /^'inter-latin-400-normal'/)
  })

  it('fails with non-zero exit code on invalid flags, bad numbers, and missing/invalid files', async () => {
    const dir = await makeCaseDir('errors')

    const unknownFlag = await runCli(['--does-not-exist'], dir)
    assert.equal(unknownFlag.exitCode, 1)
    assert.match(unknownFlag.stderr, /Error:/)

    const badNumber = await runCli(['--font-size', 'not-a-number'], dir)
    assert.equal(badNumber.exitCode, 1)
    assert.match(badNumber.stderr, /--font-size must be a number/)

    const missingConfig = await runCli(['--config', join(dir, 'missing.json')], dir)
    assert.equal(missingConfig.exitCode, 1)
    assert.match(missingConfig.stderr, /Error:/)

    const badJsonPath = join(dir, 'bad.json')
    await writeFile(badJsonPath, '{invalid json')
    const badJson = await runCli(['--config', badJsonPath], dir)
    assert.equal(badJson.exitCode, 1)
    assert.match(badJson.stderr, /Error:/)

    const missingIcon = await runCli(['--icon', join(dir, 'missing.svg')], dir)
    assert.equal(missingIcon.exitCode, 1)
    assert.match(missingIcon.stderr, /Error:/)

    const corruptIconPath = join(dir, 'corrupt.png')
    await writeFile(corruptIconPath, 'not a real image')
    const corruptIcon = await runCli(['--icon', corruptIconPath], dir)
    assert.equal(corruptIcon.exitCode, 1)
    assert.match(corruptIcon.stderr, /Failed to decode icon/)

    const missingFont = await runCli(['--font-file', join(dir, 'missing.ttf')], dir)
    assert.equal(missingFont.exitCode, 1)
    assert.match(missingFont.stderr, /Font file not found/)
  })
})
