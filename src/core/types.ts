/**
 * Platform-agnostic types for the logo generator.
 *
 * NOTHING in `src/core` may import from the DOM, Svelte or Node. Platform
 * specifics are injected through the small interfaces declared here
 * (`CanvasLike`, `DrawContext`, `IconAsset`) and implemented by:
 *   - `src/browser/*` (HTMLCanvasElement / HTMLImageElement)
 *   - `src/node/*`    (@napi-rs/canvas)
 */

/** Everything that influences the rendered logo. All lengths are in px. */
export interface LogoConfig {
  /** Target height of the left icon. Width follows the icon's aspect ratio. */
  iconHeight: number
  /** Logo text. `\n` separates lines. */
  text: string
  /** CSS font-family list (e.g. `'Inter', system-ui, sans-serif`). */
  fontFamily: string
  /** CSS font weight (100–900). */
  fontWeight: number
  fontSize: number
  /** Extra vertical space between text lines (may be negative). */
  lineSpacing: number
  /** `#RRGGBB` */
  textColor: string
  /** Space between icon and text block. */
  gap: number
  /** Transparent margin around the whole logo. */
  outerMargin: number
}

/** A decoded icon image, independent of the platform that decoded it. */
export interface IconAsset {
  /** Intrinsic width in px. */
  width: number
  /** Intrinsic height in px. */
  height: number
  /** Platform image object (HTMLImageElement, @napi-rs/canvas Image, …). */
  source: unknown
}

/** The subset of `TextMetrics` the layout engine needs. */
export interface TextMetricsLike {
  width: number
  actualBoundingBoxLeft?: number
  actualBoundingBoxRight?: number
  actualBoundingBoxAscent?: number
  actualBoundingBoxDescent?: number
}

/**
 * The subset of CanvasRenderingContext2D used by the renderer. Both the browser
 * context and @napi-rs/canvas satisfy it structurally.
 * (`any` is intentional: colour/image types differ between platforms.)
 */
/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DrawContext {
  font: string
  textBaseline: any
  textAlign: any
  fillStyle: any
  strokeStyle: any
  lineWidth: number
  imageSmoothingEnabled: boolean
  imageSmoothingQuality: any
  measureText(text: string): TextMetricsLike
  fillText(text: string, x: number, y: number): void
  clearRect(x: number, y: number, w: number, h: number): void
  drawImage(image: any, dx: number, dy: number, dw: number, dh: number): void
  setLineDash(segments: number[]): void
  strokeRect(x: number, y: number, w: number, h: number): void
  beginPath(): void
  moveTo(x: number, y: number): void
  lineTo(x: number, y: number): void
  stroke(): void
}
/* eslint-enable @typescript-eslint/no-explicit-any */

/** A resizable 2D canvas (HTMLCanvasElement, OffscreenCanvas, napi Canvas). */
export interface CanvasLike {
  width: number
  height: number
  getContext(contextId: '2d'): DrawContext | null
}

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface TextLineLayout {
  text: string
  /** Distance from draw-x to the left-most ink (actualBoundingBoxLeft). */
  leftInset: number
  rightExtent: number
  /** Exact ink width. */
  width: number
  ascent: number
  descent: number
  /** Exact ink height (ascent + descent, min 1). */
  height: number
  /** Top of this line's ink box, relative to the top of the text block. */
  top: number
}

/** Fully resolved geometry of a rendered logo. Pure data, JSON-serialisable. */
export interface LogoLayout {
  canvasWidth: number
  canvasHeight: number
  margin: number
  /** Content (everything inside the margin). */
  contentWidth: number
  contentHeight: number
  /** `null` when no icon is present. */
  icon: Rect | null
  /** `null` when there is no visible text. */
  text: (Rect & { lines: TextLineLayout[] }) | null
  /** Effective gap (0 when icon or text is missing). */
  gap: number
  /** Full CSS font shorthand used for measuring and drawing. */
  fontSpec: string
}
