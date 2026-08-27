//// Neoffice — added file (no upstream equivalent).
////
//// What these tests protect, after the 2026-08-27 upstream merge: we used to
//// carry our OWN translated-name mechanism (src/names/, applyExerciseNames
//// mutating the shared catalogue, matchesExercise). Upstream then shipped the
//// same feature done better — an accessor, no mutation — so we dropped ours and
//// moved our French pack into theirs (src/exercise-names/fr.js).
////
//// Two things have to keep holding, and neither of them throws when it breaks:
////   * `fr` stays registered in EXERCISE_NAME_LANGS. Drop it and every screen
////     silently reverts to English names at a French-speaking club.
////   * exerciseNameFor() returns the translated name ALONE. Upstream appends
////     " (English name)"; on a phone that wraps onto two lines in every list,
////     the timer and the printed plan. The search stays bilingual through
////     exerciseNameSearchText(), which is where the English name earns its keep.

import { describe, it, expect, afterAll } from 'vitest'
import { EXERCISE_NAME_LANGS, _setLangState, exerciseNameFor, exerciseNameSearchText } from './i18n-core.js'
import { EXIDX, CATALOGUE, applyClubMedia, imgSrc, gifSrc, matchExercise } from './exercises.js'
import frNames from '../exercise-names/fr.js'

const ID = CATALOGUE[0].id
const EN = CATALOGUE[0].n

const speakFrench = () => _setLangState('fr', {}, null, frNames)
const speakEnglish = () => _setLangState('en', {}, null, null)

afterAll(speakEnglish)

describe('the French exercise-name pack', () => {
  it('is registered in upstream’s mechanism', () => {
    expect(EXERCISE_NAME_LANGS).toContain('fr')
  })

  it('covers the whole catalogue, not a sample of it', () => {
    const missing = CATALOGUE.filter(e => !frNames[e.id])
    expect(missing.length, `${missing.length} exercises without a French name`).toBe(0)
  })

  it('translates a catalogue exercise once French is active', () => {
    speakFrench()
    expect(exerciseNameFor(EXIDX[ID])).toBe(frNames[ID])
    expect(frNames[ID]).not.toBe(EN)
  })

  it('gives back the English name when the language has no pack', () => {
    speakEnglish()
    expect(exerciseNameFor(EXIDX[ID])).toBe(EN)
  })

  it('leaves a member’s own exercise exactly as they named it', () => {
    speakFrench()
    expect(exerciseNameFor({ id: 'custom-1', n: 'Ma machine' })).toBe('Ma machine')
  })
})

describe('exerciseNameFor', () => {
  it('returns the translated name ALONE, without the English one in brackets', () => {
    //// Neoffice — this is our one divergence in the mechanism, and the reason
    //// is length: upstream renders "Développé couché à la barre (Barbell Bench
    //// Press)" everywhere the name appears.
    speakFrench()
    const shown = exerciseNameFor(EXIDX[ID])
    expect(shown).toBe(frNames[ID])
    expect(shown).not.toContain('(')
  })
})

describe('the search stays bilingual', () => {
  it('carries both the French and the English name', () => {
    speakFrench()
    const text = exerciseNameSearchText(EXIDX[ID])
    expect(text).toContain(frNames[ID])
    expect(text).toContain(EN)
  })

  it('finds an exercise by its English name inside a French app', () => {
    speakFrench()
    const ex = CATALOGUE.find(e => /bench press/i.test(e.n))
    expect(ex, 'no "bench press" in the catalogue').toBeTruthy()
    expect(matchExercise(ex, 'bench press')).toBe(true)
  })

  it('finds it by the French name too, accents or not', () => {
    speakFrench()
    const ex = CATALOGUE.find(e => /^Développé couché/i.test(frNames[e.id] || ''))
    expect(ex, 'no "Développé couché" in the French pack').toBeTruthy()
    expect(matchExercise(ex, 'developpe couche')).toBe(true)
  })

  it('does not match just anything', () => {
    speakFrench()
    expect(matchExercise(EXIDX[ID], 'zzzznonexistent')).toBe(false)
  })
})

//// Neoffice — the club's own media. Same risk as the names: we mutate shared
//// objects, and a malformed URL would render a broken image with no error.
describe('applyClubMedia', () => {
  it('replaces the image and the animation of a library exercise', () => {
    applyClubMedia({ [ID]: { img: '/files/machine.jpg', gif: '/files/machine.gif' } })
    expect(EXIDX[ID].img).toBe('/files/machine.jpg')
    expect(imgSrc(EXIDX[ID])).toBe('/files/machine.jpg')
    expect(gifSrc(EXIDX[ID])).toBe('/files/machine.gif')
  })

  it('leaves everything else on the sheet alone', () => {
    const before = EXIDX[ID].n
    applyClubMedia({ [ID]: { img: '/files/x.jpg' } })
    expect(EXIDX[ID].n).toBe(before)
  })

  it('ignores an id the library does not know', () => {
    expect(() => applyClubMedia({ 'zzz-unknown': { img: '/files/x.jpg' } })).not.toThrow()
  })

  it('a bare file name stays a library one', () => {
    const lib = CATALOGUE.find(e => e.img && !e.img.startsWith('/'))
    expect(imgSrc(lib)).toContain('/assets/opengym/media/img/')
  })

  it('null breaks nothing — an instance with no club media', () => {
    expect(() => applyClubMedia(null)).not.toThrow()
  })
})
