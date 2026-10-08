// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The exercise sheet's « Add to my plan » puts the
//// exercise in a routine (or a new one): a change of plan, which the club's server refuses from a
//// member whose plan the club writes (S.perms.editPlan === false). Found on 08.10 while testing that
//// lock in Chrome: the sheet offered it anyway. It now says why in its place.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exerciseDetailSheet } from './sheets.jsx'

const mounted = []

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const buttons = host => [...host.querySelectorAll('button')].map(b => b.textContent.trim())

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  document.body.innerHTML = ''
})
afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
})

describe('the exercise sheet and the club’s lock on the plan', () => {
  it('offers « Add to my plan » to a member who may change their plan', () => {
    useStore.setState({ S: { ...structuredClone(DEF), perms: { editPlan: true } }, user: null })
    exerciseDetailSheet(EXDB[0])
    expect(buttons(renderTop())).toContain('Add to my plan')
  })

  it('says why instead, to a member whose plan the club writes', () => {
    useStore.setState({ S: { ...structuredClone(DEF), perms: { editPlan: false } }, user: null })
    exerciseDetailSheet(EXDB[0])
    const host = renderTop()
    expect(buttons(host)).not.toContain('Add to my plan')
    expect(host.textContent).toContain('Your coach writes your plan.')
  })

  it('offers it when the state says nothing of the lock (composed before it existed)', () => {
    useStore.setState({ S: structuredClone(DEF), user: null })
    exerciseDetailSheet(EXDB[0])
    expect(buttons(renderTop())).toContain('Add to my plan')
  })
})
