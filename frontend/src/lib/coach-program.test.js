//// Neoffice — added file (no upstream equivalent).
//// Ces tests couvrent la seule chose que le coaching peut casser sans bruit :
//// une révision qui détruit des routines. Le reste (parsePlan/mergePlan) est
//// amont et testé amont — on ne le re-teste pas, on teste NOTRE couche.

import { describe, it, expect } from 'vitest'
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
