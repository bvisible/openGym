//// Neoffice — added file (no upstream equivalent).
////
//// Hands the finished picture to the member: the phone's own share sheet when the browser has one for files (Instagram, WhatsApp,
//// Messages, « Save image »), a download when it has not. Nothing goes through a server of ours.
import { MOBILE, shareExportBlob } from '../mobile.js'

/**
 * Resolves 'shared' | 'downloaded' | 'cancelled'. A closed share sheet is the member changing their mind, not a failure; a share
 * the browser refuses for another reason falls back to the download, which always works.
 */
export async function sendImage(blob, name, title) {
  if (MOBILE) {
    try { await shareExportBlob(blob, name); return 'shared' } catch (e) { return 'cancelled' }
  }
  const file = typeof File === 'function' ? new File([blob], name, { type: blob.type || 'image/png' }) : null
  if (file && navigator.canShare?.({ files: [file] })) {
    try {
      await navigator.share({ files: [file], title })
      return 'shared'
    } catch (e) {
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  const a = document.createElement('a')
  a.href = URL.createObjectURL(blob)
  a.download = name
  a.click()
  setTimeout(() => URL.revokeObjectURL(a.href), 1000)
  return 'downloaded'
}

/** Whether this browser can put a picture on the clipboard (a ClipboardItem and an async clipboard): the « Copy image » button exists only then. */
export const canCopyImage = () => typeof ClipboardItem === 'function' && !!globalThis.navigator?.clipboard?.write

/**
 * Puts `blob` (a PNG: a transparent sticker keeps its transparency there) on the clipboard, to be pasted onto a story or into a message.
 * Resolves 'copied' | 'unsupported' | 'failed'. The write starts at once, in the tap that asked for it: a browser lets the clipboard
 * be written only inside a tap, and waits for nothing here.
 */
export async function copyImage(blob) {
  if (!canCopyImage()) return 'unsupported'
  try {
    await navigator.clipboard.write([new ClipboardItem({ [blob.type || 'image/png']: blob })])
    return 'copied'
  } catch (e) {
    return 'failed'
  }
}
