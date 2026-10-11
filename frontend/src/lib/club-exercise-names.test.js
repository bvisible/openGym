// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). It replaces our two older name tests (lib/exercise-names.test.js
//// and lib/fr-exercise-names.test.js, whose file names upstream now uses for its own checks of every pack).
////
//// What these tests protect: the French names the clubs already know (club-names/fr.js, 1,324 names of the v1.3
//// catalogue) are laid over upstream's generated pack (exercise-names/fr.js, all 5,632 exercises) by lib/i18n.js,
//// and none of the three things that can break there throws when it does:
////   * `fr` stays registered in EXERCISE_NAME_LANGS. Drop it and every screen silently reverts to English names at a
////     French-speaking club.
////   * the club's names win over the generated ones exercise by exercise, and the exercises the club never named
////     fall back to the generated name instead of English.
////   * exerciseNameFor() returns the translated name ALONE. Upstream appends " (English name)"; on a phone that wraps
////     onto two lines in every list, the timer and the printed plan. The search stays bilingual through
////     exerciseNameSearchText(), which is where the English name earns its keep.

import { describe, it, expect, afterAll } from 'vitest'
import { EXERCISE_NAME_LANGS, _setLangState, exerciseNameFor, exerciseNameSearchText } from './i18n-core.js'
import { setLang } from './i18n.js'
import { EXIDX, CATALOGUE, applyClubMedia, imgSrc, gifSrc, matchExercise } from './exercises.js'
import V13_IDS from './catalogue-v13-ids.json' with { type: 'json' }
import upstreamFr from '../exercise-names/fr.js'
import clubFr from '../club-names/fr.js'
import { layClubNames } from './club-names.js'

// What setLang builds for French: the generated pack with its first letters raised, the club's names on top.
const frNames = layClubNames(upstreamFr, clubFr)
const LEGACY = new Set(V13_IDS)
const ID = V13_IDS[0]
const EN = EXIDX[ID].n

const speakFrench = () => _setLangState('fr', {}, null, frNames)
const speakEnglish = () => _setLangState('en', {}, null, null)

afterAll(speakEnglish)

describe('the club’s French exercise names', () => {
  it('are registered in upstream’s mechanism', () => {
    expect(EXERCISE_NAME_LANGS).toContain('fr')
  })

  it('name exactly the exercises of the v1.3 catalogue', () => {
    expect(Object.keys(clubFr).sort()).toEqual([...V13_IDS].sort())
  })

  it('laid over the generated pack, leave no exercise of the catalogue without a French name', () => {
    const missing = CATALOGUE.filter(e => !frNames[e.id]?.trim())
    expect(missing.length, `${missing.length} exercises without a French name`).toBe(0)
  })

  it('win over the generated name, and the generated name stands where the club has none', () => {
    const named = V13_IDS.find(id => upstreamFr[id] && upstreamFr[id] !== clubFr[id])
    expect(named, 'no exercise where the club’s name differs from the generated one').toBeTruthy()
    expect(frNames[named]).toBe(clubFr[named])
    const added = CATALOGUE.find(e => !LEGACY.has(e.id))
    expect(added, 'no exercise added after the v1.3 catalogue').toBeTruthy()
    expect(frNames[added.id]).toBe(upstreamFr[added.id].charAt(0).toLocaleUpperCase() + upstreamFr[added.id].slice(1))
  })

  it('are written in sentence case, whoever wrote them: no CSS class raises a French name', () => {
    for (const [id, name] of Object.entries(frNames)) expect(name.charAt(0), id).toBe(name.charAt(0).toLocaleUpperCase())
  })

  it('leave no English qualifier behind', () => {
    for (const id of V13_IDS) {
      expect(clubFr[id], id).not.toMatch(
        /(?:^|[^\p{L}])(?:barbell|dumbbell|cable|stability ball|medicine ball|assisted|weighted)(?=$|[^\p{L}])/iu
      )
    }
  })

  // Upstream pins its own vocabulary (câble, masculin, multipower); the club's pack says what a gym says
  // (poulie, homme, Smith machine, swiss ball), and the point stands: a qualifier that changes the exercise
  // is never dropped.
  it('keep the qualifiers and the equipment that change which exercise it is', () => {
    const rules = [
      [/assisted/iu, /assist/iu],
      [/weighted/iu, /lesté/iu],
      [/(?:^|[^\p{L}])male(?=$|[^\p{L}])/iu, /homme/iu],
      [/(?:^|[^\p{L}])female(?=$|[^\p{L}])/iu, /femme/iu],
      [/barbell/iu, /barre/iu],
      [/dumbbell/iu, /haltère/iu],
      [/kettlebell/iu, /kettlebell/iu],
      [/smith/iu, /smith/iu],
      [/stability ball|exercise ball/iu, /ballon|swiss ball/iu],
      [/medicine ball/iu, /medicine-ball|médecine-ball/iu],
      [/cable/iu, /poulie|câble/iu],
      [/band/iu, /élastique|bande/iu],
    ]
    // The ball is this stretch's assistance, and « au ballon de stabilité » says so.
    const exempt = { 1716: String(/assisted/iu) }
    for (const id of V13_IDS) {
      for (const [english, french] of rules) {
        if (exempt[id] === String(english)) continue
        if (english.test(EXIDX[id].n)) expect(clubFr[id], `${id}: ${english}`).toMatch(french)
      }
    }
  })
})

