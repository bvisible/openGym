//// Neoffice — added file (no upstream equivalent).
//
// A different target for each set (a pyramid, 6 · 8 · 10 · 6 · 8), end to end through the
// journal's own functions: how it is cleaned, how a session starts from it, how it is judged,
// what progression may and may not do with it, and how it travels in a shared plan.
import { describe, it, expect } from 'vitest'
import {
  cleanSetPlan, setPlanOf, plannedWeights, policyWithPlan, withoutRepsOfPlan, goalFor, startSetPlan, dropSetPlan,
  resizeSetPlan, editSetReps, evenSetPlan, unloadSetPlan, setPlanLine, MAX_SET_PLAN
} from './set-plan.js'
import { buildSets, exLine } from './history.js'
import { readSession, policyFor, nextPrescription, applyPrescription } from './progression.js'
import { buildSessionEntries } from './session-start.js'
import { buildPlanBundle, parsePlan, mergePlan, planPrintHTML } from './plan-share.js'
import { applyCoachProgram } from './coach-program.js'
import { EXDB, isAssisted } from './exercises.js'
import { convertWeight } from './units.js'

// A plainly loaded lift, as progression.test.js picks one.
const LIFT = EXDB.find(e => e.bp !== 'cardio' && !['upper legs', 'lower legs', 'back', 'hips', 'glutes'].includes(e.bp) && !['body weight', 'band', 'resistance band'].includes(e.eq) && !isAssisted(e.id)).id
const PYRAMID = [{ r: 6 }, { r: 8 }, { r: 10 }, { r: 6 }, { r: 8 }]
const cfg = (over = {}) => ({ id: LIFT, mode: 'reps', sets: 5, reps: 6, weight: 40, setPlan: PYRAMID, ...over })
const state = (workouts = []) => ({ unit: 'kg', workouts, routines: [], exWeights: {}, week: {}, dayPlan: {} })
// A finished session of the pyramid at `weight`, every set as typed in `reps` (null = never checked off).
const done = (reps, weight = 40, target = cfg()) => ({
  d: '2026-01-05',
  entries: [{ id: LIFT, target, sets: reps.map(r => (r === null ? { w: weight, r: 0, done: false } : { w: weight, r, done: true })) }]
})

describe('cleaning a plan', () => {
  it('keeps whole rep counts and a load that says something', () => {
    expect(cleanSetPlan([{ r: 6 }, { r: '8', w: '45.5' }, { r: 10, w: 0 }, { r: 6, w: -3 }, { r: 8, w: 'x' }]))
      .toEqual([{ r: 6 }, { r: 8, w: 45.5 }, { r: 10 }, { r: 6 }, { r: 8 }])
  })
  it('is no plan when ANY entry is not one: a set fewer would change the sets without anyone asking', () => {
    const bad = [undefined, null, [], 'abc', {}, [{ r: 6 }, null], [{ r: 6 }, 'x'], [{ r: 0 }], [{ r: 1000 }], [{ r: 6.5 }], [{ r: true }], [{ r: '' }], [{ w: 40 }],
      [{ r: 6 }, { r: 0 }, { r: 10 }], [{ r: NaN }], [{ r: Infinity }], Array.from({ length: MAX_SET_PLAN + 1 }, () => ({ r: 5 }))]
    bad.forEach(raw => expect(cleanSetPlan(raw), JSON.stringify(raw)).toBeUndefined())
    expect(cleanSetPlan(Array.from({ length: MAX_SET_PLAN }, () => ({ r: 5 })))).toHaveLength(MAX_SET_PLAN)
  })
  it('rounds every total up to an even number for a unilateral exercise', () => {
    expect(cleanSetPlan([{ r: 7 }, { r: 8, w: 10 }], { perSide: true })).toEqual([{ r: 8 }, { r: 8, w: 10 }])
  })
})

