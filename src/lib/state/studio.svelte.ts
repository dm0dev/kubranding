import { copyText, downloadText, downloadUrl } from '../../browser/dom.ts'
import {
  fetchFontsourceCatalog,
  loadFontsourceFont,
  type FontsourceCatalogEntry,
  type FontsourceFont,
} from '../../browser/fonts.ts'
import { loadImageAsset, readFileAsDataUrl, svgToDataUrl, type LoadedIcon } from '../../browser/icon.ts'
import {
  DEFAULT_CONFIG,
  DEFAULT_ICON_FILE,
  DEFAULT_ICON_NAME,
  DEFAULT_ICON_TYPE_LABEL,
  base64ByteLength,
  dataUriToBase64,
  fontWeightOptions,
  formatByteSize,
  iconTypeLabel,
  isSupportedIconFile,
  logoFileName,
  logoSlug,
  parseHexColor,
  pickNearestFontWeight,
  productNameFromText,
  resolveThemedTextColors,
  themedLogoFileName,
  type LogoConfig,
  type LogoLayout,
} from '../../core/index.ts'
import { toast } from './toast.svelte.ts'

export type StageBackground = 'checker' | 'dark' | 'light'
export type OutputTab = 'base64' | 'openshift' | 'rancher' | 'kubermatic' | 'cicd'

/**
 * Reactive application state of the in-browser studio.
 *
 * Holds the `LogoConfig` (the exact same shape the Node CLI consumes) plus
 * UI-only state. Rendering itself lives in `src/core`; `PreviewCard.svelte`
 * feeds the result back through `setRenderResult`.
 */
export class KuBrandingStudio {
  config = $state<LogoConfig>({ ...DEFAULT_CONFIG })
  icon = $state.raw<LoadedIcon | null>(null)
  fontsourceFonts = $state.raw<FontsourceFont[]>([])
  fontsourceCatalog = $state.raw<FontsourceCatalogEntry[]>([])
  fontsourceCatalogLoading = $state(false)
  fontsourceCatalogError = $state<string | null>(null)
  fontsourceLoadingId = $state<string | null>(null)

  stageBackground = $state<StageBackground>('checker')
  showGuides = $state(false)
  activeOutputTab = $state<OutputTab>('base64')
  includeDataUriPrefix = $state(true)
  base64BoxOpen = $state(true)
  copied = $state(false)

  /** Optional per-theme text colour overrides for dual-theme outputs (null = auto). */
  lightTextOverride = $state<string | null>(null)
  darkTextOverride = $state<string | null>(null)

  /** Latest render output. */
  layout = $state.raw<LogoLayout | null>(null)
  dataUrl = $state('')
  lightDataUrl = $state('')
  darkDataUrl = $state('')

  rawBase64 = $derived(dataUriToBase64(this.dataUrl))
  base64Text = $derived(this.includeDataUriPrefix ? this.dataUrl : this.rawBase64)
  byteSize = $derived(formatByteSize(base64ByteLength(this.rawBase64)))
  dimensionLabel = $derived(
    this.layout ? `${this.layout.canvasWidth} × ${this.layout.canvasHeight} px` : '0 × 0 px',
  )

  autoThemeColors = $derived(resolveThemedTextColors(this.config.textColor))
  lightTextColor = $derived(this.lightTextOverride ?? this.autoThemeColors.light)
  darkTextColor = $derived(this.darkTextOverride ?? this.autoThemeColors.dark)

  slug = $derived(logoSlug(this.config.text))
  primaryFileName = $derived(logoFileName(this.config.text))
  lightFileName = $derived(themedLogoFileName(this.config.text, 'light'))
  darkFileName = $derived(themedLogoFileName(this.config.text, 'dark'))
  productName = $derived(productNameFromText(this.config.text))
  activeFontsourceFont = $derived(
    this.fontsourceFonts.find((f) => f.cssFamily === this.config.fontFamily) ?? null,
  )
  availableFontWeights = $derived(fontWeightOptions(this.activeFontsourceFont?.weights))

  lightRawBase64 = $derived(dataUriToBase64(this.lightDataUrl))
  darkRawBase64 = $derived(dataUriToBase64(this.darkDataUrl))
  lightByteCount = $derived(base64ByteLength(this.lightRawBase64))
  darkByteCount = $derived(base64ByteLength(this.darkRawBase64))
  lightByteSize = $derived(formatByteSize(this.lightByteCount))
  darkByteSize = $derived(formatByteSize(this.darkByteCount))

  #copiedTimer: ReturnType<typeof setTimeout> | undefined

  setRenderResult(layout: LogoLayout, dataUrl: string): void {
    this.layout = layout
    this.dataUrl = dataUrl
  }

  setThemedRenderResults(lightDataUrl: string, darkDataUrl: string): void {
    this.lightDataUrl = lightDataUrl
    this.darkDataUrl = darkDataUrl
  }

  setRenderError(): void {
    this.dataUrl = ''
    this.lightDataUrl = ''
    this.darkDataUrl = ''
  }

  // ── Icon ────────────────────────────────────────────────────────────────
  async loadDefaultIcon(): Promise<void> {
    try {
      const response = await fetch(`${import.meta.env.BASE_URL}${DEFAULT_ICON_FILE}`)
      if (!response.ok) throw new Error(`Could not load ${DEFAULT_ICON_FILE} (${response.status})`)
      const src = svgToDataUrl(await response.text())
      this.icon = {
        asset: await loadImageAsset(src),
        name: DEFAULT_ICON_NAME,
        typeLabel: DEFAULT_ICON_TYPE_LABEL,
        previewSrc: src,
        isDefault: true,
      }
    } catch (error) {
      toast.show((error as Error).message, 'error')
    }
  }

