//// Neoffice — added file (no upstream equivalent).
//// The member's own name for an exercise wins everywhere, and the search still
//// finds the exercise by its catalogue name.
import { afterEach, describe, expect, it } from 'vitest'
import { catalogueNameFor, exerciseAliasOf, exerciseNameFor, exerciseNameSearchText, getNamesVersion, setExerciseAliases } from './i18n-core.js'
import { matchExercise } from './exercises.js'

const dip = { id: '0251', n: 'chest dip' }

afterEach(() => setExerciseAliases({}))

describe('exercise aliases', () => {
  it('an alias replaces the name on screen, the catalogue name stays reachable', () => {
    expect(exerciseNameFor(dip)).toBe(catalogueNameFor(dip))
    setExerciseAliases({ '0251': 'Épaules' })
    expect(exerciseNameFor(dip)).toBe('Épaules')
    expect(exerciseAliasOf('0251')).toBe('Épaules')
    expect(catalogueNameFor(dip)).not.toBe('Épaules')
  })

  it('the search matches the alias AND the catalogue name', () => {
    setExerciseAliases({ '0251': 'Épaules' })
    const text = exerciseNameSearchText(dip)
    expect(text).toContain('Épaules')
    expect(text).toContain('chest dip')
  })

  it('clearing the map brings the catalogue name back', () => {
    setExerciseAliases({ '0251': 'Épaules' })
    setExerciseAliases(null)
    expect(exerciseNameFor(dip)).toBe(catalogueNameFor(dip))
    expect(exerciseAliasOf('0251')).toBe('')
  })

  it('the search finds the new name at once, on the SAME exercise object', () => {
    // The corpus is cached per object: without a version bump, the rename is
    // invisible to the search until the next launch.
    const ex = { id: '0251', n: 'chest dip', tg: 'pectorals', eq: 'body weight', bp: 'chest' }
    expect(matchExercise(ex, 'épaules')).toBe(false)
    setExerciseAliases({ '0251': 'Épaules' })
    expect(matchExercise(ex, 'épaules')).toBe(true)
    expect(matchExercise(ex, 'chest dip')).toBe(true)
    setExerciseAliases({})
    expect(matchExercise(ex, 'épaules')).toBe(false)
  })

  it('the same map again does not move the version (persist calls this on every change)', () => {
    setExerciseAliases({ '0251': 'Épaules' })
    const v = getNamesVersion()
    setExerciseAliases({ '0251': 'Épaules' })
    expect(getNamesVersion()).toBe(v)
    setExerciseAliases({ '0251': 'Dos' })
    expect(getNamesVersion()).not.toBe(v)
  })
})
