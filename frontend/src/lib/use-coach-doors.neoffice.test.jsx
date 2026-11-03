// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The doors to a coach follow Settings → Modules: the AI Coach switched off is no Nora (the bar's « Coach » place and the Coach screen's
//// first door go with it, as the routes do in lib/use-coach-gate.js), while the club's own coach is not a module — their thread stays.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEF, useStore } from '../store/useStore.js'
import { useCoachDoors } from './use-coach-doors.js'

const m = vi.hoisted(() => ({ coach: null }))
vi.mock('./api.js', () => ({ myCoach: vi.fn(() => Promise.resolve({ coach: m.coach })) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, doors
const Probe = () => { doors = useCoachDoors(); return null }
const clone = v => JSON.parse(JSON.stringify(v))
async function mount(S) {
  useStore.setState({ S, user: { id: 'member@example.test', name: 'Member' }, config: { coach: { enabled: true } } })
  host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host)
  await act(async () => { root.render(<Probe />) })
}
beforeEach(() => { localStorage.clear(); m.coach = null })
afterEach(() => { act(() => root.unmount()); host.remove(); useStore.setState({ config: null, user: null }) })

describe('the doors to a coach', () => {
  it('Nora is a door while the club has her on and the member keeps the AI Coach on', async () => {
    await mount(clone(DEF))
    expect(doors).toMatchObject({ nora: true, any: true })
  })

  it('the AI Coach module switched off: no Nora, the club\'s coach unchanged', async () => {
    m.coach = { reachable: true }
    const S = clone(DEF); S.modules = { coach: false }
    await mount(S)
    expect(doors.nora).toBe(false)
    expect(doors.human).toBe(true)
    expect(doors.any).toBe(true)
  })

  it('the club\'s default preset « Just training » has no Nora for a member who has not chosen', async () => {
    const S = clone(DEF); S.perms = { ...(S.perms || {}), defaultModules: 'training' }
    await mount(S)
    expect(doors.nora).toBe(false)
  })
})
