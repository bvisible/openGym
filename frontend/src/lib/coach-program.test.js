//// Neoffice — added file (no upstream equivalent).
//// These tests cover the one thing coaching can break silently: a revision
//// that destroys routines. The rest (parsePlan/mergePlan) is upstream and
//// tested upstream — we do not re-test it, we test OUR layer.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyCoachProgram, removeProgramRoutines, countProgramRoutines } from './coach-program.js'

const bundle = (name, exIds, week) => ({
  opengym_plan: 1,
  name,
  routines: [{ id: 'r-' + name, name, ex: exIds.map(id => ({ id, sets: 3, reps: 8 })) }],
  week: week || {},
  customEx: []
})

const offer = (program, version, b, replaceSchedule = false) =>
  ({ id: 'GPA-1', program, version, bundle: b, replaceSchedule })

const emptyState = () => ({ routines: [], week: {}, customEx: [] })

describe('applyCoachProgram', () => {
  it('marks the routines it adds with the program and version', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].coachProgram).toBe('PROG-1')
    expect(s.routines[0].coachVersion).toBe(1)
  })

  it('leaves the member’s own routines completely alone', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    const mine = s.routines.find(r => r.id === 'mine')
    expect(mine).toBeTruthy()
    expect(mine.coachProgram).toBeUndefined()
  })

  it('replaces what an earlier version of the SAME program installed', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force v1', ['0001'])))
    const res = applyCoachProgram(s, offer('PROG-1', 2, bundle('Force v2', ['0002'])))
    expect(res.replaced).toBe(1)
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].name).toBe('Force v2')
    expect(s.routines[0].coachVersion).toBe(2)
  })

  it('does NOT touch routines from a different program', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    const res = applyCoachProgram(s, offer('PROG-2', 1, bundle('Cardio', ['0002'])))
    expect(res.replaced).toBe(0)
    expect(s.routines).toHaveLength(2)
  })

  it('clears a weekday left pointing at a routine it removed', () => {
    // The trap: v1 scheduled Monday, v2 does not replace the schedule. Without
    // the cleanup, Monday points at a routine that no longer exists and the
    // member taps Start on an empty session.
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force v1', ['0001'], { 1: 'r-Force v1' }), true))
    expect(s.week['1']).toBeTruthy()
    const stale = s.week['1']
    applyCoachProgram(s, offer('PROG-1', 2, bundle('Force v2', ['0002']), false))
    expect(s.week['1']).not.toBe(stale)
    expect(Object.values(s.week)).not.toContain(stale)
  })

  it('replaces the week when the coach said so', () => {
    const s = emptyState()
    s.week = { 3: 'mine' }
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'], { 1: 'r-Force' }), true))
    expect(s.week['3']).toBeUndefined()
    expect(s.week['1']).toBeTruthy()
  })

  it('keeps the member’s week when the coach did not', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    s.week = { 3: 'mine' }
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'], { 1: 'r-Force' }), false))
    expect(s.week['3']).toBe('mine')
  })
})

describe('countProgramRoutines', () => {
  it('counts only the routines of that program', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('A', ['0001'])))
    applyCoachProgram(s, offer('PROG-2', 1, bundle('B', ['0002'])))
    expect(countProgramRoutines(s, 'PROG-1')).toBe(1)
    expect(countProgramRoutines(s, 'PROG-3')).toBe(0)
  })
})

describe('removeProgramRoutines', () => {
  it('is a no-op when the program installed nothing', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    expect(removeProgramRoutines(s, 'PROG-9')).toBe(0)
    expect(s.routines).toHaveLength(1)
  })
})

//// Neoffice — periodization.
//// This mechanism can get it wrong WITHOUT ever raising an error: a week 2
//// pointing at week 1's routines, a cycle restarting at the wrong moment, a
//// schedule laid down again mid-week wiping the day a member had just moved.
//// None of that throws.

import { attachCycle, syncCycleWeek, cycleWeekOf } from './coach-program.js'

const cycleBundle = () => ({
  opengym_plan: 1,
  name: 'Cycle',
  routines: [
    { id: 'r-A', name: 'Semaine A', ex: [{ id: '0001', sets: 3, reps: 8 }] },
    { id: 'r-B', name: 'Semaine B', ex: [{ id: '0002', sets: 3, reps: 8 }] },
  ],
  week: { 1: 'r-A' },
  customEx: [],
  cycle: {
    span: 4,
    weeks: {
      1: { 1: 'r-A' },
      2: { 1: 'r-B' },
      3: { 1: 'r-A', 4: 'r-B' },
      4: { 1: 'r-B' },
    },
  },
})

