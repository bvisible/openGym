//// Neoffice — added file (no upstream equivalent).
////
//// Paints a layout from lib/share/layout.js onto a 2D canvas context: the member's photo cropped to fill the frame and darkened
//// where the numbers sit, or the numbers card's own ground, or nothing at all for the sticker (a rounded panel on a transparent canvas);
//// then the bars, tiles, rules, trophies, the club's logo and the text. The
//// muscle card (lib/workout-card.js) reuses drawLogo and drawTrophy so that the club's foot looks the same on every picture.
import { FONT, withAlpha, luminance } from './text.js'
import { coverRect, DEFAULT_FOCUS } from './frame.js'

// The trophy from components/Icon.jsx, on its 24×24 grid, so the picture and the app agree.
const TROPHY = [
  'M7.6 4h8.8v4.6a4.4 4.4 0 0 1-8.8 0Z',
  'M7.6 5.6H4.9v1.5a3 3 0 0 0 2.9 3M16.4 5.6h2.7v1.5a3 3 0 0 1-2.9 3M12 13v3.4M8.6 20.4h6.8l-.7-4H9.3Z',
]

export function roundRect(ctx, x, y, w, h, r) {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

export function drawTrophy(ctx, x, y, size, color) {
  ctx.save()
  ctx.translate(x, y)
  ctx.scale(size / 24, size / 24)
  ctx.strokeStyle = color
  ctx.lineWidth = 1.7
  ctx.lineCap = 'round'
  ctx.lineJoin = 'round'
  for (const d of TROPHY) ctx.stroke(new Path2D(d))
  ctx.restore()
}

/**
 * The club's logo in its square: contained, never stretched (a logo drawn out of proportion is the club's identity drawn wrong).
 * `logo` = { img, plate }: a dark logo (plate) sits on a light plate so that it does not vanish on a dark picture.
 */
export function drawLogo(ctx, item, logo) {
  if (!logo?.img) return
  const { x, y, size } = item
  const img = logo.img
  const iw = img.naturalWidth || img.width
  const ih = img.naturalHeight || img.height
  if (!iw || !ih) return
  ctx.save()
  roundRect(ctx, x, y, size, size, size * 0.22)
  ctx.fillStyle = logo.plate ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)'
  ctx.fill()
  ctx.clip()
  const inset = logo.plate ? size * 0.12 : size * 0.06
  const k = Math.min((size - inset * 2) / iw, (size - inset * 2) / ih)
  ctx.drawImage(img, x + (size - iw * k) / 2, y + (size - ih * k) / 2, iw * k, ih * k)
  ctx.restore()
}

/** Whether the logo is dark enough to need a light plate behind it: the mean brightness of its opaque pixels. */
export function logoInfo(img, doc = globalThis.document) {
  try {
    const c = doc.createElement('canvas')
    c.width = 32
    c.height = 32
    const g = c.getContext('2d', { willReadFrequently: true })   // read back right away: the browser keeps these canvases on the CPU
    g.drawImage(img, 0, 0, 32, 32)
    const { data } = g.getImageData(0, 0, 32, 32)
    let sum = 0
    let weight = 0
    for (let i = 0; i < data.length; i += 4) {
      const a = data[i + 3] / 255
      if (a < 0.2) continue
      sum += luminance([data[i], data[i + 1], data[i + 2]]) * a
      weight += a
    }
    return { img, plate: weight > 0 && sum / weight < 0.22 }
  } catch (e) {
    return { img, plate: false }
  }
}

/**
 * How bright the part of the photo under the numbers is (0 black – 1 white), to darken it just enough to read white text on it.
 * 0.4 when it cannot be read (no canvas, a photo the browser will not let us look at).
 */
export function lowerBrightness(photo, layout, focus = DEFAULT_FOCUS, doc = globalThis.document) {
  try {
    const r = coverRect(photo.width, photo.height, layout.width, layout.height, focus)
    const top = Math.max(0, Math.min(1, (layout.overlayTop - 200) / layout.height))
    const c = doc.createElement('canvas')
    c.width = 24
    c.height = 16
    const g = c.getContext('2d', { willReadFrequently: true })
    g.drawImage(photo.source, r.sx, r.sy + r.sh * top, r.sw, r.sh * (1 - top), 0, 0, 24, 16)
    const { data } = g.getImageData(0, 0, 24, 16)
    let sum = 0
    for (let i = 0; i < data.length; i += 4) sum += luminance([data[i], data[i + 1], data[i + 2]])
    return sum / (data.length / 4)
  } catch (e) {
    return 0.4
  }
}