describe('what counts as the plan of a config', () => {
  it('is the list when it agrees with sets and reps', () => {
    expect(setPlanOf(cfg())).toEqual(PYRAMID)
    expect(setPlanOf(cfg({ reps: undefined }))).toEqual(PYRAMID)
  })
  it('is nothing when something else edited sets or reps afterwards (an older app, the AI coach)', () => {
    expect(setPlanOf(cfg({ sets: 4 }))).toBeNull()
    expect(setPlanOf(cfg({ sets: 6 }))).toBeNull()
    expect(setPlanOf(cfg({ reps: 8 }))).toBeNull()
  })
  it('is nothing for what a plan cannot be', () => {
    expect(setPlanOf(cfg({ mode: 'time' }))).toBeNull()
    expect(setPlanOf(cfg({ mode: 'cardio' }))).toBeNull()
    expect(setPlanOf(cfg({ intensifier: { type: 'restpause', totalReps: 12, restSec: 15 } }))).toBeNull()
    expect(setPlanOf(cfg({ intensifier: { type: 'dropset', count: 1, pct: 20 } }))).toEqual(PYRAMID)
    expect(setPlanOf(cfg({ setPlan: [{ r: 0 }] }))).toBeNull()
    expect(setPlanOf(cfg({ setPlan: [] }))).toBeNull()
    expect(setPlanOf(cfg({ setPlan: 'nope' }))).toBeNull()
    expect(setPlanOf(null)).toBeNull()
    expect(setPlanOf({ id: LIFT, sets: 3, reps: 10 })).toBeNull()
  })
  it('knows when the coach fixed a load', () => {
    expect(plannedWeights(cfg())).toBe(false)
    expect(plannedWeights(cfg({ setPlan: [{ r: 6, w: 40 }, ...PYRAMID.slice(1)] }))).toBe(true)
  })
})

describe('the sheet’s moves keep sets and reps in step with the list', () => {
  it('starting gives every set what the exercise asked, and dropping gives the first set’s reps back', () => {
    const started = startSetPlan({ sets: 3, reps: 10, weight: 60 })
    expect(started).toMatchObject({ sets: 3, reps: 10, weight: 60, setPlan: [{ r: 10 }, { r: 10 }, { r: 10 }] })
    expect(setPlanOf({ id: LIFT, ...started })).not.toBeNull()
    const edited = editSetReps(editSetReps(started, 0, 6), 1, 8)
    expect(edited).toMatchObject({ sets: 3, reps: 6, setPlan: [{ r: 6 }, { r: 8 }, { r: 10 }] })
    expect(dropSetPlan(edited)).toEqual({ sets: 3, reps: 6, weight: 60 })
  })
  it('a new set asks what the last one asks, with its load; the list never goes under one or over the limit', () => {
    const c = { sets: 2, reps: 6, setPlan: [{ r: 6 }, { r: 9, w: 50 }] }
    expect(resizeSetPlan(c, 4).setPlan).toEqual([{ r: 6 }, { r: 9, w: 50 }, { r: 9, w: 50 }, { r: 9, w: 50 }])
    expect(resizeSetPlan(c, 1)).toMatchObject({ sets: 1, reps: 6, setPlan: [{ r: 6 }] })
    expect(resizeSetPlan(c, 0).setPlan).toHaveLength(1)
    expect(resizeSetPlan(c, 99).setPlan).toHaveLength(MAX_SET_PLAN)
    // without a plan it only moves the sets
    expect(resizeSetPlan({ sets: 3, reps: 10 }, 5)).toEqual({ sets: 5, reps: 10 })
  })
  it('reps per side keeps every total even, bodyweight takes the loads off', () => {
    expect(evenSetPlan({ sets: 2, reps: 5, setPlan: [{ r: 5 }, { r: 7, w: 20 }] })).toEqual({ sets: 2, reps: 6, setPlan: [{ r: 6 }, { r: 8, w: 20 }] })
    expect(unloadSetPlan({ sets: 2, reps: 5, setPlan: [{ r: 5, w: 10 }, { r: 7 }] }).setPlan).toEqual([{ r: 5 }, { r: 7 }])
    const plain = { sets: 3, reps: 5 }
    expect(evenSetPlan(plain)).toBe(plain)
    expect(unloadSetPlan(plain)).toBe(plain)
  })
  it('says the plan in a line', () => {
    expect(setPlanLine(PYRAMID)).toBe('6 · 8 · 10 · 6 · 8')
    expect(setPlanLine(PYRAMID, { weight: 60 })).toBe('6 · 8 · 10 · 6 · 8 @ 60 kg')
    expect(setPlanLine([{ r: 6, w: 40 }, { r: 8, w: 45 }], { unit: 'lb' })).toBe('6 · 8 @ 40 · 45 lb')
    expect(setPlanLine([{ r: 6, w: 40 }, { r: 8 }])).toBe('6 · 8 @ 40 · – kg')
    expect(setPlanLine([{ r: 8 }, { r: 6 }], { weight: 10, bodyweight: true })).toBe('8 · 6 @ +10 kg')
  })
})

