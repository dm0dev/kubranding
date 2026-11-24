import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_CONFIG,
  cssFontStackForFamily,
  fontWeightOptions,
  normalizeConfig,
  parseHexColor,
  pickNearestFontWeight,
  resolveThemedTextColors,
} from './config.ts'
import { base64ByteLength, formatByteSize, logoFileName, productNameFromText, themedLogoFileName } from './encode.ts'
import { computeLayout } from './layout.ts'
import {
  buildCiCdCommand,
  buildKubermaticConfigMapCommand,
  buildKubermaticConfiguration,
  buildLogoConfigJson,
  buildOpenShiftManifest,
} from './manifests.ts'

/** Fake monospace measurer: 10px per char, 8px ascent, 2px descent. */
const measure = (line: string) => ({
  width: line.length * 10,
  actualBoundingBoxLeft: 0,
  actualBoundingBoxRight: line.length * 10,
  actualBoundingBoxAscent: 8,
  actualBoundingBoxDescent: 2,
})

describe('computeLayout', () => {
  it('centres icon and text block and sizes the canvas to fit', () => {
    const config = normalizeConfig({
      text: 'abc\nabcdef',
      iconHeight: 40,
      gap: 10,
      outerMargin: 5,
      lineSpacing: 4,
    })
    const layout = computeLayout(config, { width: 100, height: 50 }, measure)

    // icon: 40 high, aspect 2 → 80 wide
    assert.equal(layout.icon?.width, 80)
    assert.equal(layout.icon?.height, 40)
    // text: widest line 60, two 10px lines + 4px spacing = 24
    assert.equal(layout.text?.width, 60)
    assert.equal(layout.text?.height, 24)
    assert.equal(layout.gap, 10)
    assert.equal(layout.canvasWidth, 80 + 10 + 60 + 10)
    assert.equal(layout.canvasHeight, 40 + 10)
    // icon is the taller element, text is centred vertically around it
    assert.equal(layout.icon?.y, 5)
    assert.equal(layout.text?.y, 5 + Math.round((40 - 24) / 2))
    assert.equal(layout.text?.x, 5 + 80 + 10)
  })

  it('drops the gap when there is no icon', () => {
    const layout = computeLayout(normalizeConfig({ text: 'abc', outerMargin: 0 }), null, measure)
    assert.equal(layout.icon, null)
    assert.equal(layout.gap, 0)
    assert.equal(layout.canvasWidth, 30)
  })

  it('handles empty text and never returns a zero-sized canvas', () => {
    const layout = computeLayout(normalizeConfig({ text: '', outerMargin: 0 }), null, measure)
    assert.equal(layout.text, null)
    assert.equal(layout.canvasWidth, 1)
    assert.equal(layout.canvasHeight, 1)
  })

  it('keeps blank lines as vertical advance', () => {
    const layout = computeLayout(normalizeConfig({ text: 'a\n\nb', lineSpacing: 0 }), null, measure)
    assert.equal(layout.text?.lines.length, 3)
    assert.equal(layout.text?.height, 30)
  })
})

describe('normalizeConfig', () => {
  it('fills defaults and clamps values', () => {
    const c = normalizeConfig({ fontSize: 9999, gap: -5, textColor: 'nope', fontWeight: 1234 })
    assert.equal(c.fontSize, 240)
    assert.equal(c.gap, 0)
    assert.equal(c.textColor, DEFAULT_CONFIG.textColor)
    assert.equal(c.fontWeight, 900)
    assert.equal(c.text, DEFAULT_CONFIG.text)
  })

  it('accepts numeric strings (CLI / env input)', () => {
    const c = normalizeConfig({ fontSize: '48' as unknown as number })
    assert.equal(c.fontSize, 48)
  })
})

describe('helpers', () => {
  it('parses hex colours', () => {
    assert.equal(parseHexColor('#abc'), '#AABBCC')
    assert.equal(parseHexColor('ee0000'), '#EE0000')
    assert.equal(parseHexColor('xyz'), null)
  })

  it('derives file names, product names, and sizes', () => {
    assert.equal(logoFileName('Your Fancy\nKubernetes'), 'your-fancy-kubernetes.png')
    assert.equal(themedLogoFileName('Your Fancy\nKubernetes', 'light'), 'your-fancy-kubernetes-light.png')
    assert.equal(themedLogoFileName('Your Fancy\nKubernetes', 'dark'), 'your-fancy-kubernetes-dark.png')
    assert.equal(logoFileName('  '), 'custom-logo.png')
    assert.equal(productNameFromText('Your Fancy\nKubernetes'), 'Your Fancy Kubernetes')
    assert.equal(base64ByteLength('QQ=='), 1)
    assert.equal(formatByteSize(2048), '2.00 KB')
  })

  it('resolves light and dark contrast text colours', () => {
    assert.deepEqual(resolveThemedTextColors('#FFFFFF'), { light: '#151515', dark: '#FFFFFF' })
    assert.deepEqual(resolveThemedTextColors('#151515'), { light: '#151515', dark: '#FFFFFF' })
    assert.deepEqual(resolveThemedTextColors('#EE0000'), { light: '#EE0000', dark: '#EE0000' })
  })

  it('builds font weight options, picks nearest weights, and builds CSS stacks', () => {
    assert.equal(pickNearestFontWeight(700, [400, 600]), 600)
    assert.equal(pickNearestFontWeight(500, [400, 700]), 400)
    assert.deepEqual(
      fontWeightOptions([700, 300, 700]).map((w) => w.value),
      [300, 700],
    )
    assert.match(cssFontStackForFamily('Fira Code', 'monospace'), /^'Fira Code'.*monospace$/)
    assert.match(cssFontStackForFamily('Space Grotesk', 'sans-serif'), /^'Space Grotesk'.*sans-serif$/)
    assert.match(cssFontStackForFamily('Playfair Display', 'serif'), /^'Playfair Display'.*serif$/)
  })
})

