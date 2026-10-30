// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). What the calmed home screen says about today (lib/home-today.js).
import { describe, expect, it } from 'vitest'
import { DEF } from '../store/useStore.js'
import { todayISO, isoOf } from './format.js'
import { todayHero, weekDots } from './home-today.js'

const base = over => ({ ...JSON.parse(JSON.stringify(DEF)), routines: [], workouts: [], dayPlan: {}, week: {}, active: null, queue: null, rotation: null, scheduleMode: null, ...over })
const today = () => new Date()
const weekdayOf = d => d.getDay()
const push = { id: 'r1', name: 'Push', emoji: null, ex: [{ id: 'a' }, { id: 'b' }] }
const pull = { id: 'r2', name: 'Pull', emoji: null, ex: [{ id: 'c' }] }

describe('todayHero', () => {
  it('says empty when the member has no routine at all', () => {
    expect(todayHero(base(), todayISO()).kind).toBe('empty')
  })

  it('says planned, with the routine, its exercise count and the ids to start', () => {
    const S = base({ routines: [push], week: { [weekdayOf(today())]: ['r1'] } })
    const h = todayHero(S, todayISO())
    expect(h).toMatchObject({ kind: 'planned', title: 'Push', exercises: 2, routineIds: ['r1'], rescheduled: false })
  })

  it('joins several routines of one day, counting all their exercises', () => {
    const S = base({ routines: [push, pull], week: { [weekdayOf(today())]: ['r1', 'r2'] } })
    const h = todayHero(S, todayISO())
    expect(h.title).toBe('Push + Pull')
    expect(h.exercises).toBe(3)
    expect(h.routineIds).toEqual(['r1', 'r2'])
  })

  it('says a pinned day is rescheduled', () => {
    const S = base({ routines: [push, pull], dayPlan: { [todayISO()]: 'r2' } })
    const h = todayHero(S, todayISO())
    expect(h).toMatchObject({ kind: 'planned', title: 'Pull', rescheduled: true })
  })

  it('says rest, with the next session, on a day with nothing planned', () => {
    const other = (weekdayOf(today()) + 2) % 7
    const S = base({ routines: [push], week: { [other]: ['r1'] } })
    const h = todayHero(S, todayISO())
    expect(h.kind).toBe('rest')
    expect(h.next).toMatchObject({ weekday: other })
    expect(h.next.routine.name).toBe('Push')
  })

  it('says done, with the name of the session logged, once the plan is covered', () => {
    const S = base({
      routines: [push], week: { [weekdayOf(today())]: ['r1'] },
      workouts: [{ id: 'w1', d: todayISO(), name: 'Push', routineIds: ['r1'], routineId: 'r1', start: 1, end: 2, entries: [] }],
    })
    expect(todayHero(S, todayISO())).toMatchObject({ kind: 'done', title: 'Push' })
  })

  it('leaves the plan outstanding when the session logged today was something else', () => {
    const S = base({
      routines: [push], week: { [weekdayOf(today())]: ['r1'] },
      workouts: [{ id: 'w1', d: todayISO(), name: 'Freestyle', routineIds: [], start: 1, end: 2, entries: [] }],
    })
    expect(todayHero(S, todayISO()).kind).toBe('planned')
  })

  it('says running while a session is under way, whatever the plan says', () => {
    const S = base({ routines: [push], week: { [weekdayOf(today())]: ['r1'] }, active: { id: 'x', name: 'Push', start: 1, entries: [] } })
    expect(todayHero(S, todayISO())).toMatchObject({ kind: 'running', title: 'Push' })
  })

  it('says editing, not running, for a saved workout open in the editor', () => {
    const S = base({ routines: [push], active: { id: 'x', name: 'Old one', editingWorkoutId: 'w9', start: 0, entries: [] } })
    expect(todayHero(S, todayISO()).kind).toBe('editing')
  })

  it('agrees with the Start button on which routines today holds (same lib function)', async () => {
    const { effectiveRoutineIds } = await import('./history.js')
    const S = base({ routines: [push, pull], week: { [weekdayOf(today())]: ['r2'] } })
    expect(todayHero(S, todayISO()).routineIds).toEqual(effectiveRoutineIds(S, todayISO()))
  })
})

describe('weekDots', () => {
  it('has seven days, one of them today, starting on the week’s first day', () => {
    const dots = weekDots(base(), today(), todayISO())
    expect(dots).toHaveLength(7)
    expect(dots.filter(d => d.today)).toHaveLength(1)
    expect(dots.find(d => d.today).iso).toBe(todayISO())
    // seven consecutive days
    const t0 = new Date(dots[0].iso + 'T12:00:00')
    dots.forEach((d, i) => { const x = new Date(t0); x.setDate(t0.getDate() + i); expect(d.iso).toBe(isoOf(x)) })
  })

  it('marks planned, rescheduled and done days', () => {
    const wd = weekdayOf(today())
    const S = base({ routines: [push, pull], week: { [wd]: ['r1'] }, workouts: [] })
    const t = weekDots(S, today(), todayISO()).find(d => d.today)
    expect(t.state).toBe('plan')
    const S2 = { ...S, workouts: [{ id: 'w', d: todayISO(), name: 'Push', routineIds: ['r1'], start: 1, end: 2, entries: [] }] }
    expect(weekDots(S2, today(), todayISO()).find(d => d.today).state).toBe('done')
    const S3 = { ...S, dayPlan: { [todayISO()]: 'r2' } }
    expect(weekDots(S3, today(), todayISO()).find(d => d.today).state).toBe('ovr')
  })
})
