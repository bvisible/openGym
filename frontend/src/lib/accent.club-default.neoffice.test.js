// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). Replaces upstream v1.4.5's accent.migration.test.js, whose premise is not ours:
//// upstream starts a new profile on its brand green and keeps the old green for every profile that never picked one. Here both
//// follow the CLUB's colour (lib/accent.js CLUB): a club sets it once, its members open the journal in it without choosing anything
//// (the pilot club, 17.10). The v1.4.5 merge had a new member start on openGym's green; this pins that it never does again.
import { describe, expect, it, vi } from 'vitest'

vi.mock('./api.js', () => ({ api: vi.fn(), setRemoteAuth: vi.fn(), BOOT: {} }))
vi.mock('../store/useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { DEF, freshState } from '../store/useStore.js'
import { CLUB, NEW_ACCENT, sanitizeAccent } from './accent.js'

const clone = v => JSON.parse(JSON.stringify(v))

describe('a journal follows its club’s colour until the member picks another', () => {
  it('a profile started from nothing wears the club’s colour', () => {
    expect(NEW_ACCENT).toBe(CLUB)
    expect(freshState().accent).toBe(CLUB)
  })
  it('a copy that carries no accent (an old one, a server document, a backup) is laid over DEF and follows the club too', () => {
    expect(DEF.accent).toBe(CLUB)
    const loaded = Object.assign(clone(DEF), { workouts: [], routines: [] })
    expect(loaded.accent).toBe(CLUB)
  })
  it('a member’s own pick is kept', () => {
    expect(sanitizeAccent({ accent: 'sky' }).accent).toBe('sky')
  })
})
