//// Neoffice — added file (no upstream equivalent).
//// Where everything goes on the picture a member shares (lib/share/layout.js): checked without a canvas, with a fake measure in which
//// every character is half its font size wide.
import { describe, expect, it } from 'vitest'
import { layoutShare, FORMATS, PAD, STICKER } from './layout.js'

const measure = (text, weight, size) => String(text).length * size * 0.5
const lines = n => Array.from({ length: n }, (_, i) => ({ name: `Exercise number ${i + 1}`, detail: '4 × 8 · 80 kg', pr: i === 0 }))
const figures = [
  { key: 'duration', label: 'Duration', value: '58 min' },
  { key: 'sets', label: 'Sets', value: '18' },
  { key: 'volume', label: 'Weight moved', value: '4,310 kg' },
]
const model = (over = {}) => ({
  title: 'Push day', date: 'Thu 3 Sep', figures, lines: lines(6), recordCount: 1,
  club: { name: 'Riverside Gym', logo: '', site: 'riverside.example', info: '' },
  labels: { done: 'Session done', more: n => `+ ${n} more` },
  ...over,
})
const run = (over, opts = {}) => layoutShare(model(over), { measure, ...opts })
const texts = layout => layout.items.filter(i => i.kind === 'text')
const width = i => measure(i.text, i.weight, i.size)
const WH = format => FORMATS[format]
const combos = [['photo', 'feed'], ['photo', 'story'], ['numbers', 'feed'], ['numbers', 'story']]

describe('layoutShare — the frame', () => {
  it('is 1080 × 1350 for the feed and 1080 × 1920 for the story, and the feed when the shape is unknown', () => {
    expect(run({}, { format: 'feed' })).toMatchObject({ width: 1080, height: 1350, format: 'feed' })
    expect(run({}, { format: 'story' })).toMatchObject({ width: 1080, height: 1920, format: 'story' })
    expect(run({}, { format: 'cinema' })).toMatchObject({ width: 1080, height: 1350, format: 'feed' })
  })

  it('is deterministic: the same model gives the same layout', () => {
    expect(run({}, { template: 'photo' })).toEqual(run({}, { template: 'photo' }))
  })
})

