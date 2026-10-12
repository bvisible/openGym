//// Neoffice — added file (no upstream equivalent).
//// The French packs cover the whole catalogue. Upstream ships the exercise steps and descriptions in English and a
//// pack per language for the part it has translated; every version brings exercises ours do not cover yet, and a
//// French-speaking member then reads English in the middle of a French screen (the sheet of an exercise, the steps
//// under the animation). This turns that into a red test at the merge, instead of a surprise at the club:
//// translate the missing ones with scripts/translation-batches.mjs and scripts/translation-merge.mjs (see the
//// instructions file, « Traduire le catalogue »).
import { describe, expect, it } from 'vitest'
import enSteps from '../instr/en.js'
import frSteps from '../instr/fr.js'
import enDesc from '../exercise-desc/en.js'
import frDesc from '../exercise-desc/fr.js'

const sample = ids => ids.slice(0, 8).join(', ') + (ids.length > 8 ? ` … (${ids.length} in all)` : '')

describe('the French packs cover the whole catalogue', () => {
  it('has the steps of every exercise, one for one with the English list', () => {
    const missing = Object.keys(enSteps).filter(id => !frSteps[id])
    const uneven = Object.keys(enSteps).filter(id => frSteps[id] && frSteps[id].length !== enSteps[id].length)
    expect(missing, `exercises with no French steps: ${sample(missing)}`).toEqual([])
    expect(uneven, `exercises whose French steps do not match the English count: ${sample(uneven)}`).toEqual([])
  })

  it('has the description of every exercise', () => {
    const missing = Object.keys(enDesc).filter(id => !frDesc[id])
    expect(missing, `exercises with no French description: ${sample(missing)}`).toEqual([])
  })

  it('has no entry for an exercise the catalogue does not have', () => {
    expect(Object.keys(frSteps).filter(id => !enSteps[id])).toEqual([])
    expect(Object.keys(frDesc).filter(id => !enDesc[id])).toEqual([])
  })

  it('writes every step and description as text, with the formal « vous » and no curly apostrophe', () => {
    const texts = [...Object.values(frSteps).flat(), ...Object.values(frDesc)]
    expect(texts.every(text => typeof text === 'string' && text.trim() !== '')).toBe(true)
    expect(texts.filter(text => /’/.test(text)), 'curly apostrophes').toEqual([])
    // Unicode-aware: a plain \b treats « ô » as a word edge and would find « tes » in « côtes ».
    const informal = /(?<![\p{L}])(?:(?:tu|ton|ta|tes|toi|te)(?![\p{L}])|t['\u2019](?=\p{L}))/iu
    expect(texts.filter(text => informal.test(text)).slice(0, 5), 'informal « tu »').toEqual([])
  })
})
