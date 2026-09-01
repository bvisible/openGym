// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// A starting load, and above all the cases where there must NOT be one.
////
//// The failure this pins is not "the suggestion was 2.5 kg off". It is
//// suggesting a weight to somebody the app knows nothing about — which either
//// puts a bar they cannot press over their chest, or teaches them that the
//// number means something. Silence is the correct answer far more often than
//// a number is, and silence is what a refactor quietly turns into a guess.

import { describe, expect, it } from 'vitest'
import { suggestStartingLoad, roundDownToPlate } from './starting-load.js'
import { EXIDX } from './exercises.js'

//// Real catalogue rows rather than invented ones: the module matches on `tg`
//// and `eq`, so a fabricated pair would test my fixture's agreement with
//// itself instead of the catalogue's.
const pick = (n = 3) => {
  const byPair = {}
  for (const id of Object.keys(EXIDX)) {
    const ex = EXIDX[id]
    const key = ex.tg + '|' + ex.eq
    ;(byPair[key] ||= []).push(id)
  }
  const key = Object.keys(byPair).find(k => byPair[k].length >= n)
  return byPair[key]
}

const workout = (id, weight) => ({
  d: '2026-08-20', t: Date.parse('2026-08-20'),
  entries: [{ id, sets: [{ w: weight, r: 8, done: true }] }],
})

describe('rounding', () => {
  it('rounds DOWN, never to nearest', () => {
    // The one direction this module may not be wrong in: 22.5 must not become
    // 25 kg on somebody's first attempt at a movement.
    expect(roundDownToPlate(24, 2.5)).toBe(22.5)
    expect(roundDownToPlate(22.4, 2.5)).toBe(20)
    expect(roundDownToPlate(0)).toBe(0)
    expect(roundDownToPlate(1, 2.5)).toBe(2.5)   // never below one plate
  })
})

describe('when there is nothing honest to say', () => {
  it('says nothing to a brand-new member', () => {
    // The common case, and the one that must stay quiet: no history at all.
    const S = { workouts: [] }
    expect(suggestStartingLoad(S, Object.keys(EXIDX)[0])).toBeNull()
  })

  it('says nothing when the member has only done unrelated exercises', () => {
    const ids = pick()
    const other = Object.keys(EXIDX).find(id =>
      EXIDX[id].tg !== EXIDX[ids[0]].tg && EXIDX[id].eq !== EXIDX[ids[0]].eq)
    const S = { workouts: [workout(other, 80)] }
    expect(suggestStartingLoad(S, ids[0])).toBeNull()
  })

  it('says nothing about an exercise the member has already done', () => {
    // That is history, and progression owns it — answering here would fight
    // the progression rules with a number derived from somewhere else.
    const ids = pick()
    const S = { workouts: [workout(ids[0], 50)] }
    expect(suggestStartingLoad(S, ids[0])).toBeNull()
  })

  it('ignores sets that were logged without a weight', () => {
    const ids = pick()
    const S = { workouts: [{ d: '2026-08-20', t: 1, entries: [{ id: ids[1], sets: [{ w: 0, r: 10, done: true }] }] }] }
    expect(suggestStartingLoad(S, ids[0])).toBeNull()
  })
})

describe('when there is', () => {
  it('derives it from a comparable exercise and names the source', () => {
    const ids = pick()
    const S = { workouts: [workout(ids[1], 40)] }
    const hint = suggestStartingLoad(S, ids[0])
    expect(hint).toBeTruthy()
    expect(hint.weight).toBe(40)
    //// Naming the source is not decoration: it is what lets the member judge
    //// the reasoning instead of trusting a number.
    expect(hint.fromId).toBe(ids[1])
    expect(hint.fromName).toBeTruthy()
  })

  it('takes the LIGHTEST comparable exercise, not the best or the average', () => {
    // Starting under is a set that felt easy. Starting over is an injury.
    const ids = pick()
    const S = { workouts: [workout(ids[1], 80), workout(ids[2], 30)] }
    expect(suggestStartingLoad(S, ids[0]).weight).toBe(30)
  })

  it('rounds the answer down to something loadable', () => {
    const ids = pick()
    const S = { workouts: [workout(ids[1], 34)] }
    expect(suggestStartingLoad(S, ids[0]).weight).toBe(32.5)
  })

  it('does not count warm-up rows', () => {
    //// Written so it can FAIL. My first version put a 20 kg ramp under a 60 kg
    //// work set and asserted 60 — which passes whether warm-ups are excluded
    //// or not, since the module takes the heaviest set either way. It proved
    //// nothing. Here the ramp is the ONLY row, so counting it would produce a
    //// suggestion where there must be none.
    const ids = pick()
    const S = { workouts: [{
      d: '2026-08-20', t: 1,
      entries: [{ id: ids[1], sets: [{ w: 20, r: 10, done: true, warmup: true }] }],
    }] }
    expect(suggestStartingLoad(S, ids[0])).toBeNull()
  })

  it('reads the work set when a ramp precedes it', () => {
    // The other half: a real session is ramp-then-work, and the work set is the
    // answer. Seeding from the ramp would walk every first attempt down.
    const ids = pick()
    const S = { workouts: [{
      d: '2026-08-20', t: 1,
      entries: [{ id: ids[1], sets: [{ w: 20, r: 10, done: true, warmup: true }, { w: 60, r: 5, done: true }] }],
    }] }
    expect(suggestStartingLoad(S, ids[0]).weight).toBe(60)
  })
})
