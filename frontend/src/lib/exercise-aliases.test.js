//// Neoffice — added file (no upstream equivalent).
//// The member's own name for an exercise wins everywhere, and the search still
//// finds the exercise by its catalogue name.
import { afterEach, describe, expect, it } from 'vitest'
import { catalogueNameFor, exerciseAliasOf, exerciseNameFor, exerciseNameSearchText, setExerciseAliases } from './i18n-core.js'

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
})
