// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// What the v1.4.5 merge's screen pass found on osiris (the club's journeys, text of each screen before and after the merge):
//// at the SIMPLE level the empty History offered « Log recovery » (the button above the list followed showsRecoveryLog, the one
//// in the empty state did not), and on the web journal the Measurements page offered « Check-in reminders », a row that only
//// upstream's push server would act on. Both are pinned here.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import History from './History.jsx'
import { CheckinReminderRow } from '../components/CheckinReminder.jsx'

vi.mock('react-router-dom', () => ({ useNavigate: () => () => {}, useLocation: () => ({ pathname: '/history', search: '' }) }))

const mounted = []
const render = (el, level) => {
  useStore.setState(s => ({ S: { ...s.S, level, workouts: [], routines: [], bodyweight: [], customEx: [], recovery: [], active: null } }))
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(el))
  return host
}
const words = host => [...host.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(root => root.unmount()) }) })

describe('an empty History', () => {
  it('offers no recovery to log at the Simple level', () => {
    expect(words(render(React.createElement(History), 'simple'))).not.toContain('Log recovery')
  })
  it('offers it from Normal', () => {
    expect(words(render(React.createElement(History), 'normal'))).toContain('Log recovery')
  })
})

describe('the check-in reminders row on the web journal', () => {
  it('is not drawn: nothing on a club instance would send the reminder', () => {
    const host = render(React.createElement(CheckinReminderRow), 'full')
    expect(host.textContent).not.toContain('Check-in reminders')
  })
})
