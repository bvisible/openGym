//// Neoffice — added file (no upstream equivalent).
////
//// The club decides whether the journal moves a weight on its own when nothing says otherwise (Gym Settings « Suggest heavier loads
//// automatically », S.perms.autoProgression): off by default for a club that has not asked for it. Only an explicit `false` turns the
//// default off — an absent key (an older server, no club, the mobile build) keeps upstream's linear progression — and a rule written on
//// the exercise or on its routine always wins over the club's default.
import { describe, expect, it } from 'vitest'
import { clubAutoProgression, nextPrescription, policyFor } from './progression.js'
import { EXDB, isAssisted } from './exercises.js'

const LIFT = EXDB.find(e => e.bp !== 'cardio' && !['upper legs', 'lower legs', 'back', 'hips', 'glutes'].includes(e.bp) && !['body weight', 'band', 'resistance band'].includes(e.eq) && !isAssisted(e.id)).id
const cfg = { id: LIFT, sets: 3, reps: 5, weight: 60 }
const OFF = { perms: { autoProgression: false } }
const ON = { perms: { autoProgression: true } }

describe('policyFor — the club\'s default', () => {
  it('rep-based exercises: linear unless the club said false', () => {
    expect(policyFor(cfg, null, 'reps')).toBe('linear')                     // no state at all: upstream's
    expect(policyFor(cfg, null, 'reps', {})).toBe('linear')                 // a state with no perms
    expect(policyFor(cfg, null, 'reps', { perms: {} })).toBe('linear')      // perms without the key (an older server)
    expect(policyFor(cfg, null, 'reps', ON)).toBe('linear')
    expect(policyFor(cfg, null, 'reps', OFF)).toBe('off')
  })

  it('only an explicit false turns it off', () => {
    for (const autoProgression of [undefined, null, 0, '', 'no', true, 1]) {
      expect(clubAutoProgression({ perms: { autoProgression } })).toBe(true)
    }
    expect(clubAutoProgression({ perms: { autoProgression: false } })).toBe(false)
    expect(clubAutoProgression(undefined)).toBe(true)
  })

  it('an exercise\'s own rule wins, and so does its routine\'s', () => {
    expect(policyFor({ ...cfg, prog: 'double' }, null, 'reps', OFF)).toBe('double')
    expect(policyFor({ ...cfg, prog: 'linear' }, null, 'reps', OFF)).toBe('linear')
    expect(policyFor(cfg, { id: 'r', prog: 'greyskull' }, 'reps', OFF)).toBe('greyskull')
    expect(policyFor({ ...cfg, prog: 'off' }, { id: 'r', prog: 'linear' }, 'reps', ON)).toBe('off')
  })

  it('timed and cardio work never progressed by default, club or not', () => {
    expect(policyFor({ id: LIFT, mode: 'time', sets: 2, sec: 45 }, null, 'time', ON)).toBe('off')
    expect(policyFor({ id: LIFT, mode: 'time', sets: 2, sec: 45 }, null, 'time', OFF)).toBe('off')
  })
})

describe('nextPrescription — nothing moves on its own when the club said so', () => {
  const session = (d, w) => ({ d, routineId: 'r', routineIds: ['r'], entries: [{ id: LIFT, target: { sets: 3, reps: 5, weight: w }, sets: [0, 1, 2].map(() => ({ w, r: 5, done: true })) }] })
  const state = perms => ({ unit: 'kg', perms, workouts: [session('2026-01-01', 60), session('2026-01-03', 60)] })

  it('a clean session raises the weight by default and under a club that allows it', () => {
    expect(nextPrescription(state(undefined), cfg, null).kind).toBe('up')
    expect(nextPrescription(state(ON.perms), cfg, null).kind).toBe('up')
  })
  it('the same session leaves the target where it was under a club that said false', () => {
    const plan = nextPrescription(state(OFF.perms), cfg, null)
    expect(plan.kind).toBe('off')
    expect(plan.weight).toBeUndefined()
  })
  it('an exercise or a routine that asks for a rule keeps it, whatever the club\'s default', () => {
    expect(nextPrescription(state(OFF.perms), { ...cfg, prog: 'linear' }, null).kind).toBe('up')
    expect(nextPrescription(state(OFF.perms), cfg, { id: 'r', prog: 'linear' }).kind).toBe('up')
  })
})
