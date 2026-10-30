// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The round account button at the top right of the places of the bar (components/AccountButton.jsx).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import AccountButton from './AccountButton.jsx'
import { DEF, useStore } from '../store/useStore.js'

const nav = vi.hoisted(() => vi.fn())
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, originalS, originalUser, originalSync
beforeEach(() => {
  const st = useStore.getState()
  originalS = st.S; originalUser = st.user; originalSync = st.sync
  useStore.setState({ S: JSON.parse(JSON.stringify(DEF)), user: { id: 1, name: 'Grace Bébé' } })
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
  nav.mockClear()
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS, user: originalUser, sync: originalSync })
})
const button = () => host.querySelector('.acct-btn')
const mount = () => act(() => { root.render(<AccountButton />) })

describe('the account button', () => {
  it('shows the member’s initials and opens the settings', () => {
    mount()
    expect(button().textContent).toBe('GB')
    expect(button().getAttribute('aria-label')).toBe('My account')
    act(() => { button().click() })
    expect(nav).toHaveBeenCalledWith('/settings')
  })

  it('takes the first and last word of a long name, and a single word alone', () => {
    useStore.setState({ user: { id: 1, name: 'Jean de la Fontaine' } })
    mount()
    expect(button().textContent).toBe('JF')
    act(() => { useStore.setState({ user: { id: 1, name: 'Alexandra' } }) })
    expect(button().textContent).toBe('A')
  })

  it('does not break on a member with no name', () => {
    useStore.setState({ user: { id: 1, name: '' } })
    mount()
    expect(button().textContent).toBe('·')
  })

  // Settings → « Show connection status » off: a stuck sync is a dot on the button, and the button's name says it (it was the Home gear's dot, then the Account tab's).
  it('carries the connection dot only while the banner is switched off and the sync is stuck', () => {
    useStore.setState({ sync: { status: 'error', lastError: { status: 502 }, pending: true } })
    mount()
    expect(button().querySelector('.tab-dot')).toBeNull()
    act(() => { useStore.getState().update(s => { s.connStatus = false }, false) })
    expect(button().querySelector('.tab-dot')).not.toBeNull()
    expect(button().getAttribute('aria-label')).toBe('My account, Connection problem')
    act(() => { useStore.setState({ sync: { status: 'ok', lastError: null, pending: false } }) })
    expect(button().querySelector('.tab-dot')).toBeNull()
    expect(button().getAttribute('aria-label')).toBe('My account')
  })
})
