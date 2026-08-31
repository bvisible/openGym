// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The level of detail asked for by the client on 2026-08-31. What is worth
//// pinning is not that a card is hidden — it is the RESOLUTION ORDER, because
//// getting it wrong is silent: a club that never set a default would simplify
//// every member's journal, or a member's own choice would be ignored.

import { describe, expect, it } from 'vitest'
import { DEF, atLeast, isSimple, levelOf, shouldAskWeighIn } from './useStore.js'

describe('level of detail', () => {
  it('shows the full journal when nobody has chosen', () => {
    expect(levelOf({})).toBe('full')
    expect(levelOf({ perms: {} })).toBe('full')
    expect(isSimple({})).toBe(false)
  })

  it('follows the club default when the member has not chosen', () => {
    expect(levelOf({ level: null, perms: { defaultLevel: 'simple' } })).toBe('simple')
    expect(isSimple({ level: null, perms: { defaultLevel: 'simple' } })).toBe(true)
  })

  it('lets the member override the club, in both directions', () => {
    expect(levelOf({ level: 'full', perms: { defaultLevel: 'simple' } })).toBe('full')
    expect(levelOf({ level: 'simple', perms: { defaultLevel: 'full' } })).toBe('simple')
  })

  it('has three levels, ranked', () => {
    // The client asked for simple / intermédiaire / avancé. Two was a
    // misreading, and the middle one is where most members sit.
    expect(levelOf({ level: 'normal' })).toBe('normal')
    expect(atLeast({ level: 'normal' }, 'simple')).toBe(true)
    expect(atLeast({ level: 'normal' }, 'normal')).toBe(true)
    expect(atLeast({ level: 'normal' }, 'full')).toBe(false)
    expect(atLeast({ level: 'full' }, 'normal')).toBe(true)
  })

  it('never simplifies on a falsy or unknown value', () => {
    // The trap this guards: a truthiness test would read "" or 0 as a choice,
    // and an unknown string as "not full" if the comparison were inverted.
    for (const value of ['', 0, undefined, null, 'whatever']) {
      expect(isSimple({ level: value })).toBe(false)
    }
  })

  it('is null by default, so a club changing its mind still reaches the member', () => {
    // If DEF carried 'full', a member who never touched the setting would be
    // pinned to it and the club's default would never apply again.
    expect(DEF.level).toBeNull()
  })
})


describe('being asked to weigh in', () => {
  it('does not ask by default', () => {
    // Body weight is a sensitive subject: nobody is made to look at a number
    // before training. The Log button on Home still works.
    expect(DEF.weighInEvery).toBe('never')
    expect(shouldAskWeighIn({})).toBe(false)
    expect(shouldAskWeighIn({ bodyweight: [] })).toBe(false)
  })

  it('asks every session only when the member chose that', () => {
    expect(shouldAskWeighIn({ weighInEvery: 'workout', bodyweight: [{ d: '2026-08-31', t: Date.now() }] })).toBe(true)
  })

  it('on weekly, does not ask somebody who weighed in this morning', () => {
    const today = { d: '2026-08-31', t: Date.now() - 3600000 }
    expect(shouldAskWeighIn({ weighInEvery: 'week', bodyweight: [today] })).toBe(false)
  })

  it('on weekly, asks again once the last entry is old', () => {
    const old = { d: '2026-08-01', t: Date.now() - 10 * 86400000 }
    expect(shouldAskWeighIn({ weighInEvery: 'week', bodyweight: [old] })).toBe(true)
  })

  it('on weekly, asks once from somebody who never weighed in', () => {
    expect(shouldAskWeighIn({ weighInEvery: 'week', bodyweight: [] })).toBe(true)
  })
})
