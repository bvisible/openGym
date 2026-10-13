//// Neoffice — added file (no upstream equivalent).
////
//// Where everything goes on the picture a member shares of a finished workout: the PHOTO (their own photo, the numbers laid over its
//// lower part) and the NUMBERS card (no photo, big figures on a dark ground). Pure — a way to measure text goes in, a flat list of
//// items comes out for lib/share/draw.js — so the part that decides what fits is tested without a canvas, the way lib/workout-card.js
//// is. The same blocks serve both templates; only the sizes and the anchoring differ (the photo's numbers sit at the bottom, over
//// the photo; the numbers card starts at the top).
import { wrapText, oneLine, fitSize } from './text.js'
import { footLayout } from './footer.js'

export const FORMATS = Object.freeze({
  feed: Object.freeze({ width: 1080, height: 1350 }),   // 4:5, the tallest a feed shows without cropping
  story: Object.freeze({ width: 1080, height: 1920 }),  // 9:16
})
export const PAD = 64

const SIZES = {
  photo: { eyebrow: 28, title: 66, figure: 84, label: 24, name: 34, detail: 32, row: 58, more: 28, icon: 30 },
  numbers: { eyebrow: 36, title: 96, date: 34, figure: 88, label: 26, name: 42, detail: 40, row: 76, more: 32, icon: 38 },
}
// The share of the picture the photo's numbers may cover: the rest stays the member's.
const OVERLAY_SHARE = { feed: 0.6, story: 0.62 }
// A story hides the top and the bottom of the picture behind the app's own bars (the profile line, the reply field): what must be
// read stays out of those bands.
const INSET = { feed: { top: PAD, bottom: PAD }, story: { top: 220, bottom: 280 } }
const RULE = 2

/**
 * `model` = { title, date, figures: [{ label, value }], lines: [{ name, detail, pr }], club: { name, logo, site, info },
 * labels: { done, more(n) } } (lib/share/model.js). `measure(text, weight, size)` returns a width in px — the canvas's measureText
 * in the app, a fake in the tests. Returns { template, format, width, height, rtl, items, overlayTop, shown, hidden }: `shown` of
 * the exercise lines fit, the `hidden` others are counted in a last line; `overlayTop` is where the photo's numbers begin (the
 * drawing darkens the photo from a little above it).
 */