describe('a session starts from the plan', () => {
  const lastTime = [done([12, 12, 12], 50, { id: LIFT, mode: 'reps', sets: 3, reps: 12, weight: 50 })]

  it('one row per planned set, with the plan’s reps — not what was done last time', () => {
    const rows = buildSets(state(lastTime), cfg())
    expect(rows.map(r => r.r)).toEqual([6, 8, 10, 6, 8])
    expect(rows.every(r => r.done === false)).toBe(true)
  })
  it('the same exercise without a plan still starts from last time, as it always did', () => {
    const rows = buildSets(state(lastTime), { id: LIFT, mode: 'reps', sets: 3, reps: 10, weight: 40 })
    expect(rows.map(r => r.r)).toEqual([12, 12, 12])
  })
  it('a load the plan gives a set is that set’s; the others take the exercise’s', () => {
    const rows = buildSets(state(), cfg({ weight: 30, setPlan: [{ r: 6, w: 40 }, { r: 8 }, { r: 10, w: 50 }, { r: 6 }, { r: 8 }] }), { useTarget: true })
    expect(rows.map(r => r.w)).toEqual([40, 30, 50, 30, 30])
  })
  it('the warm-ups come first and are not part of the plan', () => {
    const rows = buildSets(state(), cfg({ warmupSets: 2 }), { step: 2.5, useTarget: true })
    expect(rows).toHaveLength(7)
    expect(rows.slice(0, 2).every(r => r.phase === 'warmup')).toBe(true)
    expect(rows.slice(2).map(r => r.r)).toEqual([6, 8, 10, 6, 8])
  })
  it('a unilateral exercise splits each planned total between its sides', () => {
    const rows = buildSets(state(), cfg({ side: true, sets: 3, reps: 6, setPlan: [{ r: 6 }, { r: 8 }, { r: 10 }] }), { useTarget: true })
    expect(rows).toHaveLength(3)
    expect(rows.map(r => [r.sides.L.r, r.sides.R.r])).toEqual([[3, 3], [4, 4], [5, 5]])
    expect(rows.map(r => r.r)).toEqual([6, 8, 10])
  })
  it('a plan that disagrees with sets is not one: the flat target and last time apply', () => {
    const rows = buildSets(state(lastTime), cfg({ sets: 3 }))
    expect(rows.map(r => r.r)).toEqual([12, 12, 12])
  })
  it('says itself in the routine editor’s line', () => {
    expect(exLine(cfg(), 'kg')).toBe('6 · 8 · 10 · 6 · 8 @ 40 kg')
    expect(exLine(cfg({ setPlan: undefined }), 'kg')).toBe('5 × 6 · 40 kg')
  })
  it('builds the entry of a routine: target kept whole, rows from the plan', () => {
    const [entry] = buildSessionEntries(state(), { id: 'r1', name: 'Pyramid', ex: [cfg()] })
    expect(entry.target.setPlan).toEqual(PYRAMID)
    expect(entry.sets.map(s => s.r)).toEqual([6, 8, 10, 6, 8])
  })
})

