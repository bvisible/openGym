//// Neoffice — added file (no upstream equivalent).
////
//// Makes the picture a member shares: a model (lib/share/model.js), its layout (layout.js), the drawing (draw.js) on a canvas, a Blob
//// at the end. The only part of lib/share/ that touches the page: it reads the app's accent, loads the club's logo and owns the canvas.
//// The muscle card keeps its own drawing (lib/workout-card.js, lib/share/muscles.js); everything else, the photo and the numbers, is here.
import { shareModel } from './model.js'
import { layoutShare } from './layout.js'
import { drawShare, paletteFor, logoInfo, lowerBrightness } from './draw.js'
import { FONT } from './text.js'
import { DEFAULT_FOCUS } from './frame.js'

const logos = new Map()
/** The club's logo as { img, plate } (draw.js), or null when it cannot be loaded: a missing logo never loses the picture. */
export function loadLogo(url) {
  if (!url) return Promise.resolve(null)
  if (!logos.has(url)) {
    logos.set(url, new Promise(resolve => {
      const img = new Image()
      //// Same origin as the journal (the club's own file). crossOrigin stays unset on purpose: setting it would make the browser demand
      //// CORS headers the instance does not send, and the load would fail for a file that is right there.
      img.onload = () => resolve(logoInfo(img))
      img.onerror = () => resolve(null)
      img.src = url
    }))
  }
  return logos.get(url)
}

let scratch = null
/** A way to measure text in the picture's font. */
export function textMeasure() {
  scratch = scratch || document.createElement('canvas').getContext('2d')
  return (text, weight, size) => { scratch.font = `${weight} ${size}px ${FONT}`; return scratch.measureText(String(text)).width }
}

/** The app's accent right now, as the drawing needs it. */
export function currentAccent(doc = globalThis.document) {
  try { return getComputedStyle(doc.documentElement).getPropertyValue('--acc').trim() || '#30d158' } catch { return '#30d158' }
}

/**
 * The photo or numbers picture of `w`. `photo` = { source, width, height } (the decoded photo) or null; `focus` where its crop sits;
 * `scale` shrinks the whole picture (the preview is drawn smaller than the one that is shared). Resolves a Blob, or null when the
 * browser cannot make one. A logo the browser will not let us read back (a tainted canvas) is left out and the picture made again.
 */
export async function renderShare({ w, nameOf, unit, speedUnit, picks, club, template = 'photo', format = 'feed', photo = null, focus = DEFAULT_FOCUS, accent, scale = 1, type = 'image/png', quality = 0.92 }) {
  const model = shareModel(w, { unit, nameOf, speedUnit, picks, club })
  const layout = layoutShare(model, { template, format, measure: textMeasure(), rtl: globalThis.document?.documentElement?.dir === 'rtl' })
  const logo = await loadLogo(model.club.logo)
  const colors = paletteFor(accent || currentAccent())
  const make = withLogo => {
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(layout.width * scale)
    canvas.height = Math.round(layout.height * scale)
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    ctx.scale(scale, scale)
    const bright = template === 'photo' && photo ? lowerBrightness(photo, layout, focus) : 0.4
    drawShare(ctx, layout, { colors, photo: template === 'photo' ? photo : null, focus, logo: withLogo, bright })
    return new Promise(resolve => canvas.toBlob(resolve, type, quality))
  }
  try {
    return await make(logo)
  } catch (e) {
    return make(null)
  }
}