describe('manifests', () => {
  it('builds OpenShift ConfigMap + Console YAML in customLogoFile mode', () => {
    const yaml = buildOpenShiftManifest({
      fileName: 'acme.png',
      base64: 'AAAA',
    })
    assert.match(yaml, /kind: ConfigMap/)
    assert.match(yaml, /namespace: openshift-config/)
    assert.match(yaml, /acme\.png: AAAA/)
    assert.match(yaml, /apiVersion: operator\.openshift\.io\/v1/)
    assert.match(yaml, /kind: Console/)
    assert.match(yaml, /customLogoFile:/)
    assert.match(yaml, /key: acme\.png/)
  })

  it('builds OpenShift 4.19+ ConfigMap + Console YAML in logos mode', () => {
    const yaml = buildOpenShiftManifest({
      mode: 'logos',
      lightFileName: 'acme-light.png',
      lightBase64: 'LLLL',
      darkFileName: 'acme-dark.png',
      darkBase64: 'DDDD',
    })
    assert.match(yaml, /acme-light\.png: LLLL/)
    assert.match(yaml, /acme-dark\.png: DDDD/)
    assert.match(yaml, /type: Masthead/)
    assert.match(yaml, /mode: Light/)
    assert.match(yaml, /mode: Dark/)
  })

  it('builds KubermaticConfiguration YAML with light/dark filenames', () => {
    const yaml = buildKubermaticConfiguration({
      productName: 'Acme Cloud',
      lightFileName: 'acme-light.png',
      darkFileName: 'acme-dark.png',
    })
    assert.match(yaml, /apiVersion: kubermatic\.k8c\.io\/v1/)
    assert.match(yaml, /kind: KubermaticConfiguration/)
    assert.match(yaml, /"product_name": "Acme Cloud"/)
    assert.match(yaml, /"logo_url": "assets\/branding\/acme-light\.png"/)
    assert.match(yaml, /"logo_dark_url": "assets\/branding\/acme-dark\.png"/)
    assert.match(yaml, /mountPath: \/dist\/assets\/branding/)

    const cmd = buildKubermaticConfigMapCommand({
      lightFileName: 'acme-light.png',
      darkFileName: 'acme-dark.png',
    })
    assert.match(cmd, /--from-file=acme-light\.png --from-file=acme-dark\.png/)
  })

  it('builds CI/CD commands for CLI, Podman, JSON config, and Fontsource', () => {
    const cli = buildCiCdCommand({
      config: DEFAULT_CONFIG,
      iconFile: 'acme.svg',
      includeBase64Out: true,
      target: 'cli',
    })
    assert.match(cli, /^node src\/cli\/generate\.ts/)
    assert.match(cli, /--text "Your Fancy\\nKubernetes"/)
    assert.match(cli, /--icon "\.\/acme\.svg"/)
    assert.match(cli, /--color FFFFFF/)
    assert.match(cli, /--out "dist\/your-fancy-kubernetes\.png"/)
    assert.match(cli, /--base64-out "dist\/your-fancy-kubernetes\.b64"/)

    const podman = buildCiCdCommand({
      config: DEFAULT_CONFIG,
      iconFile: 'default',
      target: 'podman',
    })
    assert.match(podman, /mkdir -p "\$PWD\/out" && podman run --rm/)
    assert.match(podman, /--userns=keep-id --user "\$\(id -u\):\$\(id -g\)"/)
    assert.match(podman, /-v "\$PWD\/out:\/out:Z"/)
    assert.doesNotMatch(podman, /\/work/)
    assert.match(podman, /ghcr\.io\/dm0dev\/kubranding:latest/)
    assert.match(podman, /--out "\/out\/your-fancy-kubernetes\.png"/)

    const podmanWithAssets = buildCiCdCommand({
      config: DEFAULT_CONFIG,
      iconFile: './acme.svg',
      target: 'podman',
    })
    assert.match(podmanWithAssets, /-v "\$PWD:\/work:ro,z"/)
    assert.match(podmanWithAssets, /--icon "\/work\/acme\.svg"/)

    const jsonCmd = buildCiCdCommand({
      config: DEFAULT_CONFIG,
      fontFile: 'brand.woff2',
      target: 'json',
    })
    assert.match(jsonCmd, /--config logo\.json/)
    assert.match(jsonCmd, /--font-file "\.\/brand\.woff2"/)

    const fontsourceCli = buildCiCdCommand({
      config: { ...DEFAULT_CONFIG, fontFamily: "'Space Grotesk', system-ui, sans-serif" },
      fontsourceId: 'space-grotesk',
      target: 'cli',
    })
    assert.match(fontsourceCli, /--fontsource "space-grotesk"/)
    assert.doesNotMatch(fontsourceCli, /--font-family/)

    const json = JSON.parse(buildLogoConfigJson(DEFAULT_CONFIG))
    assert.equal(json.text, DEFAULT_CONFIG.text)
    assert.equal(json.textColor, DEFAULT_CONFIG.textColor)
  })
})
