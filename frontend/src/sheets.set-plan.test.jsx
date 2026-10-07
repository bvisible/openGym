// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//
// The exercise sheet's « different reps per set »: a switch, one stepper per set, and what the
// sheet hands back when it is saved — the list, its length as the sets and its first entry as the
// reps — or, for an exercise that HAD a plan and no longer does, an explicit `setPlan: null`
// (the server keeps the plan of an exercise whose push does not mention it).
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet } from './sheets.jsx'

// A weighted machine exercise, as sheets.progression-row.test.jsx uses.
const ex = EXDB.find(e => e.id === '0009')
const mounted = []
const PYRAMID = [{ r: 6 }, { r: 8 }, { r: 10 }, { r: 6 }, { r: 8 }]

function open(existing) {
  const onSave = vi.fn()
  exConfigSheet(ex, { sets: 3, reps: 10, weight: 40, mode: 'reps', ...existing }, onSave)
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return { host, onSave }
}

const stepper = (host, label) => [...host.querySelectorAll('.stp-w')].find(w => w.querySelector('.stp-l')?.textContent === label)
const press = el => act(() => { el.click() })
const more = (host, label, times = 1) => { for (let i = 0; i < times; i++) press(stepper(host, label).querySelectorAll('button')[1]) }
const less = (host, label, times = 1) => { for (let i = 0; i < times; i++) press(stepper(host, label).querySelectorAll('button')[0]) }
const valueOf = (host, label) => stepper(host, label).querySelector('input').value
const rowSwitch = (host, title) => [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === title)?.querySelector('button[role=switch]')
const save = host => press([...host.querySelectorAll('button')].find(b => b.textContent === 'Save'))
const setLabels = host => [...host.querySelectorAll('.stp-l')].map(l => l.textContent).filter(l => /^Set \d+$/.test(l))

describe('the exercise sheet, a different number of reps for each set', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
    document.body.innerHTML = ''
  })
  afterEach(() => {
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  })

  it('is offered for reps work, off to start with, and shows one stepper per set once on', () => {
    const { host } = open({ sets: 3, reps: 10 })
    const toggle = rowSwitch(host, 'Different reps per set')
    expect(toggle).toBeTruthy()
    expect(toggle.getAttribute('aria-checked')).toBe('false')
    expect(setLabels(host)).toEqual([])
    expect(stepper(host, 'Reps')).toBeTruthy()
    press(toggle)
    expect(rowSwitch(host, 'Different reps per set').getAttribute('aria-checked')).toBe('true')
    expect(setLabels(host)).toEqual(['Set 1', 'Set 2', 'Set 3'])
    // the single reps stepper gives way to the rows
    expect(stepper(host, 'Reps')).toBeUndefined()
    expect(host.textContent).toContain('10 · 10 · 10')
  })

  it('saves the plan with its length as the sets and its first entry as the reps', () => {
    const { host, onSave } = open({ sets: 3, reps: 10 })
    press(rowSwitch(host, 'Different reps per set'))
    less(host, 'Set 2', 2)    // 8
    less(host, 'Set 3', 4)    // 6
    expect(host.textContent).toContain('10 · 8 · 6')
    save(host)
    expect(onSave).toHaveBeenCalledTimes(1)
    expect(onSave.mock.calls[0][0]).toMatchObject({ sets: 3, reps: 10, mode: 'reps', weight: 40 })
    expect(onSave.mock.calls[0][0].setPlan).toEqual([{ r: 10 }, { r: 8 }, { r: 6 }])
  })

  it('the sets stepper adds a set that asks what the last one asks, and removes from the end', () => {
    const { host, onSave } = open({ sets: 5, reps: 6, setPlan: PYRAMID })
    expect(setLabels(host)).toHaveLength(5)
    more(host, 'Sets')
    expect(setLabels(host)).toHaveLength(6)
    expect(valueOf(host, 'Set 6')).toBe('8')
    less(host, 'Sets', 2)
    expect(setLabels(host)).toHaveLength(4)
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ sets: 4, reps: 6 })
    expect(onSave.mock.calls[0][0].setPlan).toEqual([{ r: 6 }, { r: 8 }, { r: 10 }, { r: 6 }])
  })

  it('opens an existing pyramid as it was written', () => {
    const { host } = open({ sets: 5, reps: 6, setPlan: PYRAMID })
    expect(setLabels(host)).toEqual(['Set 1', 'Set 2', 'Set 3', 'Set 4', 'Set 5'])
    expect([1, 2, 3, 4, 5].map(n => valueOf(host, 'Set ' + n))).toEqual(['6', '8', '10', '6', '8'])
    expect(rowSwitch(host, 'Different reps per set').getAttribute('aria-checked')).toBe('true')
  })

  it('turned off, an exercise that HAD a plan says so (setPlan null) and keeps its sets and first reps', () => {
    const { host, onSave } = open({ sets: 5, reps: 6, setPlan: PYRAMID })
    press(rowSwitch(host, 'Different reps per set'))
    expect(setLabels(host)).toEqual([])
    expect(valueOf(host, 'Reps')).toBe('6')
    save(host)
    const saved = onSave.mock.calls[0][0]
    expect(saved).toMatchObject({ sets: 5, reps: 6, setPlan: null })
  })

  it('an exercise that never had one is saved without the key', () => {
    const { host, onSave } = open({ sets: 3, reps: 10 })
    save(host)
    expect(onSave.mock.calls[0][0]).not.toHaveProperty('setPlan')
  })

  it('an exercise that had one and became a timed hold is saved without a plan, and says so', () => {
    const { host, onSave } = open({ sets: 5, reps: 6, setPlan: PYRAMID })
    press([...host.querySelectorAll('button')].find(b => b.textContent === 'Time'))
    expect(setLabels(host)).toEqual([])
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ mode: 'time', setPlan: null })
  })

  it('reps per side keeps every set even', () => {
    const { host, onSave } = open({ sets: 3, reps: 7, setPlan: [{ r: 7 }, { r: 9 }, { r: 11 }] })
    press(rowSwitch(host, 'Per side'))   // upstream's title since v1.3.10
    expect([1, 2, 3].map(n => valueOf(host, 'Set ' + n))).toEqual(['8', '10', '12'])
    save(host)
    expect(onSave.mock.calls[0][0]).toMatchObject({ side: true, sets: 3, reps: 8 })
    expect(onSave.mock.calls[0][0].setPlan).toEqual([{ r: 8 }, { r: 10 }, { r: 12 }])
  })

  it('a coach’s loads travel with the plan and say there is no automatic progression', () => {
    const plan = [{ r: 6, w: 40 }, { r: 8, w: 45 }, { r: 10, w: 50 }]
    const { host, onSave } = open({ sets: 3, reps: 6, weight: 0, setPlan: plan })
    expect(host.textContent).toContain('6 · 8 · 10 @ 40 · 45 · 50 kg')
    expect(host.textContent).toContain('The plan sets the weights, so there is no automatic progression for this exercise.')
    save(host)
    expect(onSave.mock.calls[0][0].setPlan).toEqual(plan)
  })

  it('an explicit double-progression rule is shown as the inherited one under a plan, not as its raw key', () => {
    const { host } = open({ sets: 5, reps: 6, prog: 'double', repsMin: 4, setPlan: PYRAMID })
    const rule = [...host.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === 'Rule')
    expect(rule.querySelector('.lrow-v').textContent).toMatch(/^Follow the routine/)
    expect(host.textContent).not.toContain('double')
    // the rep-range steppers of double progression are not offered either
    expect(stepper(host, 'Reps from')).toBeUndefined()
    expect(stepper(host, 'Reps up to')).toBeUndefined()
  })

  it('bodyweight takes the loads off the plan', () => {
    const { host, onSave } = open({ sets: 2, reps: 6, weight: 0, setPlan: [{ r: 6, w: 10 }, { r: 8, w: 10 }] })
    press(rowSwitch(host, 'Bodyweight'))
    save(host)
    expect(onSave.mock.calls[0][0].bodyweight).toBe(true)
    expect(onSave.mock.calls[0][0].setPlan).toEqual([{ r: 6 }, { r: 8 }])
  })

  it('is not offered for cardio', () => {
    const cardioId = EXDB.find(e => e.bp === 'cardio').id
    exConfigSheet(EXDB.find(e => e.id === cardioId), { sets: 1, min: 20, speed: 8 }, vi.fn())
    const sheet = useUI.getState().sheets.at(-1)
    const host = document.createElement('div')
    document.body.appendChild(host)
    const root = createRoot(host)
    mounted.push(root)
    act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
    expect(rowSwitch(host, 'Different reps per set')).toBeUndefined()
  })
})

