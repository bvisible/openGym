// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The level of detail asked for by the client on 2026-08-31. What is worth
//// pinning is not that a card is hidden — it is the RESOLUTION ORDER, because
//// getting it wrong is silent: a club that never set a default would simplify
//// every member's journal, or a member's own choice would be ignored.

import { describe, expect, it } from 'vitest'
import { DEF, isSimple, levelOf } from './useStore.js'

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