/** The colours of the photo and numbers pictures: white on a photo or on the dark ground, the app's accent for the little that is not. */
export function paletteFor(accent) {
  return { label: '#ffffff', label2: 'rgba(255,255,255,0.76)', acc: accent || '#30d158', rule: 'rgba(255,255,255,0.26)', tile: 'rgba(255,255,255,0.09)' }
}

function drawGround(ctx, W, H, colors) {
  ctx.fillStyle = '#0c0e12'
  ctx.fillRect(0, 0, W, H)
  const glow = ctx.createRadialGradient(W * 0.9, H * 0.06, 0, W * 0.9, H * 0.06, W * 1.05)
  glow.addColorStop(0, withAlpha(colors.acc, 0.3))
  glow.addColorStop(1, withAlpha(colors.acc, 0))
  ctx.fillStyle = glow
  ctx.fillRect(0, 0, W, H)
  const low = ctx.createLinearGradient(0, H * 0.55, 0, H)
  low.addColorStop(0, 'rgba(0,0,0,0)')
  low.addColorStop(1, 'rgba(0,0,0,0.35)')
  ctx.fillStyle = low
  ctx.fillRect(0, H * 0.55, W, H * 0.45)
}

/**
 * Paint `layout`. `colors` is paletteFor(accent); `photo` = { source, width, height } (lib/media-ingest.js decodeImage) or null;
 * `focus` where the crop of the photo sits (lib/share/frame.js); `logo` = logoInfo(img) or null; `bright` the lower part's brightness
 * (lowerBrightness) — it sets how dark the veil under the numbers must be.
 */
export function drawShare(ctx, layout, { colors, photo = null, focus = DEFAULT_FOCUS, logo = null, bright = 0.4, family = FONT }) {
  const { width: W, height: H, template, items, rtl } = layout
  const onPhoto = template === 'photo' && !!photo
  if (onPhoto) {
    const r = coverRect(photo.width, photo.height, W, H, focus)
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(photo.source, r.sx, r.sy, r.sw, r.sh, 0, 0, W, H)
    // A veil that starts well above the numbers and thickens to the bottom; thicker over a bright photo.
    const alpha = Math.min(0.92, Math.max(0.7, 0.64 + 0.36 * bright))
    const top = Math.max(0, layout.overlayTop - 380)
    const veil = ctx.createLinearGradient(0, top, 0, H)
    veil.addColorStop(0, 'rgba(0,0,0,0)')
    veil.addColorStop(0.45, `rgba(0,0,0,${(alpha * 0.55).toFixed(3)})`)
    veil.addColorStop(1, `rgba(0,0,0,${alpha.toFixed(3)})`)
    ctx.fillStyle = veil
    ctx.fillRect(0, top, W, H - top)
  } else if (template === 'sticker') {
    ctx.clearRect(0, 0, W, H)
  } else {
    drawGround(ctx, W, H, colors)
  }
  ctx.textBaseline = 'alphabetic'
  ctx.direction = rtl ? 'rtl' : 'ltr'
  for (const item of items) {
    if (item.kind === 'panel') {
      // The sticker's body: dark enough to read white text on whatever it is pasted over, with a hairline so that it holds on a dark photo.
      ctx.save()
      roundRect(ctx, item.x + 1, item.y + 1, item.w - 2, item.h - 2, item.r)
      ctx.fillStyle = 'rgba(12, 14, 18, 0.88)'
      ctx.fill()
      ctx.lineWidth = 2
      ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)'
      ctx.stroke()
      ctx.restore()
    } else if (item.kind === 'bar') {
      ctx.fillStyle = colors.acc
      roundRect(ctx, Math.min(item.x, item.x + item.w), item.y, Math.abs(item.w), item.h, item.h / 2)
      ctx.fill()
    } else if (item.kind === 'tile') {
      ctx.fillStyle = colors.tile
      roundRect(ctx, item.x, item.y, item.w, item.h, 28)
      ctx.fill()
    } else if (item.kind === 'rule') {
      ctx.fillStyle = colors.rule
      ctx.fillRect(item.x, item.y, item.w, 2)
    } else if (item.kind === 'trophy') {
      drawTrophy(ctx, item.x, item.y, item.size, colors.acc)
    } else if (item.kind === 'logo') {
      drawLogo(ctx, item, logo)
    } else if (item.kind === 'text') {
      ctx.save()
      if (onPhoto) {
        ctx.shadowColor = 'rgba(0,0,0,0.5)'
        ctx.shadowBlur = 14
        ctx.shadowOffsetY = 2
      }
      ctx.textAlign = item.anchor || 'left'
      ctx.fillStyle = colors[item.color] || colors.label
      ctx.font = `${item.weight} ${item.size}px ${family}`
      ctx.fillText(item.text, item.x, item.y)
      ctx.restore()
    }
  }
}