describe('a session is judged set by set', () => {
  it('a hit is every set at ITS reps, not at the first one’s', () => {
    expect(readSession({ id: LIFT, target: cfg(), sets: [6, 8, 10, 6, 8].map(r => ({ w: 40, r, done: true })) }).ok).toBe(true)
    // 8 reps on the set that asked for 10: above the first set's 6, still a miss
    expect(readSession({ id: LIFT, target: cfg(), sets: [6, 8, 8, 6, 8].map(r => ({ w: 40, r, done: true })) }).ok).toBe(false)
    expect(readSession({ id: LIFT, target: cfg(), sets: [7, 9, 11, 7, 9].map(r => ({ w: 40, r, done: true })) }).ok).toBe(true)
  })
  it('a set never checked off, or a missing one, is a miss', () => {
    expect(readSession({ id: LIFT, target: cfg(), sets: [{ w: 40, r: 6, done: true }, { w: 40, r: 8, done: true }, { w: 40, r: 10, done: true }, { w: 40, r: 6, done: true }] }).ok).toBe(false)
    const sets = [6, 8, 10, 6, 8].map(r => ({ w: 40, r, done: true }))
    sets[4] = { w: 40, r: 0, done: false }
    expect(readSession({ id: LIFT, target: cfg(), sets }).ok).toBe(false)
  })
  it('a flat target is judged exactly as before', () => {
    const flat = { id: LIFT, mode: 'reps', sets: 3, reps: 5 }
    expect(readSession({ id: LIFT, target: flat, sets: [5, 5, 6].map(r => ({ w: 40, r, done: true })) }).ok).toBe(true)
    expect(readSession({ id: LIFT, target: flat, sets: [5, 5, 4].map(r => ({ w: 40, r, done: true })) }).ok).toBe(false)
  })
  it('goalFor answers each set its own reps, the flat target otherwise', () => {
    expect(goalFor(cfg(), 2, 99)).toBe(10)
    expect(goalFor(cfg(), 7, 99)).toBe(99)
    expect(goalFor({ sets: 3, reps: 5 }, 1, 5)).toBe(5)
  })
})