export function layoutShare(model, { template = 'photo', format = 'feed', measure, rtl = false }) {
  const tiles = template === 'numbers'
  const z = SIZES[tiles ? 'numbers' : 'photo']
  const { width: W, height: H } = FORMATS[format] || FORMATS.feed
  const inner = W - PAD * 2
  const startX = rtl ? W - PAD : PAD
  const aStart = rtl ? 'right' : 'left'
  const aEnd = rtl ? 'left' : 'right'
  const figures = model.figures || []
  const lines = model.lines || []
  const foot = footLayout({ club: model.club, width: W, pad: PAD, measure, rtl })
  const footH = foot.height ? RULE + 26 + foot.height : 0
  const gapToFoot = foot.height ? 30 : 0

  // The blocks above the foot, for `n` exercise lines. Each has a height and a function that returns its items given its top edge.
  const compose = n => {
    const parts = []
    const add = (h, put) => parts.push({ h, put })
    const gap = h => add(h, () => [])

    add(10, y => [{ kind: 'bar', x: rtl ? startX - 96 : startX, y, w: 96, h: 10 }])
    gap(26)
    const eyebrow = tiles ? model.labels.done : model.date
    if (eyebrow) {
      add(Math.round(z.eyebrow * 1.4), y => [{ kind: 'text', text: oneLine(eyebrow.toLocaleUpperCase(), inner, s => measure(s, 700, z.eyebrow)), x: startX, y: y + z.eyebrow, size: z.eyebrow, weight: 700, color: tiles ? 'acc' : 'label2', anchor: aStart }])
    }
    const titleText = model.title || (tiles ? '' : model.labels.done)
    // A long session name shrinks (down to 60 % of its size) before it is cut, then is cut at two lines.
    let titleSize = z.title
    let titleLines = titleText ? wrapText(titleText, inner, s => measure(s, 800, titleSize), 2) : []
    while (titleSize > z.title * 0.6 && titleLines.length && titleLines.at(-1).endsWith('…') && !titleText.endsWith('…')) {
      titleSize -= 4
      titleLines = wrapText(titleText, inner, s => measure(s, 800, titleSize), 2)
    }
    const titleLH = Math.round(titleSize * 1.12)
    if (titleLines.length) add(titleLH * titleLines.length, y => titleLines.map((text, i) => ({ kind: 'text', text, x: startX, y: y + i * titleLH + titleSize * 0.9, size: titleSize, weight: 800, color: 'label', anchor: aStart })))
    if (tiles && model.date) add(Math.round(z.date * 1.5), y => [{ kind: 'text', text: model.date, x: startX, y: y + z.date * 1.1, size: z.date, weight: 500, color: 'label2', anchor: aStart }])
    gap(28)

    if (figures.length && !tiles) {
      // Left to right, the first at the start edge and the last at the end edge, equal gaps between: columns of equal width would
      // leave a short figure next to a long one with a wide gap on one side and none on the other.
      const widths = f => Math.max(measure(f.value, 800, size0), measure(f.label.toLocaleUpperCase(), 600, z.label))
      let size0 = z.figure
      while (size0 > 40 && figures.reduce((n, f) => n + widths(f), 0) + 40 * (figures.length - 1) > inner) size0 -= 2
      const ws = figures.map(widths)
      const gapF = figures.length > 1 ? (inner - ws.reduce((a, b) => a + b, 0)) / (figures.length - 1) : 0
      add(size0 + 8 + Math.round(z.label * 1.3), y => {
        let off = 0
        return figures.flatMap((f, i) => {
          const x = rtl ? W - PAD - off : PAD + off
          off += ws[i] + gapF
          return [
            { kind: 'text', text: f.value, x, y: y + size0 * 0.92, size: size0, weight: 800, color: 'label', anchor: aStart },
            { kind: 'text', text: f.label.toLocaleUpperCase(), x, y: y + size0 + 8 + z.label, size: z.label, weight: 600, color: 'label2', anchor: aStart },
          ]
        })
      })
      gap(26)
    } else if (figures.length) {
      const cols = figures.length <= 3 ? figures.length : 2
      const rows = Math.ceil(figures.length / cols)
      const g = 18
      const tw = (inner - g * (cols - 1)) / cols
      const th = 168
      const room = tw - 56
      const size = Math.min(...figures.map(f => fitSize(f.value, room, measure, 800, z.figure, 36)))
      add(rows * th + (rows - 1) * g, y => figures.flatMap((f, i) => {
        const r = Math.floor(i / cols)
        const c = i % cols
        const x = rtl ? W - PAD - (c + 1) * tw - c * g : PAD + c * (tw + g)
        const ty = y + r * (th + g)
        const tx = rtl ? x + tw - 28 : x + 28
        return [
          { kind: 'tile', x, y: ty, w: tw, h: th },
          { kind: 'text', text: oneLine(f.label.toLocaleUpperCase(), room, s => measure(s, 600, z.label)), x: tx, y: ty + 26 + z.label, size: z.label, weight: 600, color: 'label2', anchor: aStart },
          { kind: 'text', text: f.value, x: tx, y: ty + th - 28, size, weight: 800, color: 'label', anchor: aStart },
        ]
      }))
      gap(36)
    }

    const shown = lines.slice(0, n)
    if (shown.length) {
      add(RULE, y => [{ kind: 'rule', x: PAD, y, w: inner }])
      gap(12)
      for (const row of shown) {
        add(z.row, y => {
          const out = []
          const maxDetail = inner * 0.58
          const detail = row.detail ? oneLine(row.detail, maxDetail, s => measure(s, 600, z.detail)) : ''
          const detailW = detail ? measure(detail, 600, z.detail) : 0
          const iconW = row.pr ? z.icon + 14 : 0
          const nameRoom = inner - detailW - (detail ? 28 : 0) - iconW
          const nameSize = fitSize(row.name, nameRoom, measure, 600, z.name, 26)
          const name = oneLine(row.name, nameRoom, s => measure(s, 600, nameSize))
          const nameW = measure(name, 600, nameSize)
          const base = y + z.row / 2 + nameSize * 0.36
          out.push({ kind: 'text', text: name, x: startX, y: base, size: nameSize, weight: 600, color: 'label', anchor: aStart })
          if (row.pr) out.push({ kind: 'trophy', x: rtl ? startX - nameW - 14 - z.icon : startX + nameW + 14, y: y + (z.row - z.icon) / 2, size: z.icon })
          if (detail) out.push({ kind: 'text', text: detail, x: rtl ? PAD : W - PAD, y: y + z.row / 2 + z.detail * 0.36, size: z.detail, weight: 600, color: 'label2', anchor: aEnd })
          return out
        })
      }
      const hidden = lines.length - shown.length
      if (hidden > 0) add(Math.round(z.more * 1.8), y => [{ kind: 'text', text: model.labels.more(hidden), x: startX, y: y + z.more * 1.15, size: z.more, weight: 500, color: 'label2', anchor: aStart }])
    }
    return { parts, height: parts.reduce((s, p) => s + p.h, 0) }
  }

  // The most exercise lines that still fit the room: the photo's numbers may cover part of it, the numbers card the whole of it
  // between its top and its foot.
  const inset = INSET[format] || INSET.feed
  const room = tiles
    ? H - inset.top - inset.bottom - footH - gapToFoot - 24
    : Math.round(H * (OVERLAY_SHARE[format] || OVERLAY_SHARE.feed)) - (inset.bottom - PAD) - footH - gapToFoot
  let n = lines.length
  let built = compose(n)
  while (n > 0 && built.height > room) built = compose(--n)

  const contentTop = tiles ? inset.top + 24 + Math.round(Math.max(0, room - built.height) * 0.3) : H - inset.bottom - footH - gapToFoot - built.height
  const items = []
  let y = contentTop
  for (const p of built.parts) { items.push(...p.put(y)); y += p.h }
  if (foot.height) {
    const footTop = H - inset.bottom - footH
    items.push({ kind: 'rule', x: PAD, y: footTop, w: inner })
    items.push(...foot.items(footTop + RULE + 26))
  }
  return { template: tiles ? 'numbers' : 'photo', format: FORMATS[format] ? format : 'feed', width: W, height: H, rtl, items, overlayTop: contentTop, shown: n, hidden: lines.length - n }
}
