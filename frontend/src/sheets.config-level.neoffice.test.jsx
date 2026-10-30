// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// What an exercise's settings sheet holds at each detail level (12.10): at the first level only reps, sets,
//// weight, rest and bodyweight; « different reps per set », « per side », plate loading and the progression section come from the
//// second. Since 30.10 (« de gros bébé ») the bodyweight switch, the backups and the rest between warm-ups come from the second
//// (Normal) and the third (Full) too. And the rule they all follow: hide the control, never the data — an exercise that already uses one keeps it at Simple.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exConfigSheet, exerciseDetailSheet } from './sheets.jsx'
import { bindUI } from './components/ui.jsx'

const ex = EXDB.find(e => e.id === '0009')   // a barbell lift: reps mode, plate loading offered
const mounted = []

function render(sheet) {
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const open = (cfg = {}) => {
  exConfigSheet(ex, { sets: 3, reps: 5, weight: 40, mode: 'reps', ...cfg }, () => {})
  return render(useUI.getState().sheets.at(-1))
}
const setLevel = (level, extra = {}) => useStore.setState(s => ({ S: { ...s.S, unit: 'kg', level, barWeights: {}, loadKind: {}, perms: {}, ...extra } }))
const titles = host => [...host.querySelectorAll('.lrow-t')].map(e => e.textContent)
const heads = host => [...host.querySelectorAll('h4.sec')].map(e => e.textContent)
const labels = host => [...host.querySelectorAll('label, .stp-l, .stepper label, .fld label')].map(e => e.textContent)

const PER_SET = 'Different reps per set'
const SIDE = 'Per side'

describe('exercise settings at each level', () => {
  beforeEach(() => {
    globalThis.IS_REACT_ACT_ENVIRONMENT = true
    bindUI(useUI)
    useUI.setState({ sheets: [] })
    document.body.innerHTML = ''
  })
  afterEach(() => { act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) }) })

  it('Simple: reps, sets, weight and rest — and none of what moved up', () => {
    setLevel('simple')
    const host = open()
    const text = host.textContent
    // what stays
    expect(text).toContain('Sets')
    expect(text).toContain('Reps')
    expect(text).toContain('Weight (kg)')
    expect(titles(host)).toContain('Rest for this exercise')
    // what moved up
    expect(titles(host)).not.toContain(PER_SET)
    expect(titles(host)).not.toContain(SIDE)
    expect(titles(host)).not.toContain('Rule')
    expect(heads(host)).not.toContain('Plate loading')
    expect(heads(host)).not.toContain('Progression')
    expect(labels(host)).not.toContain('Step (kg)')
    expect(text).not.toContain('Deload')
    // 30.10 — the three the pilot club still saw at the first level
    expect(titles(host)).not.toContain('Bodyweight')
    expect(titles(host)).not.toContain('Rest between warm-ups')
    expect(titles(host)).not.toContain('Backups')
  })

  it('Normal brings the bodyweight switch back, Full the rest between warm-ups', () => {
    setLevel('normal')
    expect(titles(open())).toContain('Bodyweight')
    expect(titles(open())).not.toContain('Rest between warm-ups')
    setLevel('full')
    expect(titles(open())).toContain('Bodyweight')
    expect(titles(open())).toContain('Rest between warm-ups')
  })

  describe('Simple keeps what the exercise already carries (30.10)', () => {
    beforeEach(() => setLevel('simple'))
    it('a bodyweight exercise keeps its switch (so it can be turned off)', () => {
      expect(titles(open({ bodyweight: true, weight: 0 }))).toContain('Bodyweight')
    })
    it('warm-ups, or a rest of their own between them', () => {
      expect(titles(open({ warmupSets: 2 }))).toContain('Rest between warm-ups')
      expect(titles(open({ warmupRestSec: 30 }))).toContain('Rest between warm-ups')
      expect(titles(open({ warmupRestOff: true }))).toContain('Rest between warm-ups')
    })
  })

  it.each(['normal', 'full'])('%s: all four are there', level => {
    setLevel(level)
    const host = open()
    expect(titles(host)).toContain(PER_SET)
    expect(titles(host)).toContain(SIDE)
    expect(titles(host)).toContain('Rule')
    expect(heads(host)).toContain('Plate loading')
    expect(heads(host)).toContain('Progression')
  })

  it('a member with no level of their own and a club that sets none sees them all (upstream\'s whole screen)', () => {
    setLevel(undefined)
    const host = open()
    expect(titles(host)).toContain(PER_SET)
    expect(heads(host)).toContain('Plate loading')
  })

  describe('Simple, an exercise that already uses one keeps it', () => {
    beforeEach(() => setLevel('simple'))

    it('per side', () => {
      const host = open({ side: true })
      expect(titles(host)).toContain(SIDE)
      expect(titles(host)).not.toContain(PER_SET)
    })

    it('a per-set plan', () => {
      const host = open({ sets: 3, reps: 8, setPlan: [{ r: 8 }, { r: 6 }, { r: 4 }] })
      expect(titles(host)).toContain(PER_SET)
      expect(host.textContent).toContain('Set 3')
      expect(titles(host)).not.toContain(SIDE)
    })

    it('a progression rule of its own, or a step', () => {
      for (const cfg of [{ prog: 'double' }, { inc: 5 }]) {
        const host = open(cfg)
        expect(heads(host)).toContain('Progression')
        expect(titles(host)).toContain('Rule')
      }
    })

    it('a bar weight of its own, or its own way of loading, for THIS exercise', () => {
      setLevel('simple', { barWeights: { '0009': 15 } })
      expect(heads(open())).toContain('Plate loading')
      setLevel('simple', { loadKind: { '0009': { k: 'single', _ts: 1 } } })
      expect(heads(open())).toContain('Plate loading')
      setLevel('simple', { barWeights: { '0025': 15 } })   // another exercise's bar says nothing about this one
      expect(heads(open())).not.toContain('Plate loading')
    })
  })

  it('the exercise\'s detail sheet offers the plate editor from Normal up, and at Simple only once the exercise has its own setup', () => {
    const detail = () => { exerciseDetailSheet(ex); return render(useUI.getState().sheets.at(-1)) }
    setLevel('simple')
    expect(heads(detail())).not.toContain('Plate loading')
    setLevel('simple', { barWeights: { '0009': 20 } })
    expect(heads(detail())).toContain('Plate loading')
    setLevel('normal')
    expect(heads(detail())).toContain('Plate loading')
  })
})