describe('progression moves the weight of a plan and nothing else', () => {
  const S = rows => state([done(rows)])
  const hit = [6, 8, 10, 6, 8]

  it('reads a rule that moves the reps as linear, and a plan with loads as no progression', () => {
    expect(policyFor(cfg({ prog: 'double' }), null, 'reps')).toBe('linear')
    expect(policyFor(cfg({ prog: 'greyskull' }), null, 'reps')).toBe('linear')
    expect(policyFor(cfg({ prog: 'linear' }), null, 'reps')).toBe('linear')
    expect(policyFor(cfg({ prog: 'off' }), null, 'reps')).toBe('off')
    expect(policyFor(cfg({ prog: 'double' }), { prog: 'double' }, 'reps')).toBe('linear')
    expect(policyFor(cfg({ setPlan: [{ r: 6, w: 40 }, ...PYRAMID.slice(1)] }), null, 'reps')).toBe('off')
    // no plan, no change
    expect(policyFor({ id: LIFT, sets: 3, reps: 10, prog: 'double' }, null, 'reps')).toBe('double')
    expect(policyWithPlan(cfg(), 'time', 'off')).toBe('off')
  })
  it('a clean session adds the step to the weight, and answers no reps and no sets', () => {
    const p = nextPrescription(S(hit), cfg(), null)
    expect(p.kind).toBe('up')
    expect(p.weight).toBe(42.5)
    expect(p).not.toHaveProperty('reps')
    expect(p).not.toHaveProperty('sets')
  })
  it('a session short on ONE set’s own reps holds the weight', () => {
    const p = nextPrescription(S([6, 8, 9, 6, 8]), cfg(), null)
    expect(p.kind).toBe('hold')
    expect(p.weight).toBe(40)
  })
  it('three misses deload the weight plainly — no Epley message about reps the plan owns', () => {
    const miss = [6, 8, 9, 6, 8]
    const p = nextPrescription(state([done(miss), done(miss), done(miss)]), cfg(), null)
    expect(p.kind).toBe('deload')
    expect(p.weight).toBeLessThan(40)
    expect(p).not.toHaveProperty('reps')
    expect(p.why[0]).not.toMatch(/Epley/)
  })
  it('the rows built from a prescription keep the pyramid when the weight moves', () => {
    const st = S(hit)
    const prescription = nextPrescription(st, cfg(), null)
    const rows = applyPrescription(buildSets(st, cfg(), { step: 2.5 }), prescription, 2.5)
    expect(rows.map(r => r.r)).toEqual([6, 8, 10, 6, 8])
    expect(rows.every(r => r.w === 42.5)).toBe(true)
    // …and through the session builder, which is what the app calls. Since v1.3.9 an exercise
    // progresses per routine (upstream #216): a session from no routine is borrowed history, and
    // the first time in a routine starts from its own target. So the session above is this
    // routine's own, as it is when the app builds the next one.
    const ownSt = { ...st, workouts: st.workouts.map(w => ({ ...w, routineId: 'r' })) }
    const [entry] = buildSessionEntries(ownSt, { id: 'r', name: 'P', ex: [cfg()] })
    expect(entry.sets.map(s => [s.r, s.w])).toEqual([[6, 42.5], [8, 42.5], [10, 42.5], [6, 42.5], [8, 42.5]])
    expect(entry.target.sets).toBe(5)
    expect(entry.target.reps).toBe(6)
  })
  it('an unloaded plan has nothing to prescribe', () => {
    const bodyweight = cfg({ weight: 0, bodyweight: true })
    const st = state([done([6, 8, 10, 6, 8], 0, bodyweight)])
    expect(nextPrescription(st, bodyweight, null).kind).toBe('off')
  })
  it('a rule upstream has not written yet is read as linear too: only a rule that moves the weight alone may drive a plan', () => {
    expect(policyWithPlan(cfg(), 'reps', 'triple')).toBe('linear')
    expect(policyWithPlan(cfg(), 'reps', 'double')).toBe('linear')
    expect(policyWithPlan(cfg(), 'reps', 'off')).toBe('off')
    expect(policyWithPlan(cfg({ setPlan: undefined }), 'reps', 'triple')).toBe('triple')
  })
  it('stripping is a no-op without a plan', () => {
    const p = { kind: 'up', weight: 45, reps: 8, sets: 4 }
    expect(withoutRepsOfPlan({ id: LIFT, sets: 3, reps: 5 }, p)).toBe(p)
    expect(withoutRepsOfPlan(cfg(), p)).toEqual({ kind: 'up', weight: 45 })
    expect(withoutRepsOfPlan(cfg(), undefined)).toBeUndefined()
  })
})

