import { DEFAULT_FONT_FAMILY } from './config.ts'
import { logoFileName, logoSlug } from './encode.ts'
import type { LogoConfig } from './types.ts'

export type OpenShiftManifestMode = 'customLogoFile' | 'logos'

export interface OpenShiftClassicOptions {
  mode?: 'customLogoFile'
  fileName: string
  base64: string
  configMapName?: string
  customProductName?: string
}

export interface OpenShiftThemedOptions {
  mode: 'logos'
  lightFileName: string
  lightBase64: string
  darkFileName: string
  darkBase64: string
  configMapName?: string
  customProductName?: string
}

export type OpenShiftManifestOptions = OpenShiftClassicOptions | OpenShiftThemedOptions

function yamlString(value: string): string {
  return JSON.stringify(value)
}

/**
 * Builds an OpenShift `ConfigMap` (`openshift-config` namespace) +
 * `operator.openshift.io/v1` `Console` YAML document pair separated by `---`.
 */
export function buildOpenShiftManifest(options: OpenShiftManifestOptions): string {
  const productLine = options.customProductName?.trim()
    ? `\n    customProductName: ${yamlString(options.customProductName.trim())}`
    : ''

  if (options.mode === 'logos') {
    const configMapName = options.configMapName?.trim() || 'console-custom-logos'
    return [
      'apiVersion: v1',
      'kind: ConfigMap',
      'metadata:',
      `  name: ${configMapName}`,
      '  namespace: openshift-config',
      'binaryData:',
      `  ${options.lightFileName}: ${options.lightBase64}`,
      `  ${options.darkFileName}: ${options.darkBase64}`,
      '---',
      'apiVersion: operator.openshift.io/v1',
      'kind: Console',
      'metadata:',
      '  name: cluster',
      'spec:',
      '  customization:',
      '    logos:',
      '      - type: Masthead',
      '        themes:',
      '          - mode: Light',
      '            source:',
      '              from: ConfigMap',
      '              configMap:',
      `                name: ${configMapName}`,
      `                key: ${options.lightFileName}`,
      '          - mode: Dark',
      '            source:',
      '              from: ConfigMap',
      '              configMap:',
      `                name: ${configMapName}`,
      `                key: ${options.darkFileName}${productLine}`,
    ].join('\n')
  }

  const configMapName = options.configMapName?.trim() || 'console-custom-logo'
  return [
    'apiVersion: v1',
    'kind: ConfigMap',
    'metadata:',
    `  name: ${configMapName}`,
    '  namespace: openshift-config',
    'binaryData:',
    `  ${options.fileName}: ${options.base64}`,
    '---',
    'apiVersion: operator.openshift.io/v1',
    'kind: Console',
    'metadata:',
    '  name: cluster',
    'spec:',
    '  customization:',
    '    customLogoFile:',
    `      name: ${configMapName}`,
    `      key: ${options.fileName}${productLine}`,
  ].join('\n')
}

export interface KubermaticConfigOptions {
  productName: string
  lightFileName: string
  darkFileName: string
  namespace?: string
  configMapName?: string
  includeVolumeMounts?: boolean
}

/**
 * Builds a copy-paste ready `KubermaticConfiguration` (`kubermatic.k8c.io/v1`)
 * referencing `assets/branding/<filename>` for light and dark themes.
 */
export function buildKubermaticConfiguration(options: KubermaticConfigOptions): string {
  const namespace = options.namespace?.trim() || 'kubermatic'
  const configMapName = options.configMapName?.trim() || 'kubermatic-branding'
  const includeVolumeMounts = options.includeVolumeMounts ?? true

  const brandingJson = JSON.stringify(
    {
      branding: {
        product_name: options.productName,
        logo_url: `assets/branding/${options.lightFileName}`,
        logo_dark_url: `assets/branding/${options.darkFileName}`,
      },
    },
    null,
    2,
  )
  const indentedJson = brandingJson
    .split('\n')
    .map((line) => `        ${line}`)
    .join('\n')

  const lines = [
    'apiVersion: kubermatic.k8c.io/v1',
    'kind: KubermaticConfiguration',
    'metadata:',
    '  name: kubermatic',
    `  namespace: ${namespace}`,
    'spec:',
    '  ui:',
    '    config: |',
    indentedJson,
  ]

  if (includeVolumeMounts) {
    lines.push(
      '    extraVolumes:',
      '      - name: branding-logos',
      '        configMap:',
      `          name: ${configMapName}`,
      '    extraVolumeMounts:',
      '      - name: branding-logos',
      '        mountPath: /dist/assets/branding',
    )
  }

  return lines.join('\n')
}

