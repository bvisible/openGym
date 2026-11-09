// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). A club that rules a member does not decline what their coach sends
//// (Gym Settings member_can_decline_program → perms.declineProgram) gets no « Not now » in the offer: the server would refuse
//// it. The member may put the offer off (« Later »), nothing is sent. An older server, which sends no flag, keeps the decline.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const api = vi.hoisted(() => ({ decline: vi.fn(() => Promise.resolve({})), accept: vi.fn(() => Promise.resolve({})) }))
vi.mock('./lib/api.js', async importOriginal => ({
  ...await importOriginal(),
  programDecline: api.decline,
  programAccept: api.accept,
}))

import { coachOfferSheet, canDecline } from './sheets.jsx'

const clone = v => JSON.parse(JSON.stringify(v))
const mounted = []
const offer = {
  id: 'GPA-1', program: 'PROG-1', version: 1, coach: 'Coach', message: '',
  bundle: { opengym_plan: 1, name: 'Paul V2', week: {}, routines: [{ id: 'r1', name: 'Jours 1', ex: [{ id: '0001', sets: 3, reps: 10 }] }], customEx: [] },
}

function mountTopSheet() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent.trim())
const install = perms => {
  const st = clone(DEF)
  Object.assign(st, { routines: [], workouts: [], week: {}, perms })
  useStore.setState({ S: st, user: null })
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toasts: [] })
  document.body.innerHTML = ''
  api.decline.mockClear()
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('the offer of a program from the coach', () => {
  it('offers to decline when the club allows it, and when the server says nothing', () => {
    expect(canDecline({ perms: { declineProgram: true } })).toBe(true)
    expect(canDecline({ perms: {} })).toBe(true)
    expect(canDecline({})).toBe(true)
    install({ declineProgram: true })
    act(() => coachOfferSheet(offer))
    expect(buttons(mountTopSheet())).toContain('Not now')
  })

  it('never offers a decline the club forbids: the member puts it off, and nothing is sent', () => {
    expect(canDecline({ perms: { declineProgram: false } })).toBe(false)
    install({ declineProgram: false })
    act(() => coachOfferSheet(offer))
    const host = mountTopSheet()
    expect(buttons(host)).not.toContain('Not now')
    const later = [...host.querySelectorAll('button')].find(b => b.textContent.trim() === 'Later')
    expect(later).toBeTruthy()
    act(() => later.click())
    expect(api.decline).not.toHaveBeenCalled()
    expect(useUI.getState().sheets.length).toBe(0)
  })
})