describe('a plan in a shared file', () => {
  const S0 = () => ({ ...state(), customEx: [], week: {}, routines: [{ id: 'r1', name: 'Pyramid', ex: [cfg({ weight: 60 }), { id: LIFT, sets: 3, reps: 10 }] }] })

  it('travels with the routine, and only when it is a plan', () => {
    const bundle = buildPlanBundle(S0(), 'x')
    expect(bundle.routines[0].ex[0].setPlan).toEqual(PYRAMID)
    expect(bundle.routines[0].ex[1]).not.toHaveProperty('setPlan')
    const stale = S0()
    stale.routines[0].ex[0].sets = 4   // edited by something that does not know the list
    expect(buildPlanBundle(stale, 'x').routines[0].ex[0]).not.toHaveProperty('setPlan')
  })
  it('arrives as a plan, in the recipient’s routines', () => {
    const bundle = JSON.parse(JSON.stringify(buildPlanBundle(S0(), 'x')))
    const parsed = parsePlan(bundle, 'kg')
    expect(parsed.routines[0].ex[0].setPlan).toEqual(PYRAMID)
    const s = state()
    s.routines = []
    s.week = {}
    mergePlan(s, parsed)
    expect(s.routines[0].ex[0]).toMatchObject({ id: LIFT, sets: 5, reps: 6, setPlan: PYRAMID })
    expect(setPlanOf({ ...s.routines[0].ex[0], mode: 'reps' })).toEqual(PYRAMID)
  })
  it('is cleaned on the way in: a plan file is someone else’s data', () => {
    const bundle = JSON.parse(JSON.stringify(buildPlanBundle(S0(), 'x')))
    bundle.routines[0].ex[0].setPlan = [{ r: 6 }, { r: 'x' }, { r: 10 }, { r: 6 }, { r: 8 }]
    expect(parsePlan(bundle, 'kg').routines[0].ex[0]).not.toHaveProperty('setPlan')
    const disagreeing = JSON.parse(JSON.stringify(buildPlanBundle(S0(), 'x')))
    disagreeing.routines[0].ex[0].sets = 3
    expect(parsePlan(disagreeing, 'kg').routines[0].ex[0]).not.toHaveProperty('setPlan')
  })
  it('the load a plan gives a set is converted with the exercise’s own', () => {
    const lbs = { ...S0(), unit: 'lb' }
    lbs.routines[0].ex[0].setPlan = [{ r: 6, w: 100 }, ...PYRAMID.slice(1)]
    lbs.routines[0].ex[0].weight = 90
    const bundle = JSON.parse(JSON.stringify(buildPlanBundle(lbs, 'x')))
    const kg = parsePlan(bundle, 'kg').routines[0].ex[0]
    // the same conversion the exercise's own weight goes through, not a second one
    expect(kg.setPlan[0].w).toBe(convertWeight(100, 'lb', 'kg'))
    expect(kg.weight).toBe(convertWeight(90, 'lb', 'kg'))
    expect(kg.setPlan[0].w).not.toBe(100)
    expect(kg.setPlan[1]).toEqual({ r: 8 })
  })
  it('prints as its reps', () => {
    const html = planPrintHTML(JSON.parse(JSON.stringify(buildPlanBundle(S0(), 'x'))), 'kg')
    expect(html).toContain('6 · 8 · 10 · 6 · 8 @ 60 kg')
    expect(html).toContain('3 × 10')
  })
})

describe('a coach’s program with a pyramid', () => {
  const bundle = (name, plan) => ({
    opengym_plan: 1, name, week: {}, customEx: [],
    routines: [{ id: 'r-' + name, name, ex: [{ id: LIFT, sets: plan.length, reps: plan[0].r, weight: 40, setPlan: plan }] }]
  })
  const offer = (version, b) => ({ id: 'GPA-1', program: 'PROG-1', version, bundle: b, replaceSchedule: false })

  it('arrives in the member’s routines, and its revision REPLACES it rather than doubling it', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, offer(1, bundle('Pyramide', PYRAMID)))
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].ex[0].setPlan).toEqual(PYRAMID)
    expect(buildSets(state(), { ...s.routines[0].ex[0] }, { useTarget: true }).map(r => r.r)).toEqual([6, 8, 10, 6, 8])
    const v2 = [{ r: 5 }, { r: 5 }, { r: 3 }]
    const res = applyCoachProgram(s, offer(2, bundle('Pyramide', v2)))
    expect(res.replaced).toBe(1)
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].coachVersion).toBe(2)
    expect(s.routines[0].ex[0]).toMatchObject({ sets: 3, reps: 5 })
    expect(s.routines[0].ex[0].setPlan).toEqual(v2)
  })
  it('a revision that drops the plan drops it from the routine too', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, offer(1, bundle('Pyramide', PYRAMID)))
    const flat = { opengym_plan: 1, name: 'Pyramide', week: {}, customEx: [], routines: [{ id: 'r-flat', name: 'Pyramide', ex: [{ id: LIFT, sets: 3, reps: 10 }] }] }
    applyCoachProgram(s, offer(2, flat))
    expect(s.routines[0].ex[0]).not.toHaveProperty('setPlan')
  })
})