describe.each(combos)('layoutShare — %s on the %s', (template, format) => {
  const { width: W, height: H } = WH(format)
  const side = { feed: { top: PAD, bottom: PAD }, story: { top: 220, bottom: 280 } }[format]

  it('keeps every text between the side margins, left- and right-aligned alike', () => {
    for (const rtl of [false, true]) {
      for (const t of texts(run({ lines: lines(30) }, { template, format, rtl }))) {
        const w = width(t)
        const [from, to] = t.anchor === 'right' ? [t.x - w, t.x] : [t.x, t.x + w]
        expect(from).toBeGreaterThanOrEqual(PAD - 0.5)
        expect(to).toBeLessThanOrEqual(W - PAD + 0.5)
      }
    }
  })

  it('keeps every text inside the picture, and inside the bands the story leaves free', () => {
    for (const t of texts(run({ lines: lines(30) }, { template, format }))) {
      expect(t.y).toBeGreaterThan(side.top)
      expect(t.y).toBeLessThanOrEqual(H - side.bottom + 0.5)
    }
  })

  it('writes the session\'s name and, with a foot, the club\'s name and address', () => {
    const t = texts(run({}, { template, format })).map(i => i.text)
    expect(t).toContain('Push day')
    expect(t).toContain('Riverside Gym')
    expect(t).toContain('riverside.example')
  })

  it('ends on the foot, whose bottom edge is the picture\'s bottom margin', () => {
    const layout = run({}, { template, format })
    const footTexts = texts(layout).filter(i => i.text === 'riverside.example' || i.text === 'Riverside Gym')
    const lowest = Math.max(...footTexts.map(i => i.y))
    expect(lowest).toBeLessThanOrEqual(H - side.bottom)
    expect(lowest).toBeGreaterThan(H - side.bottom - 160)
    // The rule above the foot is the lowest rule of the picture.
    const rules = layout.items.filter(i => i.kind === 'rule')
    expect(Math.max(...rules.map(r => r.y))).toBeLessThan(lowest)
  })

  it('has no foot at all when the club says nothing: no logo, no club text, no rule that closes nothing', () => {
    const none = run({ club: { name: '', logo: '', site: '', info: '' }, lines: [] }, { template, format })
    expect(none.items.some(i => i.kind === 'logo')).toBe(false)
    expect(none.items.filter(i => i.kind === 'rule')).toHaveLength(0)
    expect(texts(none).map(i => i.text)).not.toContain('Riverside Gym')
  })

  it('draws the club\'s logo in the foot when it has one', () => {
    const withLogo = run({ club: { name: 'Riverside Gym', logo: '/files/logo.png', site: '', info: '' } }, { template, format })
    const logo = withLogo.items.find(i => i.kind === 'logo')
    expect(logo).toBeTruthy()
    expect(logo.x).toBe(PAD)
    expect(logo.y + logo.size).toBeLessThanOrEqual(H - side.bottom + 0.5)
  })

  it('shows the most exercise lines that fit and counts the rest in a last line', () => {
    const many = run({ lines: lines(40) }, { template, format })
    expect(many.shown).toBeGreaterThan(0)
    expect(many.shown).toBeLessThan(40)
    expect(many.hidden).toBe(40 - many.shown)
    expect(texts(many).map(i => i.text)).toContain(`+ ${many.hidden} more`)
    const few = run({ lines: lines(3) }, { template, format })
    expect(few).toMatchObject({ shown: 3, hidden: 0 })
    expect(texts(few).some(i => /^\+ \d+ more$/.test(i.text))).toBe(false)
  })

  it('puts a trophy after the name of a line that is a new best, and after no other', () => {
    const layout = run({ lines: lines(4) }, { template, format })
    expect(layout.items.filter(i => i.kind === 'trophy')).toHaveLength(1)
    const name = texts(layout).find(i => i.text === 'Exercise number 1')
    const trophy = layout.items.find(i => i.kind === 'trophy')
    expect(trophy.x).toBeCloseTo(name.x + width(name) + 14, 5)
  })

  it('writes each exercise\'s numbers at the end edge, on the name\'s row', () => {
    const layout = run({ lines: lines(2) }, { template, format })
    const detail = texts(layout).filter(i => i.text === '4 × 8 · 80 kg')
    expect(detail).toHaveLength(2)
    for (const d of detail) { expect(d.anchor).toBe('right'); expect(d.x).toBe(W - PAD) }
    const name = texts(layout).find(i => i.text === 'Exercise number 1')
    expect(Math.abs(detail[0].y - name.y)).toBeLessThan(name.size)
  })

  it('lists the exercises in order, each below the last', () => {
    const names = texts(run({ lines: lines(5) }, { template, format })).filter(i => /^Exercise number/.test(i.text))
    expect(names.map(i => i.text)).toEqual([1, 2, 3, 4, 5].map(n => `Exercise number ${n}`))
    for (let i = 1; i < names.length; i++) expect(names[i].y).toBeGreaterThan(names[i - 1].y)
  })

  it('mirrors in a right-to-left language: the start edge is the right one', () => {
    const rtl = run({ lines: lines(3) }, { template, format, rtl: true })
    expect(rtl.rtl).toBe(true)
    expect(texts(rtl).find(i => i.text === 'Push day')).toMatchObject({ x: W - PAD, anchor: 'right' })
    expect(texts(rtl).find(i => i.text === '4 × 8 · 80 kg')).toMatchObject({ x: PAD, anchor: 'left' })
    expect(rtl.items.find(i => i.kind === 'bar').x).toBe(W - PAD - 96)
    const trophy = rtl.items.find(i => i.kind === 'trophy')
    const name = texts(rtl).find(i => i.text === 'Exercise number 1')
    expect(trophy.x + trophy.size).toBeLessThanOrEqual(name.x - width(name) + 0.5)
  })

  it('says nothing about a figure that was not ticked, and has no band for none', () => {
    const none = run({ figures: [] }, { template, format })
    for (const f of figures) expect(texts(none).map(i => i.text)).not.toContain(f.value)
    expect(none.items.some(i => i.kind === 'tile')).toBe(false)
  })
})

