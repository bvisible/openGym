//// Neoffice — upstream's test, turned on OUR pack. src/exercise-names/fr.js is ours (1,324 names
//// in a gym's words, kept at the v1.3.9 merge instead of upstream's generated list), so the checks
//// that pin upstream's source and vocabulary are replaced by what holds for ours: every exercise
//// named, no English qualifier left over, names alone by default, the English when asked.
import { afterEach, describe, expect, test } from 'vitest'
import frNames from '../exercise-names/fr.js'
import { EXDB } from './exercises-data.js'
import {
  EXERCISE_NAME_LANGS, _setLangState, exerciseNameFor, exerciseNameSearchText
} from './i18n-core.js'

describe('French exercise names', () => {
  afterEach(() => _setLangState('en', {}, null, null))

  //// Neoffice — no curated source file to match: the pack itself is the source.
  test('covers the complete built-in catalogue', () => {
    expect(Object.keys(frNames)).toHaveLength(EXDB.length)
    expect(EXERCISE_NAME_LANGS).toContain('fr')
  })

  test('contains a non-empty translation for every known exercise with no untranslated qualifiers', () => {
    for (const exercise of EXDB) {
      expect(frNames[exercise.id]?.trim(), exercise.id).toBeTruthy()
      expect(frNames[exercise.id], exercise.id).not.toMatch(
        /(?:^|[^\p{L}])(?:barbell|dumbbell|cable|stability ball|medicine ball|assisted|weighted)(?=$|[^\p{L}])/iu
      )
    }
  })

  //// Neoffice — upstream's check, in our pack's words. Upstream pins its own vocabulary (câble,
  //// masculin, multipower); ours says what a gym says (poulie, homme, Smith machine, swiss ball),
  //// and the point stands: a qualifier that changes the exercise is never dropped.
  test('preserves identity-changing qualifiers and equipment', () => {
    const rules = [
      [/assisted/iu, /assist/iu],
      [/weighted/iu, /lesté/iu],
      [/(?:^|[^\p{L}])male(?=$|[^\p{L}])/iu, /homme/iu],   //// Neoffice — our pack's word
      [/(?:^|[^\p{L}])female(?=$|[^\p{L}])/iu, /femme/iu],
      [/barbell/iu, /barre/iu],
      [/dumbbell/iu, /haltère/iu],
      [/kettlebell/iu, /kettlebell/iu],
      [/smith/iu, /smith/iu],   //// Neoffice — our pack's word
      [/stability ball|exercise ball/iu, /ballon|swiss ball/iu],
      [/medicine ball/iu, /medicine-ball|médecine-ball/iu],
      [/cable/iu, /poulie|câble/iu],
      [/band/iu, /élastique|bande/iu],
    ]
    //// Neoffice — the ball is this stretch's assistance, and « au ballon de stabilité » says so.
    const exempt = { 1716: String(/assisted/iu) }
    for (const exercise of EXDB) {
      for (const [english, french] of rules) {
        if (exempt[exercise.id] === String(english)) continue   //// Neoffice — see the exemption above
        if (english.test(exercise.n)) expect(frNames[exercise.id], `${exercise.id}: ${english}`).toMatch(french)
      }
    }
  })

  //// Neoffice — reversed: a club's French journal opens with the name alone (lib/i18n-core.js).
  test('shows the French name alone by default, the English beside it when asked, and searches both', () => {
    const exercise = EXDB[0]
    _setLangState('fr', {}, null, frNames)
    expect(exerciseNameFor(exercise)).toBe(frNames[exercise.id])   //// Neoffice — alone by default
    expect(exerciseNameSearchText(exercise)).toContain(frNames[exercise.id])
    expect(exerciseNameSearchText(exercise)).toContain(exercise.n)
    _setLangState('fr', {}, null, frNames, true)   //// Neoffice — the English beside it, when asked
    expect(exerciseNameFor(exercise)).toBe(`${frNames[exercise.id]} (${exercise.n})`)
    _setLangState('fr', {}, null, frNames, false, true)
    expect(exerciseNameFor(exercise)).toBe(exercise.n)
  })

  test('never translates custom exercises or changes other languages', () => {
    const custom = { id: 'custom-1', n: 'Mon exercice' }
    _setLangState('fr', {}, null, frNames)
    expect(exerciseNameFor(custom)).toBe('Mon exercice')
    _setLangState('en', {}, null, null)
    expect(exerciseNameFor(EXDB[0])).toBe(EXDB[0].n)
  })

  test('keeps loanword names without duplicating the English title', () => {
    const burpee = EXDB.find(e => e.id === '1160')
    _setLangState('fr', {}, null, frNames)
    expect(exerciseNameFor(burpee)).toBe('Burpee')   //// Neoffice — our pack writes it capitalised
  })
})