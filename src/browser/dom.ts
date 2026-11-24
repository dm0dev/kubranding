/**
 * Copies text to the clipboard. Uses the async Clipboard API when available and
 * falls back to `execCommand` (needed in iframes / non-secure contexts).
 */
export async function copyText(text: string): Promise<boolean> {
  if (!text) return false

  if (navigator.clipboard && window.isSecureContext) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // fall through to legacy path
    }
  }

  const area = document.createElement('textarea')
  area.value = text
  area.setAttribute('readonly', '')
  area.style.position = 'fixed'
  area.style.opacity = '0'
  document.body.appendChild(area)
  area.select()
  area.setSelectionRange(0, text.length)
  let copied = false
  try {
    copied = document.execCommand('copy')
  } catch {
    copied = false
  }
  document.body.removeChild(area)
  return copied
}

/** Triggers a browser download of a data/blob URL. */
export function downloadUrl(url: string, fileName: string): void {
  const link = document.createElement('a')
  link.download = fileName
  link.href = url
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
}

/** Triggers a browser download of a UTF-8 text file (e.g. YAML). */
export function downloadText(content: string, fileName: string, mimeType = 'text/yaml;charset=utf-8'): void {
  const blob = new Blob([content], { type: mimeType })
  const url = URL.createObjectURL(blob)
  downloadUrl(url, fileName)
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
