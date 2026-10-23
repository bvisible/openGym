// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE ROUTINE SCREEN AT EACH DETAIL LEVEL, AND WHAT A ROUTINE WITH NO RULE OF ITS OWN APPLIES.
//// At Simple the « Progression » row and the « Deload routine » row are not drawn (a member who trains
//// a plan does not need to choose how the numbers move); they come back from Normal up, and stay
//// at Simple once the routine already carries a rule or is a deload routine ("hide the CONTROL,
//// never the DATA", lib/level-visibility.js). A routine with no rule of its own applies the club's
//// default (S.perms.autoProgression, lib/progression.js clubAutoProgression); an absent key is the
//// legacy « linear ».
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import RoutineEdit from './RoutineEdit.jsx'
import { DEF, useStore } from '../store/useStore.js'
import { POLICY_DESC, POLICY_NAME } from '../lib/progression.js'

vi.mock('../lib/api.js', () => ({ BOOT: {}, api: vi.fn(() => Promise.resolve({})) }))
vi.mock('../sheets.jsx', () => ({ glyphPicker: vi.fn(), exercisePicker: vi.fn(), exConfigSheet: vi.fn(), confirmSheet: vi.fn() }))
vi.mock('../components/Media.jsx', () => ({ Thumb: () => null }))
vi.mock('../components/BodyMap.jsx', () => ({ default: () => null }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
const clone = value => JSON.parse(JSON.stringify(value))

let root
let container

function renderRoutine({ level = 'full', perms, routine = {}, customEx } = {}) {
  const S = clone(DEF)
  S.level = level
  if (customEx) S.customEx = customEx
  if (perms) S.perms = { ...(S.perms || {}), ...perms }
  S.routines = [{ id: 'r1', name: 'Push', emoji: 'dumbbell', ex: [], ...routine }]
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

const rowTitled = title => [...container.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)

beforeEach(() => { localStorage.clear() })
afterEach(() => {
  if (root) act(() => root.unmount())
  if (container) container.remove()
  root = null
  container = null
})

describe('the routine screen at each detail level', () => {
  it('Simple: no « Progression » row, no « Deload routine » row, nothing about progression under the list', () => {
    renderRoutine({ level: 'simple' })
    expect(rowTitled('Progression')).toBeUndefined()
    expect(rowTitled('Deload routine')).toBeUndefined()
    expect(container.textContent).not.toContain('Applies to every exercise in this routine that does not set its own rule.')
  })

  it.each(['normal', 'full'])('%s: both rows are there', level => {
    renderRoutine({ level })
    expect(rowTitled('Progression')).toBeTruthy()
    expect(rowTitled('Deload routine')).toBeTruthy()
  })

  it('Simple keeps the rows for a routine that already has a rule of its own', () => {
    renderRoutine({ level: 'simple', routine: { prog: 'double' } })
    expect(rowTitled('Progression')).toBeTruthy()
  })

  it('Simple keeps the rows for a deload routine', () => {
    renderRoutine({ level: 'simple', routine: { excludeFromProgression: true } })
    expect(rowTitled('Deload routine')).toBeTruthy()
  })
})

describe('what a routine with no rule of its own applies', () => {
  it('the club turned automatic progression off: no automatic progression', () => {
    renderRoutine({ perms: { autoProgression: false } })
    expect(rowTitled('Progression').textContent).toContain(POLICY_NAME.off)
    expect(container.textContent).toContain(POLICY_DESC.off + ' Applies to every exercise in this routine that does not set its own rule.')
  })

  it('the club turned it on: linear progression', () => {
    renderRoutine({ perms: { autoProgression: true } })
    expect(rowTitled('Progression').textContent).toContain(POLICY_NAME.linear)
  })

  it('no club key at all (legacy): linear progression', () => {
    renderRoutine({})
    expect(rowTitled('Progression').textContent).toContain(POLICY_NAME.linear)
  })

  it('a rule written on the routine wins over the club default', () => {
    renderRoutine({ perms: { autoProgression: false }, routine: { prog: 'linear' } })
    expect(rowTitled('Progression').textContent).toContain(POLICY_NAME.linear)
  })
})

describe('the link between two exercises, at every level', () => {
  //// The pilot club (23.10): the coach links two or three exercises for beginners with the paperclip, so Simple offers it.
  const custom = id => ({ id, n: id, bp: 'chest', eq: 'body weight', tg: 'chest', custom: true })
  const row = id => ({ id, sets: 3, reps: 8 })
  const three = () => ({ ex: [row('c1'), row('c2'), row('c3')] })
  const links = () => [...container.querySelectorAll('button[title="Superset with exercise above"]')]
  const mount = (level, routine) => renderRoutine({ level, routine, customEx: ['c1', 'c2', 'c3'].map(custom) })

  it.each(['simple', 'normal', 'full'])('%s: a link on every row but the first, and the hint that goes with it', level => {
    mount(level, three())
    expect(links()).toHaveLength(2)
    expect(container.textContent).toContain('Tap the link button on an exercise to superset it with the one above.')
  })

  it('Simple chains three exercises with two taps, and the second tap does not undo the first', () => {
    mount('simple', three())
    act(() => { links()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    act(() => { links()[1].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const ex = useStore.getState().S.routines[0].ex
    expect(ex[0].sg).toBeTruthy()
    expect(ex[1].sg).toBe(ex[0].sg)
    expect(ex[2].sg).toBe(ex[0].sg)
  })

  it('Simple takes a link away again with the same tap', () => {
    mount('simple', { ex: [{ ...row('c1'), sg: 'sg1' }, { ...row('c2'), sg: 'sg1' }, row('c3')] })
    act(() => { links()[0].dispatchEvent(new MouseEvent('click', { bubbles: true })) })
    const ex = useStore.getState().S.routines[0].ex
    expect(ex.map(e => e.sg)).toEqual([undefined, undefined, undefined])
  })
})
