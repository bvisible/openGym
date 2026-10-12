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

function renderRoutine({ level = 'full', perms, routine = {} } = {}) {
  const S = clone(DEF)
  S.level = level
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
