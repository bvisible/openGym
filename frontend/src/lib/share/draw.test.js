//// Neoffice — added file (no upstream equivalent).
//// The painting of the shared pictures (lib/share/draw.js), checked against a context that writes down what it is asked to do: the
//// photo is cropped as frame.js says, the numbers sit on a veil, the club's logo is drawn only when there is one, and nothing throws.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawShare, drawLogo, drawTrophy, logoInfo, lowerBrightness, paletteFor } from './draw.js'
import { layoutShare } from './layout.js'
import { coverRect } from './frame.js'

const measure = (text, weight, size) => String(text).length * size * 0.5
const model = {
  title: 'Push day', date: 'Thu 3 Sep',
  figures: [{ key: 'duration', label: 'Duration', value: '58 min' }],
  lines: [{ name: 'Bench press', detail: '4 × 8 · 80 kg', pr: true }],
  club: { name: 'Riverside Gym', logo: '/files/logo.png', site: 'riverside.example', info: '' },
  labels: { done: 'Session done', more: n => `+ ${n} more` },
}
const layoutOf = (template, extra = {}) => layoutShare({ ...model, ...extra }, { template, format: 'feed', measure })

function recorder() {
  const calls = []
  const state = {}
  const ctx = new Proxy(state, {
    get(target, key) {
      if (key === 'calls') return calls
      if (key in target) return target[key]
      return (...args) => {
        calls.push({ name: key, args, font: target.font, fillStyle: target.fillStyle, textAlign: target.textAlign, shadowBlur: target.shadowBlur })
        return key === 'createLinearGradient' || key === 'createRadialGradient' ? { addColorStop() {} } : undefined
      }
    },
    set(target, key, value) { target[key] = value; return true },
  })
  return ctx
}
const named = (ctx, name) => ctx.calls.filter(c => c.name === name)
const photo = { source: { tag: 'photo' }, width: 4000, height: 3000 }
const logo = { img: { naturalWidth: 200, naturalHeight: 100 }, plate: false }
const colors = paletteFor('#30d158')

beforeEach(() => { globalThis.Path2D = class { constructor(d) { this.d = d } } })
afterEach(() => { delete globalThis.Path2D })

describe('drawShare — the photo', () => {
  it('draws the member\'s photo cropped to fill the frame, first, and then a veil under the numbers', () => {
    const layout = layoutOf('photo')
    const ctx = recorder()
    const focus = { x: 0.3, y: 0.6 }
    drawShare(ctx, layout, { colors, photo, focus, logo: null, bright: 0.4 })
    const first = ctx.calls.find(c => c.name === 'drawImage')
    const r = coverRect(4000, 3000, layout.width, layout.height, focus)
    expect(first.args).toEqual([photo.source, r.sx, r.sy, r.sw, r.sh, 0, 0, layout.width, layout.height])
    expect(ctx.calls.indexOf(first)).toBe(ctx.calls.findIndex(c => ['drawImage', 'fillRect', 'fill'].includes(c.name)))
    expect(named(ctx, 'createLinearGradient')).toHaveLength(1)
  })

  it('darkens more under a bright photo than under a dark one, and never less than 70 % nor more than 92 %', () => {
    const veil = bright => {
      const ctx = recorder()
      const stops = []
      ctx.createLinearGradient = () => ({ addColorStop: (o, c) => stops.push([o, c]) })
      drawShare(ctx, layoutOf('photo'), { colors, photo, bright })
      return Number(/rgba\(0,0,0,([\d.]+)\)/.exec(stops.at(-1)[1])[1])
    }
    expect(veil(1)).toBeGreaterThan(veil(0))
    expect(veil(0)).toBeGreaterThanOrEqual(0.7)
    expect(veil(1)).toBeLessThanOrEqual(0.92)
  })

  it('puts a soft shadow behind the text on a photo and none on the plain ground', () => {
    const on = recorder()
    drawShare(on, layoutOf('photo'), { colors, photo, bright: 0.4 })
    expect(named(on, 'fillText').every(c => c.shadowBlur === 14 || c.shadowBlur === undefined)).toBe(true)
    const off = recorder()
    drawShare(off, layoutOf('numbers'), { colors, bright: 0.4 })
    expect(named(off, 'fillText').length).toBeGreaterThan(0)
  })

  it('draws no photo when the member has not added one: the dark ground instead', () => {
    const ctx = recorder()
    drawShare(ctx, layoutOf('photo'), { colors, photo: null })
    expect(named(ctx, 'drawImage')).toHaveLength(0)
    expect(named(ctx, 'fillRect')[0].args).toEqual([0, 0, 1080, 1350])
    expect(named(ctx, 'createRadialGradient')).toHaveLength(1)
  })
})

