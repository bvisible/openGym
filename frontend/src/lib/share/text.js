//// Neoffice — added file (no upstream equivalent).
////
//// The small text and colour helpers of the pictures a member shares (lib/share/). No import on purpose: the layout and the drawing
//// built on them load in a test, in a page that only draws, anywhere, without the app's catalogue behind them.

export const FONT = "-apple-system,BlinkMacSystemFont,'SF Pro Text','Segoe UI',Roboto,system-ui,sans-serif"

function ellipsize(text, width, measure) {
  let s = text
  while (s && measure(s + '…') > width) s = s.slice(0, -1)
  return s.trimEnd() + '…'
}

/**
 * Greedy word wrap to `max` lines; the last line that does not fit is cut with an ellipsis. A word wider than the line on its own (a
 * long German compound) is cut too, never overflowed. Same rule as the muscle card's (lib/workout-card.js wrapText).
 */
export function wrapText(text, width, measure, max) {
  const words = String(text || '').split(/\s+/).filter(Boolean)
  const lines = []
  let line = ''
  for (let i = 0; i < words.length; i++) {
    const next = line ? line + ' ' + words[i] : words[i]
    if (measure(next) <= width) { line = next; continue }
    if (line) lines.push(line)
    line = words[i]
    if (lines.length === max) break
  }
  if (line && lines.length < max) lines.push(line)
  const rest = lines.join(' ').length < words.join(' ').length
  return lines.map((l, i) => (i === lines.length - 1 && (rest || measure(l) > width) ? ellipsize(l, width, measure) : l))
}

/** `text` on ONE line of at most `width`, cut with an ellipsis when it is longer; '' for nothing. */
export function oneLine(text, width, measure) {
  return wrapText(text, width, measure, 1)[0] || ''
}

/** The largest size up to `max` (never under `min`) at which `text` fits `width`. `measure(text, weight, size)`. */
export function fitSize(text, width, measure, weight, max, min = 28) {
  let size = max
  while (size > min && measure(text, weight, size) > width) size -= 2
  return size
}

/** "#rgb", "#rrggbb", "rgb(…)" or "rgba(…)" as [r, g, b, a]; null for anything else. */
export function parseColor(value) {
  const s = String(value || '').trim()
  let m = s.match(/^#([0-9a-f]{3,8})$/i)
  if (m) {
    let h = m[1]
    if (h.length === 3 || h.length === 4) h = [...h].map(c => c + c).join('')
    if (h.length !== 6 && h.length !== 8) return null
    const n = i => parseInt(h.slice(i, i + 2), 16)
    return [n(0), n(2), n(4), h.length === 8 ? n(6) / 255 : 1]
  }
  m = s.match(/^rgba?\(([^)]+)\)$/i)
  if (!m) return null
  const parts = m[1].split(/[\s,/]+/).filter(Boolean).map(p => (p.endsWith('%') ? parseFloat(p) / 100 : parseFloat(p)))
  if (parts.length < 3 || parts.some(Number.isNaN)) return null
  return [parts[0], parts[1], parts[2], parts.length > 3 ? parts[3] : 1]
}

/** `color` with the opacity `alpha` (0–1), as an rgba() string; `fallback` when the colour cannot be read. */
export function withAlpha(color, alpha, fallback = `rgba(255,255,255,${alpha})`) {
  const c = parseColor(color)
  return c ? `rgba(${Math.round(c[0])}, ${Math.round(c[1])}, ${Math.round(c[2])}, ${alpha})` : fallback
}

/** Relative luminance (0 black – 1 white) of an [r, g, b] colour, the way WCAG reads it. */
export function luminance([r, g, b]) {
  const lin = v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 }
  return 0.2126 * lin(r) + 0.7152 * lin(g) + 0.0722 * lin(b)
}
