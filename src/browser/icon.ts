import type { IconAsset } from '../core/index.ts'

export interface LoadedIcon {
  asset: IconAsset
  name: string
  typeLabel: string
  /** URL usable in an `<img>` for thumbnails. */
  previewSrc: string
  isDefault?: boolean
}

/** Decodes an image URL (data: or blob:) into an `IconAsset`. */
export function loadImageAsset(src: string): Promise<IconAsset> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () =>
      resolve({
        source: img,
        width: img.naturalWidth || img.width || 140,
        height: img.naturalHeight || img.height || 160,
      })
    img.onerror = () => reject(new Error('Failed to load image asset.'))
    img.src = src
  })
}

export function svgToDataUrl(svg: string): string {
  return 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg)
}

export function readFileAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Error reading image file.'))
    reader.readAsDataURL(file)
  })
}
