// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). A member whose plan the club writes
//// (S.perms.editPlan === false, from Gym Member Profile on the club's server) reads a routine and
//// changes nothing in it: the server refuses the member's routines, so a change made here lived on
//// the phone only. Seen in Chrome on 08.10: every control was offered to such a member. And the
//// progression a routine shows is the one the engine applies: the club's sample program wrote
//// « none », shown raw over the description of linear progression.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { POLICY_DESC, POLICY_NAME } from '../lib/progression.js'
import { exConfigSheet, exerciseDetailSheet } from '../sheets.jsx'

vi.mock('../lib/api.js', () => ({ BOOT: {}, api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn(), exerciseDetailSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

let root, container

function renderRoutine(routine = {}, perms = null) {
  if (root) { act(() => root.unmount()); container.remove() }
  const S = clone(DEF)
  S.routines = [{ id: 'r1', name: 'Lower body', emoji: 'dumbbell', ex: [
    { id: '0001', sets: 3, reps: 12, mode: 'reps' },
    { id: '0002', sets: 3, reps: 12, mode: 'reps' },
  ], ...routine }]
  if (perms) S.perms = perms
  useStore.setState({ S, user: null })
  container = document.createElement('div')
  document.body.appendChild(container)
  root = createRoot(container)
  act(() => root.render(
    <MemoryRouter initialEntries={['/routine/r1']}>
      <Routes><Route path="/routine/:id" element={<RoutineEdit />} /></Routes>
    </MemoryRouter>
  ))
}

const labels = () => [...container.querySelectorAll('button')].map(b => (b.getAttribute('aria-label') || b.textContent).trim())
const rowTitled = title => [...container.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)
const note = () => container.querySelector('.sect-b + .small.dim').textContent

beforeEach(() => { localStorage.clear(); vi.clearAllMocks() })
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = null
  container = null
})

describe('a routine of a plan the club writes', () => {
  it('is read, and nothing in it can be changed', () => {
    //: First the member who may edit: every control is there, so the locked case cannot pass for
    //: the wrong reason.
    renderRoutine({}, { editPlan: true })
    expect(container.querySelector('input.input')).toBeTruthy()
    for (const control of ['Pick an icon', 'Add exercise', 'Move up', 'Move down', 'Copy routine', 'Delete routine']) expect(labels()).toContain(control)
    expect(rowTitled('Deload routine').querySelector('[role="switch"]')).toBeTruthy()

    renderRoutine({}, { editPlan: false })
    expect(container.querySelector('input.input')).toBe(null)
    expect(container.querySelector('h1').textContent).toBe('Lower body')
    expect(container.textContent).toContain('Your coach writes your plan.')
    for (const control of ['Pick an icon', 'Add exercise', 'Move up', 'Move down', 'Superset with exercise above', 'Copy routine', 'Delete routine']) expect(labels()).not.toContain(control)
    expect(labels()).toContain('Print / Save as PDF')
    expect(container.querySelector('.routine-grip')).toBe(null)
    expect(container.querySelector('[role="switch"]')).toBe(null)
    expect(rowTitled('Progression').querySelector('.lrow-v').textContent).toBe(POLICY_NAME.linear)
  })

  it('opens an exercise to read it, not its settings in the routine', () => {
    renderRoutine({}, { editPlan: false })
    act(() => container.querySelector('.item-open').click())
    expect(exerciseDetailSheet).toHaveBeenCalledTimes(1)
    expect(exConfigSheet).not.toHaveBeenCalled()

    renderRoutine({}, { editPlan: true })
    act(() => container.querySelector('.item-open').click())
    expect(exConfigSheet).toHaveBeenCalledTimes(1)
  })

  it('still says it is a deload routine, without the switch', () => {
    renderRoutine({ excludeFromProgression: true }, { editPlan: false })
    expect(rowTitled('Deload routine')).toBeTruthy()
    expect(rowTitled('Deload routine').querySelector('[role="switch"]')).toBe(null)
  })
})

describe('the progression a routine shows', () => {
  it('is the rule the engine applies: one it does not know is no progression', () => {
    renderRoutine({ prog: 'none' })
    expect(rowTitled('Progression').querySelector('.lrow-v').textContent).toBe(POLICY_NAME.off)
    expect(note()).toBe(POLICY_DESC.off + ' Applies to every exercise in this routine that does not set its own rule.')
  })
})
