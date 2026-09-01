// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// Which exercises are OFFERED at each level — and, far more important, the
//// four cases where the filter must NOT apply.
////
//// A filter on a catalogue is one wrong turn away from being a smaller
//// product: the failure is not "a beginner saw a snatch", it is "a member
//// could not log the exercise their coach prescribed". Every hole in this
//// filter is deliberate and pinned below, because each one is invisible in
//// the code that calls it and trivially lost in a refactor.

import { describe, expect, it } from 'vitest'
import { exerciseLevelOf, suitsLevel, levelFiltersExercises } from './exercise-level.js'

const SIMPLE = { level: 'simple' }
const NORMAL = { level: 'normal' }
const FULL = { level: 'full' }

const ex = (n, eq, extra = {}) => ({ id: n, n, eq, ...extra })

describe('grading a movement', () => {
  it('puts guided and body-weight work at the simple level', () => {
    expect(exerciseLevelOf(ex('lever chest press', 'leverage machine'))).toBe('simple')
    expect(exerciseLevelOf(ex('cable crossover', 'cable'))).toBe('simple')
    expect(exerciseLevelOf(ex('3/4 sit-up', 'body weight'))).toBe('simple')
    expect(exerciseLevelOf(ex('band pull apart', 'band'))).toBe('simple')
  })

  it('puts free weights at normal — technique before strength', () => {
    expect(exerciseLevelOf(ex('barbell bench press', 'barbell'))).toBe('normal')
    expect(exerciseLevelOf(ex('dumbbell curl', 'dumbbell'))).toBe('normal')
    expect(exerciseLevelOf(ex('kettlebell swing', 'kettlebell'))).toBe('normal')
  })

  it('grades the MOVEMENT above the equipment', () => {
    // The whole reason name patterns win: a muscle-up is body weight, and it is
    // not a beginner's exercise. Equipment alone would have called it simple.
    expect(exerciseLevelOf(ex('muscle up', 'body weight'))).toBe('full')
    expect(exerciseLevelOf(ex('handstand push-up', 'body weight'))).toBe('full')
    expect(exerciseLevelOf(ex('pistol squat', 'body weight'))).toBe('full')
    expect(exerciseLevelOf(ex('barbell one arm snatch', 'barbell'))).toBe('full')
    expect(exerciseLevelOf(ex('dumbbell clean', 'dumbbell'))).toBe('full')
  })

  it('never grades an exercise the member or the club wrote', () => {
    // Nobody asked us to judge somebody's own exercise, and hiding it would
    // look like it had been deleted.
    expect(exerciseLevelOf(ex('Mon exercice', 'barbell', { custom: true }))).toBe('simple')
  })
})

describe('what a member is offered', () => {
  it('offers a beginner the guided work and holds the rest back', () => {
    expect(suitsLevel(SIMPLE, ex('cable row', 'cable'))).toBe(true)
    expect(suitsLevel(SIMPLE, ex('barbell bench press', 'barbell'))).toBe(false)
    expect(suitsLevel(SIMPLE, ex('muscle up', 'body weight'))).toBe(false)
  })

  it('opens free weights at normal, and keeps the olympic lifts back', () => {
    expect(suitsLevel(NORMAL, ex('barbell bench press', 'barbell'))).toBe(true)
    expect(suitsLevel(NORMAL, ex('barbell one arm snatch', 'barbell'))).toBe(false)
  })

  it('offers everything at the full level', () => {
    expect(suitsLevel(FULL, ex('barbell one arm snatch', 'barbell'))).toBe(true)
    expect(suitsLevel(FULL, ex('muscle up', 'body weight'))).toBe(true)
  })

  //// 🔴 THE EXCEPTION. Everything below is the difference between "simpler"
  //// and "smaller", and none of it is visible at the call site.
  it('never hides something the member already uses', () => {
    // Removing an exercise from under a running programme is how you make
    // somebody believe their plan was deleted.
    expect(suitsLevel(SIMPLE, ex('barbell one arm snatch', 'barbell'), true)).toBe(true)
    expect(suitsLevel(SIMPLE, ex('muscle up', 'body weight'), 1)).toBe(true)
  })
})

describe('when the filter applies at all', () => {
  it('does nothing on the full level', () => {
    // A member who asked for everything must not be told about a filter that
    // is doing nothing — and must not have one.
    expect(levelFiltersExercises(FULL)).toBe(false)
    expect(levelFiltersExercises(SIMPLE)).toBe(true)
    expect(levelFiltersExercises(NORMAL)).toBe(true)
  })

  it('treats an unset level as full, like every other level check', () => {
    // Same resolution as levelOf(): a member who never chose, in a club that
    // set nothing, gets the whole catalogue. Silently simplifying is the one
    // outcome nobody asked for.
    expect(levelFiltersExercises({})).toBe(false)
    expect(suitsLevel({}, ex('muscle up', 'body weight'))).toBe(true)
  })
})

describe('the real catalogue', () => {
  it('leaves a beginner far more than enough to train with', async () => {
    // The number is the point, not the ratio: a filter that leaves 40
    // exercises would be a different product. Measured at 740 of 1324 the day
    // it was written; the floor here is what makes it a catalogue.
    const { EXDB } = await import('./exercises-data.js')
    const simple = EXDB.filter(e => exerciseLevelOf(e) === 'simple')
    expect(simple.length).toBeGreaterThan(500)
    // And the advanced set stays a short, deliberate list rather than a
    // pattern that quietly swallowed a third of the catalogue.
    const full = EXDB.filter(e => exerciseLevelOf(e) === 'full')
    expect(full.length).toBeGreaterThan(20)
    expect(full.length).toBeLessThan(120)
  })
})