describe('drawShare — the numbers card', () => {
  it('ignores a photo it is handed: the numbers card never carries one', () => {
    const ctx = recorder()
    drawShare(ctx, layoutOf('numbers'), { colors, photo })
    expect(named(ctx, 'drawImage').filter(c => c.args[0] === photo.source)).toHaveLength(0)
  })
})

describe('drawShare — the text, the logo, the direction', () => {
  it('writes every text of the layout, in its weight and size', () => {
    const layout = layoutOf('photo')
    const ctx = recorder()
    drawShare(ctx, layout, { colors, photo })
    const written = named(ctx, 'fillText')
    const expected = layout.items.filter(i => i.kind === 'text')
    expect(written.map(c => c.args[0])).toEqual(expected.map(i => i.text))
    expected.forEach((item, i) => {
      expect(written[i].font).toMatch(new RegExp(`^${item.weight} ${item.size}px `))
      expect(written[i].args.slice(1)).toEqual([item.x, item.y])
      expect(written[i].textAlign).toBe(item.anchor)
    })
  })

  it('paints the club\'s name in white and its address in the accent', () => {
    const ctx = recorder()
    drawShare(ctx, layoutOf('photo'), { colors, photo })
    const by = text => named(ctx, 'fillText').find(c => c.args[0] === text)
    expect(by('Riverside Gym').fillStyle).toBe('#ffffff')
    expect(by('riverside.example').fillStyle).toBe('#30d158')
  })

  it('draws the logo when it has one, contained in its square and never stretched', () => {
    const ctx = recorder()
    const layout = layoutOf('photo')
    drawShare(ctx, layout, { colors, logo })
    const call = named(ctx, 'drawImage').find(c => c.args[0] === logo.img)
    expect(call).toBeTruthy()
    const [, x, y, w, h] = call.args
    expect(w / h).toBeCloseTo(2, 6)
    const item = layout.items.find(i => i.kind === 'logo')
    expect(x).toBeGreaterThanOrEqual(item.x)
    expect(x + w).toBeLessThanOrEqual(item.x + item.size + 0.001)
    expect(y).toBeGreaterThanOrEqual(item.y)
    expect(y + h).toBeLessThanOrEqual(item.y + item.size + 0.001)
  })

  it('draws no logo, and does not fail, when the logo could not be loaded', () => {
    const ctx = recorder()
    expect(() => drawShare(ctx, layoutOf('photo'), { colors, logo: null })).not.toThrow()
    expect(named(ctx, 'drawImage')).toHaveLength(0)
    drawLogo(ctx, { x: 0, y: 0, size: 80 }, { img: { naturalWidth: 0, naturalHeight: 0 } })
    expect(named(ctx, 'drawImage')).toHaveLength(0)
  })

  it('sets the direction of the text for a right-to-left language', () => {
    const rtl = recorder()
    drawShare(rtl, layoutShare(model, { template: 'photo', format: 'feed', measure, rtl: true }), { colors })
    expect(rtl.direction).toBe('rtl')
    const ltr = recorder()
    drawShare(ltr, layoutOf('photo'), { colors })
    expect(ltr.direction).toBe('ltr')
  })

  it('draws the trophy of a new best as strokes', () => {
    const ctx = recorder()
    drawTrophy(ctx, 10, 20, 48, '#fff')
    expect(named(ctx, 'stroke')).toHaveLength(2)
    expect(named(ctx, 'translate')[0].args).toEqual([10, 20])
    expect(named(ctx, 'scale')[0].args).toEqual([2, 2])
  })
})

