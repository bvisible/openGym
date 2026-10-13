//// Neoffice — added file (no upstream equivalent).
//// The small text and colour helpers of the shared pictures (lib/share/text.js).
import { describe, expect, it } from 'vitest'
import { wrapText, oneLine, fitSize, parseColor, withAlpha, luminance } from './text.js'

const m = s => s.length * 10

describe('wrapText', () => {
  it('wraps greedily on words', () => {
    expect(wrapText('one two three four', 90, m, 5)).toEqual(['one two', 'three', 'four'])
  })

  it('cuts the last line with an ellipsis when the text does not fit the lines it is given', () => {
    const out = wrapText('one two three four five six', 80, m, 2)
    expect(out).toHaveLength(2)
    expect(out[1].endsWith('…')).toBe(true)
    expect(m(out[1])).toBeLessThanOrEqual(80)
  })

  it('cuts a word that is wider than the line on its own instead of overflowing', () => {
    const out = wrapText('Donaudampfschifffahrtsgesellschaft', 100, m, 2)
    expect(out.length).toBeGreaterThan(0)
    for (const line of out) expect(m(line)).toBeLessThanOrEqual(100)
    expect(out.at(-1).endsWith('…')).toBe(true)
  })

  it('gives nothing for nothing', () => {
    expect(wrapText('', 100, m, 2)).toEqual([])
    expect(wrapText(null, 100, m, 2)).toEqual([])
    expect(wrapText('   ', 100, m, 2)).toEqual([])
  })

  it('leaves a text that fits exactly as it is', () => {
    expect(wrapText('abcdefghij', 100, m, 1)).toEqual(['abcdefghij'])
  })
})

describe('oneLine', () => {
  it('is the text on one line, cut with an ellipsis when it is longer', () => {
    expect(oneLine('short', 100, m)).toBe('short')
    const cut = oneLine('a text that is much longer than the room', 100, m)
    expect(cut.endsWith('…')).toBe(true)
    expect(m(cut)).toBeLessThanOrEqual(100)
  })

  it('is empty for nothing', () => {
    expect(oneLine('', 100, m)).toBe('')
    expect(oneLine(undefined, 100, m)).toBe('')
  })
})

describe('fitSize', () => {
  const measure = (text, weight, size) => text.length * size * 0.5
  it('keeps the largest size when the text fits', () => {
    expect(fitSize('abc', 1000, measure, 700, 60)).toBe(60)
  })
  it('steps down until the text fits', () => {
    const size = fitSize('abcdefghij', 200, measure, 700, 60)
    expect(size).toBeLessThan(60)
    expect(measure('abcdefghij', 700, size)).toBeLessThanOrEqual(200)
    expect(measure('abcdefghij', 700, size + 2)).toBeGreaterThan(200)
  })
  it('never goes under the minimum', () => {
    expect(fitSize('a'.repeat(500), 100, measure, 700, 60, 30)).toBe(30)
    expect(fitSize('a'.repeat(500), 100, measure, 700, 60)).toBe(28)
  })
})

describe('colours', () => {
  it('reads #rgb, #rrggbb, #rrggbbaa, rgb() and rgba()', () => {
    expect(parseColor('#fff')).toEqual([255, 255, 255, 1])
    expect(parseColor('#30d158')).toEqual([48, 209, 88, 1])
    expect(parseColor('#30d15880')[3]).toBeCloseTo(0.502, 2)
    expect(parseColor('rgb(10, 20, 30)')).toEqual([10, 20, 30, 1])
    expect(parseColor('rgba(10 20 30 / 0.5)')).toEqual([10, 20, 30, 0.5])
  })

  it('answers null for what it cannot read', () => {
    for (const bad of ['', null, undefined, 'red', '#12', '#12345', 'rgb(1,2)', 'hsl(0 0% 0%)']) expect(parseColor(bad)).toBeNull()
  })

  it('puts an opacity on a colour, and falls back to white when it cannot read it', () => {
    expect(withAlpha('#30d158', 0.3)).toBe('rgba(48, 209, 88, 0.3)')
    expect(withAlpha('not a colour', 0.5)).toBe('rgba(255,255,255,0.5)')
    expect(withAlpha('not a colour', 0.5, '#000')).toBe('#000')
  })

  it('measures luminance the way WCAG does: black 0, white 1, green brighter than blue', () => {
    expect(luminance([0, 0, 0])).toBe(0)
    expect(luminance([255, 255, 255])).toBeCloseTo(1, 6)
    expect(luminance([0, 255, 0])).toBeGreaterThan(luminance([0, 0, 255]))
  })
})