describe('layoutShare — long names', () => {
  const longTitle = 'A very long session name that goes on and on and on and on and on and on'

  it('shrinks a long session name before it cuts it, and keeps it to two lines', () => {
    const t = texts(run({ title: longTitle }, { template: 'photo' })).filter(i => i.weight === 800 && i.size < 80 && i.size > 30 && longTitle.startsWith(i.text.replace(/…$/, '').trim().slice(0, 10)))
    expect(t.length).toBeGreaterThan(0)
    expect(t.length).toBeLessThanOrEqual(2)
    expect(t[0].size).toBeLessThan(66)
    expect(t[0].size).toBeGreaterThanOrEqual(66 * 0.6 - 4)
    expect(t.at(-1).text.endsWith('…')).toBe(false)
  })

  it('cuts a name that no size will fit, at two lines and with an ellipsis', () => {
    const absurd = Array.from({ length: 80 }, () => 'marathon').join(' ')
    const t = texts(run({ title: absurd }, { template: 'photo' })).filter(i => i.weight === 800 && i.text.startsWith('marathon'))
    expect(t).toHaveLength(2)
    expect(t[1].text.endsWith('…')).toBe(true)
    expect(width(t[1])).toBeLessThanOrEqual(WH('feed').width - PAD * 2 + 0.5)
  })

  it('shrinks an exercise\'s name a little before cutting it, never below an eighth under its size, then cuts it with an ellipsis', () => {
    // 47 characters: 34 px and 32 px are too wide for the room left by the numbers, 30 px fits.
    const fits = 'abcde '.repeat(8).trim()
    const a = texts(run({ lines: [{ name: fits, detail: '4 × 8 · 80 kg', pr: false }] }, { template: 'photo' })).find(i => i.text === fits)
    expect(a).toBeTruthy()
    expect(a.size).toBe(30)
    const tooLong = Array.from({ length: 30 }, () => 'incline').join(' ')
    const b = texts(run({ lines: [{ name: tooLong, detail: '4 × 8 · 80 kg', pr: false }] }, { template: 'photo' })).find(i => i.text.startsWith('incline'))
    expect(b.size).toBe(30)
    expect(b.text.endsWith('…')).toBe(true)
    const numbers = texts(run({ lines: [{ name: tooLong, detail: '4 × 8 · 80 kg', pr: false }] }, { template: 'numbers' })).find(i => i.text.startsWith('incline'))
    expect(numbers.size).toBe(36)
  })

  it('keeps the names of one list within an eighth of each other in size', () => {
    const long = Array.from({ length: 9 }, () => 'barbell').join(' ')
    const rows = [{ name: 'Squat', detail: '4 × 8 · 80 kg', pr: false }, { name: long, detail: '60×10 · 70×8 · 80×6 · 90×4', pr: false }, { name: 'Row', detail: '3 × 10', pr: false }]
    const names = texts(run({ lines: rows }, { template: 'photo' })).filter(i => i.weight === 600 && ['Squat', 'Row'].includes(i.text) || i.text.startsWith('barbell'))
    const sizes = names.map(i => i.size)
    expect(Math.min(...sizes)).toBeGreaterThanOrEqual(Math.round(34 * 0.88 / 2) * 2)
    expect(Math.max(...sizes) / Math.min(...sizes)).toBeLessThanOrEqual(1.14)
  })

  it('cuts a long line of numbers so the name keeps its room', () => {
    const detail = '60×10 · 70×8 · 80×6 · 90×4 · 100×2 · 110×1 · 120×1 · 130×1'
    const row = texts(run({ lines: [{ name: 'Bench press', detail, pr: false }] }, { template: 'photo' }))
    const d = row.find(i => i.anchor === 'right' && i.size === 32)
    expect(width(d)).toBeLessThanOrEqual((WH('feed').width - PAD * 2) * 0.58 + 0.5)
    expect(row.map(i => i.text)).toContain('Bench press')
  })
})

