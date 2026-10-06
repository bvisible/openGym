// @vitest-environment happy-dom

/* QA, v1.3.9: importing a backup replaced the server copy outright, and a workout another device
   had synced meanwhile was gone. The import stays a deliberate replace, but the server is asked
   first: what it holds that the backup does not is said in the confirm, with the choice to merge
   it in (views/Settings.jsx doImport). */
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => {
  //// Neoffice — our store calls NAMED helpers (getState/getRev/putState/logout/currentUser), not
  //// api() with upstream's paths: the journal talks to Frappe's whitelisted methods. These doubles
  //// speak upstream's protocol through the same mocked api(), so every assertion written against
  //// '/api/data', 'PUT' and `baseRev` holds unchanged (see useStore.adopt.test.jsx).
  const api = vi.fn()
  return {
    //// Neoffice — what our Settings reads from lib/api.js (the coach, the wallet, classes, membership).
    myCoach: vi.fn(() => Promise.resolve(null)), wallet: vi.fn(() => Promise.resolve(null)), classesMine: vi.fn(() => Promise.resolve([])), myMembership: vi.fn(() => Promise.resolve({ shown: false })),
    //// Neoffice — BOOT: the page's boot data (lib/api.js), read by our screens at import.
    BOOT: {}, api, setRemoteAuth: vi.fn(),
    getState: () => api('/api/data'),
    getRev: () => api('/api/data/rev'),
    putState: (state, baseRev) => api('/api/data', { method: 'PUT', body: JSON.stringify(baseRev == null ? { state } : { state, baseRev }) }),
    logout: () => api('/api/logout', { method: 'POST', body: '{}' }),
    currentUser: () => null,
    //// Neoffice — the page boot's session (lib/api.js): the owed sign-out is bound to it.
    sessionMark: () => null, pageSignedIn: () => true, reloadJournal: () => {},
  }
})
vi.mock('./useUI.js', () => ({ useUI: { getState: () => ({ toast: vi.fn() }) } }))

import { api } from '../lib/api.js'
import { DEF, useStore } from './useStore.js'

const clone = v => JSON.parse(JSON.stringify(v))
const ids = xs => (xs || []).map(x => x.id)
const workout = (id, d = '2026-09-20') => ({ id, d, start: 1, end: 2, entries: [] })
const puts = () => api.mock.calls.filter(([, o]) => o?.method === 'PUT').map(([, o]) => JSON.parse(o.body))
const signedIn = (S, rev) => {
  localStorage.setItem('gym_sync', JSON.stringify({ rev, ts: S._ts }))
  useStore.setState({ S, user: { id: 'u1' }, ready: true, sync: { offline: false, pending: false, lastSynced: 0 } })
}
const BACKUP = { ...clone(DEF), _ts: 50, restSec: 120, workouts: [workout('w1'), workout('w2')] }
const SERVER = { ...clone(DEF), _ts: 300, restSec: 60, workouts: [workout('w1'), workout('w2'), workout('elsewhere', '2026-09-26')], _rev: 7 }

beforeEach(() => { localStorage.clear(); api.mockReset() })
afterEach(() => { localStorage.clear(); useStore.setState({ S: clone(DEF), user: null, ready: false }) })

describe('importing a backup over a profile that moved on', () => {
  it('names the workouts on the server that the backup lacks', async () => {
    signedIn({ ...clone(DEF), _ts: 200, workouts: [workout('w1')] }, 6)
    api.mockResolvedValueOnce({ state: clone(SERVER), rev: 7 })
    const c = await useStore.getState().importConflict(BACKUP)
    expect(c).toMatchObject({ workouts: 1, rev: 7 })
  })

  it('nothing to say when the backup has everything, when signed out, or when the server cannot be asked', async () => {
    signedIn(clone(DEF), 6)
    api.mockResolvedValueOnce({ state: clone(BACKUP), rev: 7 })
    expect(await useStore.getState().importConflict(BACKUP)).toBeNull()
    api.mockRejectedValueOnce(new TypeError('Failed to fetch'))
    expect(await useStore.getState().importConflict(BACKUP)).toBeNull()
    useStore.setState({ user: null })
    expect(await useStore.getState().importConflict(BACKUP)).toBeNull()
  })

  it('"Merge them in" keeps the backup\'s settings and every workout of both, pushed against the server\'s revision', async () => {
    signedIn({ ...clone(DEF), _ts: 200, workouts: [workout('w1')] }, 6)
    api.mockResolvedValueOnce({ state: clone(SERVER), rev: 7 })
    const c = await useStore.getState().importConflict(BACKUP)
    api.mockResolvedValueOnce({ ok: true, rev: 8 })
    useStore.getState().importBackup(BACKUP, { mergeWith: c })
    await useStore.getState().pushState()
    const put = puts().at(-1)
    expect(put.baseRev).toBe(7)
    expect(ids(put.state.workouts)).toEqual(['w1', 'w2', 'elsewhere'])
    expect(put.state.restSec).toBe(120)
  })

  // Review of 771184c9: a workout logged here and not yet sent was neither counted nor merged.
  it('counts this device\'s unsent workouts too, and "Merge them in" keeps them', async () => {
    signedIn({ ...clone(DEF), _ts: 200, workouts: [workout('w1')] }, 7)
    useStore.getState().update(s => { s.workouts.push(workout('unsent', '2026-09-27')) })
    api.mockResolvedValueOnce({ state: clone(SERVER), rev: 7 })
    const c = await useStore.getState().importConflict(BACKUP)
    expect(c).toMatchObject({ workouts: 2, local: true })   // 'elsewhere' on the server, 'unsent' here
    api.mockResolvedValueOnce({ ok: true, rev: 8 })
    useStore.getState().importBackup(BACKUP, { mergeWith: c })
    await useStore.getState().pushState()
    expect(ids(puts().at(-1).state.workouts)).toEqual(['w1', 'w2', 'elsewhere', 'unsent'])
  })

  it('"Replace anyway" is the replace it always was', async () => {
    signedIn({ ...clone(DEF), _ts: 200, workouts: [workout('w1')] }, 6)
    api.mockResolvedValueOnce({ ok: true, rev: 8 })
    useStore.getState().importBackup(BACKUP)
    await useStore.getState().pushState()
    const put = puts().at(-1)
    expect(put.baseRev).toBeUndefined()
    expect(ids(put.state.workouts)).toEqual(['w1', 'w2'])
  })
})