export function buildKubermaticConfigMapCommand(options: {
  lightFileName: string
  darkFileName: string
  namespace?: string
  configMapName?: string
}): string {
  const namespace = options.namespace?.trim() || 'kubermatic'
  const configMapName = options.configMapName?.trim() || 'kubermatic-branding'
  return `kubectl create configmap ${configMapName} -n ${namespace} --from-file=${options.lightFileName} --from-file=${options.darkFileName} --dry-run=client -o yaml | kubectl apply -f -`
}

export type CiCdTarget = 'cli' | 'podman' | 'json'

export interface CiCdCommandOptions {
  config: LogoConfig
  iconFile?: string | 'default' | 'none'
  fontFile?: string
  fontsourceId?: string
  includeBase64Out?: boolean
  target?: CiCdTarget
}

function escapeDoubleQuotedShell(value: string): string {
  return value.replace(/([\\"$`])/g, '\\$1')
}

function quoteShellArg(value: string): string {
  return `"${escapeDoubleQuotedShell(value)}"`
}

function formatCliText(text: string): string {
  const escaped = escapeDoubleQuotedShell(text).replace(/\r?\n/g, '\\n')
  return `"${escaped}"`
}

function resolveLocalPath(file: string, prefix: string): string {
  return file.startsWith('/') || file.startsWith('./') ? file : `${prefix}${file}`
}

/** Builds a `logo.json` payload compatible with `node src/cli/generate.ts --config`. */
export function buildLogoConfigJson(config: LogoConfig): string {
  return JSON.stringify(config, null, 2)
}

/**
 * Builds a copy-paste ready CI/CD command (`node src/cli/generate.ts`,
 * Podman `Containerfile`, or `--config logo.json`) mirroring the active
 * studio configuration.
 */
export function buildCiCdCommand(options: CiCdCommandOptions): string {
  const { config, iconFile = 'default', fontFile, fontsourceId, includeBase64Out = false, target = 'cli' } = options
  const fileName = logoFileName(config.text)
  const b64Name = `${logoSlug(config.text)}.b64`

  if (target === 'json') {
    const outPath = `dist/${fileName}`
    const flags: string[] = ['--config logo.json']
    if (iconFile === 'none') {
      flags.push('--no-icon')
    } else if (iconFile !== 'default') {
      flags.push(`--icon ${quoteShellArg(resolveLocalPath(iconFile, './'))}`)
    }
    if (fontsourceId) {
      flags.push(`--fontsource ${quoteShellArg(fontsourceId)}`)
    } else if (fontFile) {
      flags.push(`--font-file ${quoteShellArg(resolveLocalPath(fontFile, './'))}`)
    }
    flags.push(`--out ${quoteShellArg(outPath)}`)
    if (includeBase64Out) {
      flags.push(`--base64-out ${quoteShellArg(`dist/${b64Name}`)}`)
    }
    return `node src/cli/generate.ts \\\n  ${flags.join(' \\\n  ')}`
  }

  const isPodman = target === 'podman'
  const filePrefix = isPodman ? '/work/' : './'
  const outDir = isPodman ? '/out' : 'dist'

  const flags: string[] = [`--text ${formatCliText(config.text)}`]

  if (iconFile === 'none') {
    flags.push('--no-icon')
  } else if (iconFile !== 'default') {
    flags.push(`--icon ${quoteShellArg(resolveLocalPath(iconFile, filePrefix))}`)
  }

  if (fontsourceId) {
    flags.push(`--fontsource ${quoteShellArg(fontsourceId)}`)
  } else if (fontFile) {
    flags.push(`--font-file ${quoteShellArg(resolveLocalPath(fontFile, filePrefix))}`)
  } else if (config.fontFamily !== DEFAULT_FONT_FAMILY) {
    flags.push(`--font-family ${quoteShellArg(config.fontFamily)}`)
  }

  flags.push(
    `--font-weight ${config.fontWeight}`,
    `--font-size ${config.fontSize}`,
    `--line-spacing ${config.lineSpacing}`,
    `--color ${config.textColor.replace(/^#/, '')}`,
    `--icon-height ${config.iconHeight}`,
    `--gap ${config.gap}`,
    `--margin ${config.outerMargin}`,
    `--out ${quoteShellArg(`${outDir}/${fileName}`)}`,
  )

  if (includeBase64Out) {
    flags.push(`--base64-out ${quoteShellArg(`${outDir}/${b64Name}`)}`)
  }

  if (isPodman) {
    const needsWorkMount = (iconFile !== 'default' && iconFile !== 'none') || Boolean(fontFile)
    const volumes = needsWorkMount ? '-v "$PWD/out:/out" -v "$PWD:/work:ro"' : '-v "$PWD/out:/out"'
    return [
      `podman run --rm ${volumes} ghcr.io/dm0dev/kubranding:latest \\\n  ${flags.join(' \\\n  ')}`,
    ].join('\n')
  }

  return `node src/cli/generate.ts \\\n  ${flags.join(' \\\n  ')}`
}
