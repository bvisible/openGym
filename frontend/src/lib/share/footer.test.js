//// Neoffice — added file (no upstream equivalent).
//// The foot every shared picture carries: the club's logo, name, address and one line of information (lib/share/footer.js).
import { describe, expect, it } from 'vitest'
import { footLayout, FOOT_LOGO, WIDE_LOGO } from './footer.js'

const measure = (text, weight, size) => String(text).length * size * 0.5
const W = 1080
const PAD = 64
const foot = (club, extra = {}) => footLayout({ club, width: W, pad: PAD, measure, ...extra })
const club = { name: 'Riverside Gym', logo: '/files/logo.png', site: 'riverside.example', info: 'Rue du Lac 4 · 021 555 01 02' }
const texts = items => items.filter(i => i.kind === 'text')

describe('footLayout', () => {
  it('has no height, so no foot at all, when the club says nothing', () => {
    for (const c of [undefined, null, {}, { name: '', logo: '', site: '', info: '' }, { name: '  ', site: '\n' }]) {
      const f = foot(c)
      expect(f.height).toBe(0)
      expect(f.items(500)).toEqual([])
    }
  })

  it('is the logo and three lines — name, address, information — in that order', () => {
    const f = foot(club)
    const items = f.items(1000)
    expect(items.filter(i => i.kind === 'logo')).toHaveLength(1)
    expect(texts(items).map(i => i.text)).toEqual(['Riverside Gym', 'riverside.example', 'Rue du Lac 4 · 021 555 01 02'])
    expect(texts(items).map(i => i.color)).toEqual(['label', 'acc', 'label2'])
    const ys = texts(items).map(i => i.y)
    expect(ys[0]).toBeLessThan(ys[1])
    expect(ys[1]).toBeLessThan(ys[2])
  })

  it('puts the logo at the start edge and the lines beside it', () => {
    const items = foot(club).items(1000)
    const logo = items.find(i => i.kind === 'logo')
    expect(logo).toMatchObject({ x: PAD, size: FOOT_LOGO })
    for (const t of texts(items)) { expect(t.x).toBeGreaterThan(logo.x + FOOT_LOGO); expect(t.anchor).toBe('left') }
  })

  it('starts the lines at the margin when there is no logo, and leaves no hole for it', () => {
    const items = foot({ ...club, logo: '' }).items(1000)
    expect(items.some(i => i.kind === 'logo')).toBe(false)
    expect(texts(items)[0].x).toBe(PAD)
  })

  it('keeps the whole block within its own height, the logo centred against the lines', () => {
    const f = foot(club)
    const items = f.items(1000)
    const logo = items.find(i => i.kind === 'logo')
    expect(logo.y).toBeGreaterThanOrEqual(1000 - 0.5)
    expect(logo.y + logo.size).toBeLessThanOrEqual(1000 + f.height + 0.5)
    expect(f.height).toBeGreaterThanOrEqual(FOOT_LOGO)
    for (const t of texts(items)) expect(t.y).toBeLessThanOrEqual(1000 + f.height + 0.5)
  })

  it('is as tall as its lines when it has no logo and as the logo when the lines are shorter', () => {
    expect(foot({ name: 'Riverside Gym' }).height).toBeLessThan(FOOT_LOGO)
    expect(foot({ name: 'Riverside Gym', logo: '/x.png' }).height).toBe(FOOT_LOGO)
    expect(foot({ logo: '/x.png' }).height).toBe(FOOT_LOGO)
  })

  it('drops a line the club did not fill instead of leaving a blank one', () => {
    const f = foot({ name: 'Riverside Gym', logo: '', site: '', info: '' })
    expect(texts(f.items(0)).map(i => i.text)).toEqual(['Riverside Gym'])
    const g = foot({ name: 'Riverside Gym', site: 'riverside.example' })
    expect(g.height).toBeGreaterThan(f.height)
  })

  it('tidies the text it is given: one line, single spaces', () => {
    const items = foot({ name: ' Riverside \n  Gym ', site: 'riverside.example\t' }).items(0)
    expect(texts(items).map(i => i.text)).toEqual(['Riverside Gym', 'riverside.example'])
  })

  it('cuts a line that is too long for its room, with an ellipsis, and keeps it inside the margins', () => {
    const long = 'A fitness and physical preparation centre whose name is far too long for a single line of the picture'
    const items = foot({ ...club, name: long }).items(0)
    const name = texts(items)[0]
    expect(name.text.endsWith('…')).toBe(true)
    expect(name.x + measure(name.text, name.weight, name.size)).toBeLessThanOrEqual(W - PAD + 0.5)
  })

  it('mirrors in a right-to-left language: the logo on the right, the lines to its left, aligned right', () => {
    const items = foot(club, { rtl: true }).items(0)
    const logo = items.find(i => i.kind === 'logo')
    expect(logo.x + logo.size).toBe(W - PAD)
    for (const t of texts(items)) {
      expect(t.anchor).toBe('right')
      expect(t.x).toBeLessThan(logo.x)
    }
  })
})