describe('the helpers that read pixels', () => {
  const docWith = data => ({ createElement: () => ({ getContext: () => ({ drawImage() {}, getImageData: () => ({ data }) }) }) })
  const pixels = (n, [r, g, b, a]) => { const d = new Uint8ClampedArray(n * 4); for (let i = 0; i < n; i++) d.set([r, g, b, a], i * 4); return d }

  it('puts a dark logo on a light plate and a light one straight on the picture', () => {
    expect(logoInfo({ id: 'dark' }, docWith(pixels(1024, [10, 10, 10, 255]))).plate).toBe(true)
    expect(logoInfo({ id: 'light' }, docWith(pixels(1024, [240, 240, 240, 255]))).plate).toBe(false)
  })

  it('judges a logo by its opaque pixels: a transparent background does not make it dark', () => {
    const d = pixels(1024, [0, 0, 0, 0])
    for (let i = 0; i < 100; i++) d.set([250, 250, 250, 255], i * 4)
    expect(logoInfo({}, docWith(d)).plate).toBe(false)
    expect(logoInfo({}, docWith(pixels(1024, [0, 0, 0, 0]))).plate).toBe(false)
  })

  it('tells a logo that carries its own background (nothing transparent in it) from one that does not', () => {
    expect(logoInfo({ id: 'badge' }, docWith(pixels(1024, [255, 255, 255, 255]))).opaque).toBe(true)
    expect(logoInfo({ id: 'icon' }, docWith(pixels(1024, [10, 10, 10, 255]))).opaque).toBe(true)
    const half = pixels(1024, [0, 0, 0, 0])
    for (let i = 0; i < 512; i++) half.set([250, 250, 250, 255], i * 4)
    expect(logoInfo({}, docWith(half)).opaque).toBe(false)
    // A stray transparent corner or two does not make a white-backed wordmark transparent.
    const nearly = pixels(1024, [255, 255, 255, 255])
    nearly.set([0, 0, 0, 0], 0)
    expect(logoInfo({}, docWith(nearly)).opaque).toBe(true)
  })

  it('does not fail on a logo it cannot read back', () => {
    const doc = { createElement() { throw new Error('no canvas') } }
    const img = { id: 'x' }
    expect(logoInfo(img, doc)).toEqual({ img, plate: false, opaque: false })
  })

  it('reads how bright the photo is where the numbers go, 0.4 when it cannot', () => {
    const layout = layoutOf('photo')
    expect(lowerBrightness(photo, layout, undefined, docWith(pixels(384, [255, 255, 255, 255])))).toBeCloseTo(1, 5)
    expect(lowerBrightness(photo, layout, undefined, docWith(pixels(384, [0, 0, 0, 255])))).toBe(0)
    expect(lowerBrightness(photo, layout, undefined, { createElement() { throw new Error('tainted') } })).toBe(0.4)
  })

  it('builds the palette on the accent it is given and on green when it has none', () => {
    expect(paletteFor('#d68a59').acc).toBe('#d68a59')
    expect(paletteFor('').acc).toBe('#30d158')
    expect(paletteFor('#d68a59').label).toBe('#ffffff')
  })
})

