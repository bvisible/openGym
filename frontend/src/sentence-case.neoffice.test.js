//// Neoffice — added file (no upstream equivalent). Labels are set in sentence case, their first letter
//// raised, never every word: word-by-word capitals are English title case, and French read « Jour De
//// Repos » on Home and « Poids Du Corps » in the library's filters (seen in Chrome on 08.10). Our 02.09
//// fix took upstream's `text-transform:capitalize` out of `.today-row .ttl`, and an upstream rewrite of
//// that rule brought it back without a conflict: a removed declaration carries no marker. happy-dom does
//// no cascade, so this reads index.css: the last word on each label's case is ours.
import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

const css = readFileSync(resolve(process.cwd(), 'src/index.css'), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '')
// Top-level rules only, in source order: the title's case is not set in any @media block.
const flat = css.replace(/@media[^{]*\{(?:[^{}]*\{[^{}]*\})*[^{}]*\}/g, m => ' '.repeat(m.length))
const rules = [...flat.matchAll(/([^{}@]+)\{([^{}]*)\}/g)].map(m => ({ selectors: m[1].split(',').map(s => s.trim()), decls: m[2] }))
const transformsOf = selector => rules
  .filter(r => r.selectors.includes(selector))
  .map(r => (r.decls.match(/text-transform\s*:\s*([^;]+)/) || [])[1])
  .filter(Boolean)
  .map(v => v.trim())

describe('the title of the today row', () => {
  it('is never capitalised word by word: the last rule that sets its case says none', () => {
    const cases = transformsOf('.today-row .ttl')
    expect(cases.length).toBeGreaterThan(0)
    expect(cases.at(-1)).toBe('none')
  })

  it('has its first letter raised', () => {
    expect(transformsOf('.today-row .ttl::first-letter')).toContain('uppercase')
  })
})

describe('a chip', () => {
  it('is never capitalised word by word, and its first letter is raised unless it is a unit', () => {
    expect(transformsOf('.chip').at(-1)).toBe('none')
    expect(transformsOf('.chip:not(.nocap)::first-letter')).toEqual(['uppercase'])
  })
})
