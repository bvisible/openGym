//// Neoffice — added file (no upstream equivalent). The sessions Home shows under « Recent workouts »: newest day first, History's order.
import { describe, expect, it } from 'vitest'
import { lastWorkouts } from './recent-workouts.js'

const w = (id, d) => ({ id, d })

describe('lastWorkouts', () => {
  it('is the three newest days, newest first', () => {
    const S = { workouts: [w('a', '2026-09-01'), w('b', '2026-09-05'), w('c', '2026-09-03'), w('d', '2026-09-09'), w('e', '2026-09-07')] }
    expect(lastWorkouts(S).map(x => x.id)).toEqual(['d', 'e', 'b'])
    expect(lastWorkouts(S, 2).map(x => x.id)).toEqual(['d', 'e'])
  })

  it('within a day, the one stored last comes first (History\'s order)', () => {
    const S = { workouts: [w('a', '2026-09-05'), w('b', '2026-09-05'), w('c', '2026-09-04')] }
    expect(lastWorkouts(S).map(x => x.id)).toEqual(['b', 'a', 'c'])
  })

  it('reads a state with nothing, or a damaged list, as nothing', () => {
    expect(lastWorkouts(undefined)).toEqual([])
    expect(lastWorkouts({})).toEqual([])
    expect(lastWorkouts({ workouts: [null, w('a', '2026-09-05'), undefined] }).map(x => x.id)).toEqual(['a'])
  })

  it('does not change the member\'s list', () => {
    const S = { workouts: [w('a', '2026-09-01'), w('b', '2026-09-05')] }
    lastWorkouts(S)
    expect(S.workouts.map(x => x.id)).toEqual(['a', 'b'])
  })
})