const cycleOffer = (start) => ({
  id: 'GPA-C', program: 'PROG-C', version: 1,
  bundle: cycleBundle(), replaceSchedule: true, startDate: start,
})

describe('periodization', () => {
  it('keeps the cycle and lays down week 1', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    expect(s.coachCycle).toBeTruthy()
    expect(s.coachCycle.span).toBe(4)
    expect(Object.keys(s.coachCycle.weeks)).toHaveLength(4)
  })

  it('week 2 points at the RIGHT routines, not at the bundle’s', () => {
    // mergePlan hands out brand-new ids. If the mapping were lost, week 2
    // would point at "r-B", which does not exist on the member's side.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    const ids = new Set(s.routines.map(r => r.id))
    Object.values(s.coachCycle.weeks).forEach(w =>
      Object.values(w).forEach(rid => expect(ids.has(rid)).toBe(true)))
  })

  it('moves on week by week, then wraps', () => {
    const c = { span: 4, startedOn: '2026-08-24', weeks: {} }
    expect(cycleWeekOf(c, '2026-08-24')).toBe(1)
    expect(cycleWeekOf(c, '2026-08-30')).toBe(1)
    expect(cycleWeekOf(c, '2026-08-31')).toBe(2)
    expect(cycleWeekOf(c, '2026-09-21')).toBe(5 % 4 || 4)
    // After four weeks it starts over at the first.
    expect(cycleWeekOf(c, '2026-09-21')).toBe(1)
  })

  it('before the start date we are in week 1', () => {
    // A program dated next week is being prepared; it must not send you back
    // to the end of the previous cycle.
    const c = { span: 4, startedOn: '2026-09-01', weeks: {} }
    expect(cycleWeekOf(c, '2026-08-25')).toBe(1)
  })

  it('lays the schedule down again when the week CHANGES', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    const w1 = s.week['1']
    syncCycleWeek(s, '2026-08-31')
    expect(s.week['1']).not.toBe(w1)
  })

  it('lays down NOTHING while we stay inside the same week', () => {
    // This is the test that matters: laying it down on every open would wipe
    // the day a member has just moved, and they would not understand why.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    s.week['3'] = s.routines[1].id      // the member adds a Wednesday
    syncCycleWeek(s, '2026-08-26')       // same week
    expect(s.week['3']).toBe(s.routines[1].id)
  })

  it('a cycle week REPLACES, it does not top up', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    syncCycleWeek(s, '2026-09-07')       // week 3: Monday + Thursday
    expect(Object.keys(s.week).sort()).toEqual(['1', '4'])
    syncCycleWeek(s, '2026-09-14')       // week 4: Monday only
    expect(Object.keys(s.week)).toEqual(['1'])
  })

  it('a program WITHOUT a cycle does not invent one', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Simple', ['0001'])))
    expect(s.coachCycle).toBeUndefined()
  })

  it('a revision without a cycle clears the previous version’s', () => {
    // Otherwise v1's calendar would keep running under a v2 that asks only
    // for a typical week — and the schedule would change by itself with
    // nothing to explain it.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    expect(s.coachCycle).toBeTruthy()
    applyCoachProgram(s, { id: 'GPA-C', program: 'PROG-C', version: 2,
                           bundle: bundle('Simple', ['0001']), replaceSchedule: true })
    expect(s.coachCycle).toBeUndefined()
  })
})

//// The cycle moves on inside syncCycleWeek — but SOMEBODY still has to call
//// it. The defect we lived through: the call only existed on tab return, so a
//// member opening their logbook on Monday morning (the app was closed, no
//// visibilitychange happens) stayed on last week. This test guards the call
//// site, whether or not the next upstream merge rewrites boot(): it fails if
//// the call disappears, which no test of the function itself can see.
describe('the cycle’s call site', () => {
  const store = readFileSync(new URL('../store/useStore.js', import.meta.url), 'utf8')

  it('advances the cycle on BOOT, not only on tab return', () => {
    const boot = store.slice(store.indexOf('async boot()'))
    expect(boot.slice(0, boot.indexOf('async pullState()'))).toContain('advanceCycle()')
  })

  it('advances it on tab return too', () => {
    const vis = store.slice(store.indexOf("addEventListener('visibilitychange'"))
    expect(vis.slice(0, 900)).toContain('advanceCycle()')
  })
})
