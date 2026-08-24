//// Neoffice — added file (no upstream equivalent).
//// Ce que ces tests protègent : la traduction des noms MUTE les objets partagés
//// de EXDB. C'est efficace et c'est risqué — un aller-retour de langue qui
//// traduirait une traduction rendrait la bibliothèque illisible sans qu'aucune
//// erreur ne se produise.

import { describe, it, expect, beforeEach } from 'vitest'
import { EXDB, EXIDX, applyExerciseNames, matchesExercise } from './exercises.js'

const ID = EXDB[0].id
const EN = EXDB[0].n

describe('applyExerciseNames', () => {
  beforeEach(() => applyExerciseNames(null))

  it('traduit ce que le pack couvre et laisse l’anglais pour le reste', () => {
    applyExerciseNames({ [ID]: 'Nom français' })
    expect(EXIDX[ID].n).toBe('Nom français')
    const other = EXDB.find(e => e.id !== ID)
    expect(other.n).toBe(other.en)
  })

  it('ne traduit JAMAIS une traduction — deux passages restent stables', () => {
    applyExerciseNames({ [ID]: 'Premier' })
    applyExerciseNames({ [ID]: 'Second' })
    expect(EXIDX[ID].n).toBe('Second')
    expect(EXIDX[ID].en).toBe(EN)
  })

  it('revient à l’anglais quand la langue n’a pas de pack', () => {
    applyExerciseNames({ [ID]: 'Français' })
    applyExerciseNames(null)
    expect(EXIDX[ID].n).toBe(EN)
  })

  it('garde le nom anglais accessible pour la recherche', () => {
    applyExerciseNames({ [ID]: 'Développé couché à la barre' })
    expect(EXIDX[ID].en).toBe(EN)
  })
})

describe('matchesExercise', () => {
  beforeEach(() => applyExerciseNames({ [ID]: 'Développé couché à la barre' }))

  it('trouve par le nom français', () => {
    expect(matchesExercise(EXIDX[ID], 'développé')).toBe(true)
  })

  it('trouve AUSSI par le nom anglais — un membre venu d’une autre app', () => {
    expect(matchesExercise(EXIDX[ID], EN.toLowerCase().slice(0, 6))).toBe(true)
  })

  it('ne trouve pas n’importe quoi', () => {
    expect(matchesExercise(EXIDX[ID], 'zzzznonexistent')).toBe(false)
  })

  it('une recherche vide passe tout', () => {
    expect(matchesExercise(EXIDX[ID], '')).toBe(true)
  })
})
