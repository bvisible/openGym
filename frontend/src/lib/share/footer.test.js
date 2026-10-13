//// Neoffice — added file (no upstream equivalent).
//// The foot every shared picture carries: the club's logo, name, address and one line of information (lib/share/footer.js).
import { describe, expect, it } from 'vitest'
import { footLayout, FOOT_LOGO } from './footer.js'

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
