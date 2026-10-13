//// Neoffice — added file (no upstream equivalent).
////
//// The foot of every picture a member shares — the muscle card, the numbers card, the photo: the club's logo, its name, its address
//// on the web and one line of information (a street, a phone, a social account). Asked for on 13.10: the picture a member posts is
//// the club's advertisement, and an advertisement without the address does nothing. Pure layout: it gets a way to measure text and
//// returns what to draw; the drawing is lib/share/draw.js (and the muscle card's own, lib/workout-card.js).
import { oneLine } from './text.js'

/** The logo's square, in px on a 1 080 px picture. */
export const FOOT_LOGO = 80
const GAP = 24

const clean = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/**
 * `club` = { name, logo, site, info }, each possibly empty. Returns `{ height, items(top) }`: the block's height (0 when the club
 * says nothing at all, the picture then has no foot) and the items to draw with the block's top edge at `top`.
 *
 * The three lines are the name (bold), the address (in the accent: it is what the reader should act on) and the information (dim).
 * Each is cut to one line. The logo sits at the start edge, centred against the lines; in a right-to-left language the whole block
 * mirrors.
 */
export function footLayout({ club, width, pad, measure, rtl = false }) {
  const name = clean(club?.name)
  const site = clean(club?.site)
  const info = clean(club?.info)
  const logo = typeof club?.logo === 'string' && club.logo.trim() !== ''
  if (!name && !site && !info && !logo) return { height: 0, items: () => [] }
  const inner = width - pad * 2
  const dir = rtl ? -1 : 1
  const start = rtl ? width - pad : pad
  const shift = logo ? FOOT_LOGO + GAP : 0
  const room = inner - shift
  const lines = []
  if (name) lines.push({ text: oneLine(name, room, s => measure(s, 700, 36)), size: 36, weight: 700, color: 'label' })
  if (site) lines.push({ text: oneLine(site, room, s => measure(s, 600, 30)), size: 30, weight: 600, color: 'acc' })
  if (info) lines.push({ text: oneLine(info, room, s => measure(s, 400, 28)), size: 28, weight: 400, color: 'label2' })
  const lineH = l => Math.round(l.size * 1.3)
  const textH = lines.reduce((n, l) => n + lineH(l), 0)
  const height = Math.max(logo ? FOOT_LOGO : 0, textH)
  const items = top => {
    const out = []
    if (logo) out.push({ kind: 'logo', x: rtl ? start - FOOT_LOGO : start, y: top + (height - FOOT_LOGO) / 2, size: FOOT_LOGO })
    let y = top + (height - textH) / 2
    for (const l of lines) {
      out.push({ kind: 'text', text: l.text, x: start + shift * dir, y: y + l.size, size: l.size, weight: l.weight, color: l.color, anchor: rtl ? 'right' : 'left' })
      y += lineH(l)
    }
    return out
  }
  return { height, items }
}
