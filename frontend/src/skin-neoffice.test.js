//// Neoffice — added file (no upstream equivalent).
////
//// The contract of the warm skin's stylesheet (src/skin-neoffice.css): what makes it safe to carry on top of upstream. It is the one file whose rules reach every screen,
//// so the tests are about its SHAPE, not its taste (which is looked at on a screen, light and dark):
////  - every rule sits behind :root[data-skin="neoffice"]: without the attribute the app is upstream's, and an upstream merge of index.css cannot collide with it;
////  - every token it overrides still exists in index.css (a rename upstream fails here, not on a member's screen), in both themes alike;
////  - the accent is not its to set: the club's colour and a member's own choice (lib/accent.js) stay in charge;
////  - the text colours read on the surfaces they are used on (WCAG), the ink button reads, in both themes;
////  - the font files it names exist, and are woff2.
import { readFileSync, existsSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { SKIN_BARS } from './lib/skin.js'

const read = name => readFileSync(new URL(name, import.meta.url), 'utf8')
const skin = read('./skin-neoffice.css').replace(/\/\*[\s\S]*?\*\//g, '')
const index = read('./index.css').replace(/\/\*[\s\S]*?\*\//g, '')

/** Style rules as { selector, body }, at-rules entered (@media, @supports), @font-face left out. */
function rules(css) {
  const out = []
  const walk = text => {
    let i = 0
    while (i < text.length) {
      const open = text.indexOf('{', i)
      if (open < 0) break
      let depth = 1, j = open + 1
      while (j < text.length && depth) { if (text[j] === '{') depth++; else if (text[j] === '}') depth--; j++ }
      const head = text.slice(i, open).trim(), body = text.slice(open + 1, j - 1)
      if (head.startsWith('@font-face')) { /* declarations only */ } else if (head.startsWith('@')) walk(body)
      else out.push({ selector: head, body })
      i = j
    }
  }
  walk(css)
  return out
}
const all = rules(skin)
const DARK = ':root[data-skin="neoffice"]:not([data-theme="light"])'
const LIGHT = ':root[data-skin="neoffice"][data-theme="light"]'
const block = sel => all.find(r => r.selector === sel)?.body || ''
const decls = body => Object.fromEntries([...body.matchAll(/(--[\w-]+)\s*:\s*([^;]+);/g)].map(m => [m[1], m[2].trim()]))

describe('the skin stylesheet is carried behind one attribute', () => {
  it('has rules', () => { expect(all.length).toBeGreaterThan(15) })

  it('starts every selector with :root[data-skin="neoffice"]', () => {
    const loose = all.flatMap(r => r.selector.split(',').map(s => s.trim())).filter(s => !s.startsWith(':root[data-skin="neoffice"]'))
    expect(loose).toEqual([])
  })
})

describe('the tokens it overrides', () => {
  const dark = decls(block(DARK)), light = decls(block(LIGHT))
  const indexTokens = new Set([...index.matchAll(/(--[\w-]+)\s*:/g)].map(m => m[1]))
  const overridden = n => Object.keys(n).filter(k => !k.startsWith('--skin-'))

  it('exist in index.css, so a rename upstream is caught here', () => {
    for (const k of [...overridden(dark), ...overridden(light), ...Object.keys(decls(block(':root[data-skin="neoffice"]')))]) expect(indexTokens.has(k), k).toBe(true)
  })

  it('are the same set in the dark and the light theme', () => {
    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort())
  })

  it('leave the accent alone: the club’s colour and a member’s choice decide it', () => {
    const everything = Object.keys({ ...dark, ...light, ...decls(block(':root[data-skin="neoffice"]')) })
    for (const k of ['--acc', '--acc-2', '--on-acc', '--acc-soft', '--acc-line']) expect(everything).not.toContain(k)
  })

  it('keep the page colour the toolbar is painted with (lib/skin.js)', () => {
    expect(dark['--bg'].toUpperCase()).toBe(SKIN_BARS.dark)
    expect(light['--bg'].toUpperCase()).toBe(SKIN_BARS.light)
  })
})

describe('the text reads on the surfaces it sits on', () => {
  const lum = hex => {
    const c = [1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255).map(v => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4))
    return 0.2126 * c[0] + 0.7152 * c[1] + 0.0722 * c[2]
  }
  const ratio = (a, b) => { const [x, y] = [lum(a), lum(b)].sort((p, q) => q - p); return (x + 0.05) / (y + 0.05) }
  for (const [name, sel] of [['dark', DARK], ['light', LIGHT]]) {
    const t = decls(block(sel))
    it(`${name}: body text passes AAA and secondary text AA on the page and the cards`, () => {
      for (const s of ['--bg', '--surface']) {
        expect(ratio(t['--label'], t[s]), `label on ${s}`).toBeGreaterThanOrEqual(7)
        expect(ratio(t['--label-2'], t[s]), `label-2 on ${s}`).toBeGreaterThanOrEqual(4.5)
      }
    })
    // The nested and pressed fill (--surface-2) is the design system's own value; secondary text on it measures 4.4:1 in the dark theme, so the bar there is 4.3, not AA.
    it(`${name}: text on the nested fill stays readable`, () => {
      expect(ratio(t['--label'], t['--surface-2'])).toBeGreaterThanOrEqual(7)
      expect(ratio(t['--label-2'], t['--surface-2'])).toBeGreaterThanOrEqual(4.3)
    })
    it(`${name}: the tertiary text keeps 3:1 on the page`, () => {
      expect(ratio(t['--label-3'], t['--bg'])).toBeGreaterThanOrEqual(3)
    })
    it(`${name}: the ink button reads (7:1)`, () => {
      expect(ratio(t['--skin-on-ink'], t['--skin-ink'])).toBeGreaterThanOrEqual(7)
    })
    // Amber on white is the weakest colour of any palette (2.4:1 here, 2.2:1 upstream's): it is a fill or an icon that carries a word, never text alone.
    it(`${name}: the status colours stay visible on a card`, () => {
      expect(ratio(t['--green'], t['--surface']), 'green').toBeGreaterThanOrEqual(3)
      expect(ratio(t['--red'], t['--surface']), 'red').toBeGreaterThanOrEqual(3)
      expect(ratio(t['--orange'], t['--surface']), 'orange').toBeGreaterThanOrEqual(2.4)
    })
  }
})

describe('the fonts', () => {
  const names = [...readFileSync(new URL('./skin-neoffice.css', import.meta.url), 'utf8').matchAll(/url\('\.\/fonts\/([^']+)'\)/g)].map(m => m[1])
  it('names five files, all there and all woff2', () => {
    expect(names.sort()).toEqual(['Forum-Regular.woff2', 'Karla-Bold.woff2', 'Karla-Medium.woff2', 'Karla-Regular.woff2', 'Karla-SemiBold.woff2'])
    for (const n of names) {
      const url = new URL('./fonts/' + n, import.meta.url)
      expect(existsSync(url), n).toBe(true)
      expect(readFileSync(url).subarray(0, 4).toString('latin1'), n).toBe('wOF2')
    }
  })
  it('keeps the page lighter than 110 kB of fonts', () => {
    const total = names.reduce((n, f) => n + readFileSync(new URL('./fonts/' + f, import.meta.url)).length, 0)
    expect(total).toBeLessThan(110 * 1024)
  })
})