describe('layoutShare — the photo', () => {
  it('lets the numbers cover at most 60 % of a feed picture and 62 % of a story, whatever the number of lines', () => {
    for (const format of ['feed', 'story']) {
      const { height } = WH(format)
      const share = { feed: 0.6, story: 0.62 }[format]
      const layout = run({ lines: lines(60) }, { template: 'photo', format })
      expect(layout.overlayTop).toBeGreaterThanOrEqual(height * (1 - share) - PAD - 1)
    }
  })

  it('anchors its numbers to the bottom: the less there is to say, the lower it starts', () => {
    const little = run({ lines: lines(1), figures: [] }, { template: 'photo' })
    const lots = run({ lines: lines(8) }, { template: 'photo' })
    expect(little.overlayTop).toBeGreaterThan(lots.overlayTop)
  })

  it('spreads the figures from the start edge to the end edge, whatever their widths', () => {
    const layout = run({}, { template: 'photo' })
    const values = texts(layout).filter(i => figures.some(f => f.value === i.text))
    expect(values).toHaveLength(3)
    expect(values[0].x).toBe(PAD)
    const last = values.at(-1)
    const label = texts(layout).find(i => i.text === 'WEIGHT MOVED')
    const column = Math.max(width(last), width(label))
    expect(last.x + column).toBeCloseTo(WH('feed').width - PAD, 0)
  })

  it('shrinks the figures, not the margins, when they would not fit side by side', () => {
    const wide = figures.map(f => ({ ...f, value: '123,456,789 kg' }))
    const layout = run({ figures: wide }, { template: 'photo' })
    const values = texts(layout).filter(i => i.text === '123,456,789 kg')
    expect(values[0].size).toBeLessThan(84)
    const last = values.at(-1)
    expect(last.x + width(last)).toBeLessThanOrEqual(WH('feed').width - PAD + 0.5)
  })
})

describe('layoutShare — the numbers card', () => {
  it('starts at the top and puts a tile behind each figure, two by two beyond three', () => {
    const three = run({}, { template: 'numbers' })
    expect(three.items.filter(i => i.kind === 'tile')).toHaveLength(3)
    const four = run({ figures: [...figures, { key: 'x', label: 'Extra', value: '9' }] }, { template: 'numbers' })
    const tiles = four.items.filter(i => i.kind === 'tile')
    expect(tiles).toHaveLength(4)
    expect(new Set(tiles.map(t => t.y)).size).toBe(2)
    expect(new Set(tiles.map(t => t.x)).size).toBe(2)
    for (const t of tiles) expect(t.x + t.w).toBeLessThanOrEqual(WH('feed').width - PAD + 0.5)
  })

  it('is signed « Session done » above the title and the day below it', () => {
    const t = texts(run({}, { template: 'numbers' })).map(i => i.text)
    expect(t).toContain('SESSION DONE')
    expect(t.indexOf('SESSION DONE')).toBeLessThan(t.indexOf('Push day'))
    expect(t.indexOf('Push day')).toBeLessThan(t.indexOf('Thu 3 Sep'))
  })

  it('keeps the card inside its frame with every line it can hold', () => {
    const { height } = WH('feed')
    const layout = run({ lines: lines(40) }, { template: 'numbers' })
    expect(layout.hidden).toBeGreaterThan(0)
    const ys = layout.items.map(i => i.y).filter(Number.isFinite)
    expect(Math.min(...ys)).toBeGreaterThanOrEqual(PAD - 1)
    expect(Math.max(...ys)).toBeLessThanOrEqual(height - PAD + 1)
  })
})