describe('drawShare — the sticker', () => {
  const layout = () => layoutOf('sticker')

  it('paints a rounded panel on a transparent canvas: the frame is cleared, no ground, no photo', () => {
    const ctx = recorder()
    const l = layout()
    drawShare(ctx, l, { colors, photo, logo: null })
    expect(named(ctx, 'clearRect')[0].args).toEqual([0, 0, l.width, l.height])
    expect(named(ctx, 'createRadialGradient')).toHaveLength(0)
    expect(named(ctx, 'createLinearGradient')).toHaveLength(0)
    expect(named(ctx, 'drawImage').filter(c => c.args[0] === photo.source)).toHaveLength(0)
    expect(named(ctx, 'fillRect').filter(c => c.args[2] === l.width && c.args[3] === l.height)).toHaveLength(0)
  })

  it('fills the panel with a dark, almost opaque colour and outlines it', () => {
    const ctx = recorder()
    drawShare(ctx, layout(), { colors })
    const fills = named(ctx, 'fill')
    expect(fills[0].fillStyle).toMatch(/^rgba\(12, 14, 18, 0\.[789]/)
    expect(named(ctx, 'stroke').length).toBeGreaterThan(0)
    expect(named(ctx, 'arcTo').length).toBeGreaterThanOrEqual(4)
  })

  it('writes the same texts as the layout says, with no shadow behind them', () => {
    const ctx = recorder()
    const l = layout()
    drawShare(ctx, l, { colors, photo })
    const written = named(ctx, 'fillText')
    expect(written.map(c => c.args[0])).toEqual(l.items.filter(i => i.kind === 'text').map(i => i.text))
    expect(written.every(c => !c.shadowBlur)).toBe(true)
  })
})

describe('drawLogo — a wordmark in its own shape', () => {
  const wide = { img: { naturalWidth: 1400, naturalHeight: 298 } }

  it('fills a wide box edge to edge, clipped to its rounded corners, when the logo carries its own background', () => {
    const ctx = recorder()
    drawLogo(ctx, { x: 64, y: 100, w: 338, h: 72 }, { ...wide, opaque: true })
    const call = named(ctx, 'drawImage')[0]
    const [, x, y, w, h] = call.args
    // Filled to the box: a box of the logo's own shape crops a fraction of a pixel at most.
    expect(x).toBeCloseTo(64, 0)
    expect(y).toBeCloseTo(100, 0)
    expect(w).toBeCloseTo(338, 0)
    expect(h).toBeCloseTo(72, 0)
    expect(w / h).toBeCloseTo(1400 / 298, 1)
    expect(named(ctx, 'clip')).toHaveLength(1)
    expect(named(ctx, 'fill')).toHaveLength(0)   // the logo is its own plate: nothing painted behind it
  })

  it('draws a transparent wordmark inside its box, never stretched, on the faint plate (or the light one when it is dark)', () => {
    for (const plate of [false, true]) {
      const ctx = recorder()
      drawLogo(ctx, { x: 0, y: 0, w: 340, h: 72 }, { ...wide, opaque: false, plate })
      const [, x, y, w, h] = named(ctx, 'drawImage')[0].args
      expect(w / h).toBeCloseTo(1400 / 298, 3)
      expect(x).toBeGreaterThanOrEqual(0)
      expect(x + w).toBeLessThanOrEqual(340 + 1e-6)
      expect(y + h).toBeLessThanOrEqual(72 + 1e-6)
      expect(named(ctx, 'fill')[0].fillStyle).toBe(plate ? 'rgba(255,255,255,0.95)' : 'rgba(255,255,255,0.08)')
    }
  })

  it('still reads a square item written with `size` alone', () => {
    const ctx = recorder()
    drawLogo(ctx, { x: 10, y: 20, size: 80 }, { img: { naturalWidth: 200, naturalHeight: 100 }, opaque: false })
    const [, , , w, h] = named(ctx, 'drawImage')[0].args
    expect(w / h).toBeCloseTo(2, 6)
    expect(w).toBeLessThanOrEqual(80)
  })

  it('draws nothing for a box that has no size', () => {
    const ctx = recorder()
    drawLogo(ctx, { x: 0, y: 0, w: 0, h: 72 }, { ...wide, opaque: true })
    expect(named(ctx, 'drawImage')).toHaveLength(0)
  })
})
