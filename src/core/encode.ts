const PNG_PREFIX = 'data:image/png;base64,'

export function pngBase64ToDataUri(base64: string): string {
  return PNG_PREFIX + base64
}

/** Strips the `data:image/png;base64,` prefix if present. */
export function dataUriToBase64(dataUri: string): string {
  return dataUri.startsWith(PNG_PREFIX) ? dataUri.slice(PNG_PREFIX.length) : dataUri
}

/** Decoded byte length of a base64 string. */
export function base64ByteLength(base64: string): number {
  const padding = /=+$/.exec(base64)?.[0].length ?? 0
  return Math.max(0, Math.floor((base64.length * 3) / 4) - padding)
}

export function formatByteSize(bytes: number): string {
  return bytes < 1024 ? `${bytes} B` : `${(bytes / 1024).toFixed(2)} KB`
}

/** `"Your Fancy\nKubernetes"` → `"your-fancy-kubernetes"` */
export function logoSlug(text: string): string {
  const slug = text
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
  return slug || 'custom-logo'
}

/** `"Your Fancy\nKubernetes"` → `"your-fancy-kubernetes.png"` */
export function logoFileName(text: string): string {
  return `${logoSlug(text)}.png`
}

/** `"Your Fancy\nKubernetes"`, `'light'` → `"your-fancy-kubernetes-light.png"` */
export function themedLogoFileName(text: string, theme: 'light' | 'dark'): string {
  return `${logoSlug(text)}-${theme}.png`
}

/** Collapses multi-line logo text into a single-line product name. */
export function productNameFromText(text: string): string {
  return text.replace(/\s+/g, ' ').trim() || 'Custom Platform'
}

export const SUPPORTED_ICON_MIME_TYPES = ['image/png', 'image/svg+xml', 'image/jpeg', 'image/webp'] as const

export function isSupportedIconFile(fileName: string, mimeType = ''): boolean {
  return (
    (SUPPORTED_ICON_MIME_TYPES as readonly string[]).includes(mimeType) ||
    /\.(png|svg|jpe?g|webp)$/i.test(fileName)
  )
}

/** `"logo.svg"` → `"SVG Image"` */
export function iconTypeLabel(fileName: string): string {
  const ext = (fileName.split('.').pop() || 'IMG').toUpperCase()
  return `${ext} Image`
}
