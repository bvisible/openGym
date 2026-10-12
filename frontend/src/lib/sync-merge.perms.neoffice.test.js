//// Neoffice — added file (no upstream equivalent).
////
//// The club's rules travel in `perms` (neoffice_gym api/sync.py `_compose_perms`), and a new key in it — the missed-day relance, the club's
//// default for automatic progression — must reach a device that has already synced, not only a fresh one. Two facts pinned here:
////   1. nothing in the merge filters the keys of `perms` (no whitelist): what the server sends is what the journal reads;
////   2. but the merge keeps the DEVICE's `perms` whenever its `_ts` is not older than the server's — and after a push it never is — so a
////      pull's merge now takes the server-owned keys (`perms`, `club`, `clubPicks`) from the server's document (takeServerOwned).
import { describe, expect, it } from 'vitest'
import { mergeStates, takeServerOwned, SERVER_OWNED_KEYS } from './sync-merge.js'

const state = (ts, extra = {}) => ({ unit: 'kg', workouts: [], routines: [], _ts: ts, ...extra })
const OLD = { defaultLevel: 'full', editPlan: true }
const NEW = { defaultLevel: 'simple', editPlan: true, nudge: { enabled: true, after: 4, once: true }, autoProgression: false }

describe('the club\'s rules in a pull', () => {
  it('without the rule, a device that is as new as the server keeps its OLD perms through the merge (why takeServerOwned exists)', () => {
    for (const [mine, theirs] of [[100, 100], [200, 100]]) {
      expect(mergeStates(state(mine, { perms: OLD }), state(theirs, { perms: NEW })).perms).toEqual(OLD)
    }
  })

  it('when the server is newer, the whole of its perms arrives, new keys included (no whitelist)', () => {
    expect(mergeStates(state(100, { perms: OLD }), state(200, { perms: NEW })).perms).toEqual(NEW)
  })

  it('takeServerOwned: the server\'s perms, club and clubPicks win over whichever copy won the tie', () => {
    const local = state(200, { perms: OLD, club: { title: 'Old' }, clubPicks: ['0001'], reminder: { on: true } })
    const remote = state(100, { perms: NEW, club: { title: 'New' }, clubPicks: ['0001', '0002'], reminder: { on: false } })
    const merged = takeServerOwned(mergeStates(local, remote), remote)
    expect(merged.perms).toEqual(NEW)
    expect(merged.perms.nudge).toEqual({ enabled: true, after: 4, once: true })
    expect(merged.perms.autoProgression).toBe(false)
    expect(merged.club).toEqual({ title: 'New' })
    expect(merged.clubPicks).toEqual(['0001', '0002'])
    // …and nothing else is the server's to decide here: the member's own setting stays the newer copy's
    expect(merged.reminder).toEqual({ on: true })
  })

  it('a server document that says nothing about them leaves the device\'s alone, and the merged copy is a copy', () => {
    const local = state(100, { perms: OLD, clubPicks: ['0001'] })
    const remote = state(100)
    const merged = takeServerOwned(mergeStates(local, remote), remote)
    expect(merged.perms).toEqual(OLD)
    expect(merged.clubPicks).toEqual(['0001'])
    const withPerms = takeServerOwned(mergeStates(local, remote), state(100, { perms: NEW }))
    withPerms.perms.nudge.after = 7
    expect(NEW.nudge.after).toBe(4)
    expect(SERVER_OWNED_KEYS).toEqual(['perms', 'club', 'clubPicks'])
    expect(takeServerOwned(null, remote)).toBeNull()
    expect(takeServerOwned(merged, null)).toBe(merged)
  })
})