describe('footLayout — a wordmark', () => {
  const wordmark = { ...club, logoAspect: 1400 / 298 }
  const logoOf = items => items.find(i => i.kind === 'logo')

  it('keeps a logo wider than tall in its own proportions, 72 px tall, and does not write the name beside it', () => {
    const items = foot(wordmark).items(1000)
    const logo = logoOf(items)
    expect(logo.h).toBe(72)
    expect(logo.w).toBe(Math.round(72 * 1400 / 298))
    expect(logo.w / logo.h).toBeCloseTo(1400 / 298, 1)
    expect(logo.x).toBe(PAD)
    // The logotype says « Riverside Gym » already: the lines are the address and the information.
    expect(texts(items).map(i => i.text)).toEqual(['riverside.example', 'Rue du Lac 4 · 021 555 01 02'])
    expect(texts(items).map(i => i.color)).toEqual(['acc', 'label2'])
  })

  it('puts the lines beside the logo, with the room that is left', () => {
    const items = foot(wordmark).items(0)
    const logo = logoOf(items)
    for (const t of texts(items)) {
      expect(t.x).toBeGreaterThan(logo.x + logo.w)
      expect(t.x + measure(t.text, t.weight, t.size)).toBeLessThanOrEqual(W - PAD + 0.5)
    }
    const long = foot({ ...wordmark, info: 'x'.repeat(200) }).items(0)
    const info = texts(long).at(-1)
    expect(info.text.endsWith('…')).toBe(true)
    expect(info.x + measure(info.text, info.weight, info.size)).toBeLessThanOrEqual(W - PAD + 0.5)
  })

  it('is as tall as the taller of the logo and its lines, and only the logo when it has no line to go with', () => {
    const f = foot(wordmark)
    expect(f.height).toBeGreaterThanOrEqual(72)
    expect(f.height).toBeLessThan(FOOT_LOGO + 10)
    const alone = foot({ name: 'Riverside Gym', logo: '/x.png', logoAspect: 4.7 })
    expect(alone.height).toBe(72)
    expect(texts(alone.items(0))).toEqual([])
  })

  it('limits the width of an extremely wide strip, and so its height', () => {
    const strip = logoOf(foot({ ...wordmark, logoAspect: 10 }).items(0))
    expect(strip.w).toBeLessThanOrEqual(340)
    expect(strip.h).toBe(34)
  })

  it('reads a logo as a wordmark from 1.8 on, and as an icon below, or when the proportions are unknown', () => {
    expect(WIDE_LOGO).toBe(1.8)
    expect(logoOf(foot({ ...club, logoAspect: 1.8 }).items(0)).w).toBeGreaterThan(FOOT_LOGO)
    for (const aspect of [1.79, 1, 0.5, undefined, NaN, null, 0, -3]) {
      const logo = logoOf(foot({ ...club, logoAspect: aspect }).items(0))
      expect(logo.w, String(aspect)).toBe(FOOT_LOGO)
      expect(logo.h, String(aspect)).toBe(FOOT_LOGO)
    }
    // An icon keeps the name next to it.
    expect(texts(foot({ ...club, logoAspect: 1 }).items(0)).map(i => i.text)).toContain('Riverside Gym')
  })

  it('mirrors in a right-to-left language: the logo on the right, its lines to its left, aligned right', () => {
    const items = foot(wordmark, { rtl: true }).items(0)
    const logo = logoOf(items)
    expect(logo.x + logo.w).toBe(W - PAD)
    for (const t of texts(items)) { expect(t.anchor).toBe('right'); expect(t.x).toBeLessThan(logo.x) }
  })

  it('carries the box under both names, so that an older drawing reading `size` still works', () => {
    const logo = logoOf(foot(wordmark).items(0))
    expect(logo.size).toBe(logo.h)
  })
})