describe('setLang', () => {
  it('lays the club’s names over the generated pack, and drops them with the language', async () => {
    const added = CATALOGUE.find(e => !LEGACY.has(e.id))
    await setLang('fr')
    expect(exerciseNameFor(EXIDX[ID])).toBe(clubFr[ID])
    expect(exerciseNameFor(added)).toBe(frNames[added.id])
    await setLang('en')
    expect(exerciseNameFor(EXIDX[ID])).toBe(EN)
  })
})

describe('exerciseNameFor', () => {
  it('returns the translated name ALONE, without the English one in brackets', () => {
    //// Neoffice — this is our one divergence in the mechanism, and the reason is length: upstream renders
    //// "Développé couché à la barre (Barbell Bench Press)" everywhere the name appears.
    speakFrench()
    const shown = exerciseNameFor(EXIDX[ID])
    expect(shown).toBe(frNames[ID])
    expect(shown).not.toContain('(')
  })

  it('shows the English beside it when asked, and only the English when asked for that', () => {
    _setLangState('fr', {}, null, frNames, true)
    expect(exerciseNameFor(EXIDX[ID])).toBe(`${frNames[ID]} (${EN})`)
    _setLangState('fr', {}, null, frNames, false, true)
    expect(exerciseNameFor(EXIDX[ID])).toBe(EN)
  })

  it('gives back the English name when the language has no pack', () => {
    speakEnglish()
    expect(exerciseNameFor(EXIDX[ID])).toBe(EN)
  })

  it('leaves a member’s own exercise exactly as they named it', () => {
    speakFrench()
    expect(exerciseNameFor({ id: 'custom-1', n: 'Ma machine' })).toBe('Ma machine')
  })

  it('keeps a loanword name without repeating the English title', () => {
    speakFrench()
    expect(exerciseNameFor(EXIDX['1160'])).toBe('Burpee')
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

//// Neoffice — the club's own media. Same risk as the names: we mutate shared objects, and a malformed URL would
//// render a broken image with no error.
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

  it('a bare file name stays a library one, in upstream’s still/ and clip/ folders', () => {
    const lib = CATALOGUE.find(e => e.id !== ID && e.img && !e.img.startsWith('/'))
    expect(imgSrc(lib)).toContain('/assets/opengym/media/still/')
    expect(gifSrc(lib)).toContain('/assets/opengym/media/clip/')
  })

  it('null breaks nothing — an instance with no club media', () => {
    expect(() => applyClubMedia(null)).not.toThrow()
  })
})