describe('layoutShare — the sticker', () => {
  const sticker = (over, opts = {}) => run(over, { template: 'sticker', ...opts })

  it('is 1 080 wide and as tall as what it says, whatever shape was asked for', () => {
    const feed = sticker({}, { format: 'feed' })
    const story = sticker({}, { format: 'story' })
    expect(feed).toMatchObject({ template: 'sticker', width: 1080 })
    expect(feed.height).toBe(story.height)
    expect(feed.height).toBeLessThan(FORMATS.feed.height)
  })

  it('is one panel that holds everything, the panel drawn first', () => {
    const layout = sticker({})
    expect(layout.items[0]).toEqual({ kind: 'panel', x: 0, y: 0, w: 1080, h: layout.height, r: STICKER.radius })
    for (const i of layout.items.slice(1)) {
      expect(i.x).toBeGreaterThanOrEqual(0)
      expect(i.x).toBeLessThanOrEqual(1080)
      if (Number.isFinite(i.y)) { expect(i.y).toBeGreaterThanOrEqual(STICKER.top - 1); expect(i.y).toBeLessThanOrEqual(layout.height - STICKER.bottom + 1) }
    }
  })

  it('keeps every text between the side margins, left- and right-aligned alike', () => {
    for (const rtl of [false, true]) {
      for (const t of texts(sticker({ lines: lines(12) }, { rtl }))) {
        const w = width(t)
        const [from, to] = t.anchor === 'right' ? [t.x - w, t.x] : [t.x, t.x + w]
        expect(from).toBeGreaterThanOrEqual(PAD - 0.5)
        expect(to).toBeLessThanOrEqual(1080 - PAD + 0.5)
      }
    }
  })

  it('grows with what it says, up to eight exercise lines, and counts the rest in a last line', () => {
    const one = sticker({ lines: lines(1) })
    const six = sticker({ lines: lines(6) })
    const twelve = sticker({ lines: lines(12) })
    expect(one.height).toBeLessThan(six.height)
    expect(six.height).toBeLessThan(twelve.height)
    expect(twelve).toMatchObject({ shown: STICKER.maxLines, hidden: 4 })
    expect(texts(twelve).map(i => i.text)).toContain('+ 4 more')
    expect(texts(six).some(i => /^\+ \d+ more$/.test(i.text))).toBe(false)
  })

  it('closes on the foot — the club\'s name and site — and is shorter without one', () => {
    const withFoot = sticker({})
    expect(texts(withFoot).map(i => i.text)).toEqual(expect.arrayContaining(['Riverside Gym', 'riverside.example']))
    const none = sticker({ club: { name: '', logo: '', site: '', info: '' } })
    expect(none.height).toBeLessThan(withFoot.height)
    expect(none.items.some(i => i.kind === 'rule' && i.y > STICKER.top + 400)).toBe(false)
  })

  it('has a bottom margin as deep as its top one', () => {
    const layout = sticker({})
    const lowest = Math.max(...layout.items.filter(i => i.kind === 'text').map(i => i.y))
    expect(layout.height - lowest).toBeGreaterThanOrEqual(STICKER.bottom - 1)
  })

  it('mirrors in a right-to-left language', () => {
    const rtl = sticker({}, { rtl: true })
    expect(texts(rtl).find(i => i.text === 'Push day')).toMatchObject({ x: 1080 - PAD, anchor: 'right' })
    expect(rtl.items.find(i => i.kind === 'bar').x).toBe(1080 - PAD - 96)
  })

  it('says nothing about a figure that was not ticked', () => {
    const none = sticker({ figures: [] })
    for (const f of figures) expect(texts(none).map(i => i.text)).not.toContain(f.value)
  })
})
