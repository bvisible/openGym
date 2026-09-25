//// Neoffice — added file (no upstream equivalent).
//// The club's own names for library exercises (#766): what a club calls an
//// exercise is its name in the journal, under the member's own alias and over
//// the catalogue's pack, and the search still finds it by every name.
import { afterEach, describe, expect, it } from 'vitest'
import {
  catalogueNameFor, exerciseNameFor, exerciseNameSearchText, getNamesVersion,
  setClubExerciseNames, setExerciseAliases,
} from './i18n-core.js'
import { matchExercise } from './exercises.js'

const bench = { id: '0025', n: 'barbell bench press' }

afterEach(() => { setClubExerciseNames({}); setExerciseAliases({}) })

describe('the club’s exercise names', () => {
  it('the club’s name replaces the catalogue’s, on every screen', () => {
    const before = exerciseNameFor(bench)
    setClubExerciseNames({ '0025': 'DC barre' })
    expect(exerciseNameFor(bench)).toBe('DC barre')
    expect(catalogueNameFor(bench)).toBe('DC barre')
    setClubExerciseNames({})
    expect(exerciseNameFor(bench)).toBe(before)
  })

  it('the member’s own name still wins over the club’s', () => {
    setClubExerciseNames({ '0025': 'DC barre' })
    setExerciseAliases({ '0025': 'Mon développé' })
    expect(exerciseNameFor(bench)).toBe('Mon développé')
    // What the member's rename sheet offers back is the club's name.
    expect(catalogueNameFor(bench)).toBe('DC barre')
  })

  it('the search finds it by the club’s name AND by the catalogue’s', () => {
    setClubExerciseNames({ '0025': 'DC barre' })
    const text = exerciseNameSearchText(bench)
    expect(text).toContain('DC barre')
    expect(text).toContain('barbell bench press')
    const ex = { id: '0025', n: 'barbell bench press', tg: 'pectorals', eq: 'barbell', bp: 'chest' }
    expect(matchExercise(ex, 'dc barre')).toBe(true)
    expect(matchExercise(ex, 'bench press')).toBe(true)
  })

  it('a new map moves the names version, the same map does not', () => {
    const v0 = getNamesVersion()
    setClubExerciseNames({ '0025': 'DC barre' })
    const v1 = getNamesVersion()
    expect(v1).not.toBe(v0)
    setClubExerciseNames({ '0025': 'DC barre' })
    expect(getNamesVersion()).toBe(v1)
  })
})