  async restoreDefaultIcon(): Promise<void> {
    await this.loadDefaultIcon()
    toast.show('Restored built-in sample cube icon')
  }

  async setIconFromFile(file: File): Promise<void> {
    if (!isSupportedIconFile(file.name, file.type)) {
      toast.show('Unsupported format. Use PNG, SVG, JPG, or WebP.', 'error')
      return
    }
    try {
      const src = await readFileAsDataUrl(file)
      this.icon = {
        asset: await loadImageAsset(src),
        name: file.name,
        typeLabel: iconTypeLabel(file.name),
        previewSrc: src,
        isDefault: false,
      }
      toast.show(`Loaded "${file.name}"`)
    } catch (error) {
      toast.show((error as Error).message, 'error')
    }
  }

  // ── Fonts (Fontsource) ──────────────────────────────────────────────────
  async loadFontsourceCatalog(): Promise<void> {
    if (this.fontsourceCatalog.length > 0 || this.fontsourceCatalogLoading) return
    this.fontsourceCatalogLoading = true
    this.fontsourceCatalogError = null
    try {
      this.fontsourceCatalog = await fetchFontsourceCatalog()
    } catch (error) {
      this.fontsourceCatalogError = (error as Error).message || 'Could not load Fontsource catalog'
    } finally {
      this.fontsourceCatalogLoading = false
    }
  }

  setFontFamily(cssFamily: string): void {
    this.config.fontFamily = cssFamily
    const allowed = this.availableFontWeights.map((w) => w.value)
    if (!allowed.includes(this.config.fontWeight)) {
      this.config.fontWeight = pickNearestFontWeight(this.config.fontWeight, allowed)
    }
  }

  async loadFontsource(idOrQuery: string): Promise<FontsourceFont | null> {
    const requested = idOrQuery.trim()
    if (!requested) return null
    this.fontsourceLoadingId = requested
    try {
      const font = await loadFontsourceFont(requested, this.config.fontWeight)
      const isBuiltInPreset = font.id === 'inter' || font.id === 'jetbrains-mono'
      if (!isBuiltInPreset && !this.fontsourceFonts.some((f) => f.id === font.id)) {
        this.fontsourceFonts = [...this.fontsourceFonts, font]
      }
      if (font.weights.length > 0 && !font.weights.includes(this.config.fontWeight)) {
        this.config.fontWeight = pickNearestFontWeight(this.config.fontWeight, font.weights)
      }
      this.config.fontFamily = font.cssFamily
      toast.show(`Loaded "${font.family}" from Fontsource`)
      return font
    } catch (error) {
      console.error('Fontsource loading error:', error)
      toast.show((error as Error).message || 'Could not load font from Fontsource.', 'error')
      return null
    } finally {
      this.fontsourceLoadingId = null
    }
  }

  // ── Colour ──────────────────────────────────────────────────────────────
  setTextColor(input: string): void {
    const hex = parseHexColor(input)
    if (hex) this.config.textColor = hex
  }

  /** Swatch click: also flips the stage background if the text would vanish. */
  pickSwatch(hex: string): void {
    this.setTextColor(hex)
    if (hex === '#151515' && this.stageBackground === 'dark') this.stageBackground = 'light'
    else if (hex === '#FFFFFF' && this.stageBackground === 'light') this.stageBackground = 'dark'
  }

  // ── Output actions ──────────────────────────────────────────────────────
  async copyBase64(): Promise<void> {
    if (await copyText(this.base64Text)) {
      this.copied = true
      toast.show('Base64 string copied to clipboard')
      clearTimeout(this.#copiedTimer)
      this.#copiedTimer = setTimeout(() => (this.copied = false), 1800)
    } else {
      toast.show('Copy failed — select text manually from box.', 'error')
    }
  }

  async copyContent(text: string, label: string): Promise<boolean> {
    if (await copyText(text)) {
      toast.show(`${label} copied to clipboard`)
      return true
    }
    toast.show('Copy failed — select text manually.', 'error')
    return false
  }

  downloadPng(): void {
    if (!this.dataUrl) return
    const fileName = this.primaryFileName
    downloadUrl(this.dataUrl, fileName)
    toast.show(`Downloaded "${fileName}"`)
  }

  downloadThemedPng(theme: 'light' | 'dark'): void {
    const url = theme === 'light' ? this.lightDataUrl : this.darkDataUrl
    if (!url) return
    const fileName = theme === 'light' ? this.lightFileName : this.darkFileName
    downloadUrl(url, fileName)
    toast.show(`Downloaded "${fileName}"`)
  }

  downloadTextFile(content: string, fileName: string): void {
    if (!content) return
    downloadText(content, fileName)
    toast.show(`Downloaded "${fileName}"`)
  }

  reset(): void {
    this.config = { ...DEFAULT_CONFIG }
    this.stageBackground = 'checker'
    this.lightTextOverride = null
    this.darkTextOverride = null
    void this.loadDefaultIcon()
    toast.show('Reset to default configuration')
  }
}

export const studio = new KuBrandingStudio()