//// Upstream's pyramid (v1.3.10, lib/pyramid.js) asks the same thing another way. One editor at a time:
//// ours starts a list (the club's coaches write and read it), upstream's opens for an exercise that
//// already is a pyramid, so it stays editable and can be turned off.
describe('the exercise sheet, beside upstream’s pyramid sets', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    useUI.setState({ sheets: [] })
    useStore.setState(s => ({ S: { ...s.S, unit: 'kg' } }))
    document.body.innerHTML = ''
  })
  afterEach(() => {
    act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  })

  it('a flat exercise offers ours only', () => {
    const { host } = open({ sets: 3, reps: 10 })
    expect(rowSwitch(host, 'Different reps per set')).toBeTruthy()
    expect(rowSwitch(host, 'Pyramid sets')).toBeUndefined()
  })

  it('a coach’s list offers ours only', () => {
    const { host } = open({ sets: 5, reps: 6, setPlan: PYRAMID })
    expect(rowSwitch(host, 'Different reps per set').getAttribute('aria-checked')).toBe('true')
    expect(rowSwitch(host, 'Pyramid sets')).toBeUndefined()
  })

  it('a pyramid opens in upstream’s editor, and is saved as one, with no list of ours', () => {
    const { host, onSave } = open({ sets: 4, reps: 12, pyramid: [12, 10, 8, 'max'] })
    expect(rowSwitch(host, 'Pyramid sets').getAttribute('aria-checked')).toBe('true')
    expect(rowSwitch(host, 'Different reps per set')).toBeUndefined()
    save(host)
    const out = onSave.mock.calls[0][0]
    expect(out.pyramid).toEqual([12, 10, 8, 'max'])
    expect(out.setPlan).toBeUndefined()
  })

  it('turned off, the pyramid keeps its switch until the sheet is saved, and ours waits', () => {
    const { host, onSave } = open({ sets: 4, reps: 12, pyramid: [12, 10, 8, 6] })
    press(rowSwitch(host, 'Pyramid sets'))
    expect(rowSwitch(host, 'Pyramid sets').getAttribute('aria-checked')).toBe('false')
    expect(rowSwitch(host, 'Different reps per set')).toBeUndefined()
    save(host)
    const out = onSave.mock.calls[0][0]
    expect(out.pyramid).toBeUndefined()
    expect(out).toMatchObject({ sets: 4, reps: 12 })
  })
})
