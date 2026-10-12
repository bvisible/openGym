import { describe, expect, it } from 'vitest'
import { NUDGE_COPY, NUDGE_TONES, clubNudgeOf, lineIndex, nudgeAllowed, nudgeFor, nudgeMinute, toneOf } from './nudge.js'
import { buildNudgeNotifications } from './mobile.js'

// The same rules as api/nudge.js (api/test/nudge.test.js holds the mirror of these cases):
// a planned day with nothing logged is a miss; 3 misses in a row since the last workout and it
// goes quiet. 2026-09-07 is a Monday; Push on Mon/Wed/Fri.
const routines = [{ id: 'push', name: 'Push' }, { id: 'pull', name: 'Pull' }]
const S = (over = {}) => ({
  routines, week: { 1: 'push', 3: 'push', 5: 'push' }, dayPlan: {}, workouts: [],
  reminder: { on: true, time: '08:00', nudge: true, tone: 'friendly' }, ...over,
})
const w = d => ({ id: 'w' + d, d, routineId: 'push' })

describe('nudgeFor', () => {
  it('nudges a missed planned day, not a rest day or a trained one', () => {
    expect(nudgeFor(S({ workouts: [w('2026-09-04')] }), '2026-09-07')).toEqual(['push'])
    expect(nudgeFor(S({ workouts: [w('2026-09-04')] }), '2026-09-08')).toBeNull()
    expect(nudgeFor(S({ workouts: [w('2026-09-07')] }), '2026-09-07')).toBeNull()
    expect(nudgeFor(S({ workouts: [w('2026-09-04')], dayPlan: { '2026-09-07': 'rest' } }), '2026-09-07')).toBeNull()
  })

  it('backs off after 3 missed days in a row until the next workout', () => {
    const s = S({ workouts: [w('2026-09-04')] })
    expect(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14'].map(d => !!nudgeFor(s, d))).toEqual([true, true, true, false])
    expect(nudgeFor(S({ workouts: [w('2026-09-04'), w('2026-09-15')] }), '2026-09-16')).toEqual(['push'])
  })

  it('in a coach week the day after a session is rest; the second day off is a miss', () => {
    const queue = { ids: ['push', 'pull'], since: 0, startsOn: '2026-09-07' }
    const s = S({ week: {}, queue, workouts: [{ id: 'a', d: '2026-09-07', routineId: 'push', start: 1 }] })
    expect(nudgeFor(s, '2026-09-08')).toBeNull()
    expect(nudgeFor(s, '2026-09-09')).toEqual(['pull'])
  })

  // #261: a day with a note on it (sick, travelling, …) is excused, not missed.
  it('leaves a noted day alone, and a noted day does not count towards the back-off', () => {
    const notes = { '2026-09-07': { tag: 'sick', _ts: 1 } }
    expect(nudgeFor(S({ workouts: [w('2026-09-04')], dayNotes: notes }), '2026-09-07')).toBeNull()
    expect(nudgeFor(S({ workouts: [w('2026-09-04')], dayNotes: { '2026-09-07': { text: 'Flight to Lisbon', _ts: 1 } } }), '2026-09-07')).toBeNull()
    // a cleared note (a stamped empty entry) is no excuse
    expect(nudgeFor(S({ workouts: [w('2026-09-04')], dayNotes: { '2026-09-07': { _ts: 2 } } }), '2026-09-07')).toEqual(['push'])
    // Monday excused: Wednesday, Friday and the next Monday are the three misses that count
    const s = S({ workouts: [w('2026-09-04')], dayNotes: notes })
    expect(['2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16'].map(d => !!nudgeFor(s, d))).toEqual([true, true, true, false])
  })

  it('times the evening and reads the tone tolerantly', () => {
    expect(nudgeMinute('08:00')).toBe(1200)
    expect(nudgeMinute('19:15')).toBe(1275)
    expect(nudgeMinute('20:00')).toBeNull()
    expect(toneOf({ tone: 'guilt' })).toBe('guilt')
    expect(toneOf({ tone: 'nope' })).toBe('friendly')
    for (const k of NUDGE_TONES) expect(NUDGE_COPY[k].lines.length).toBeGreaterThanOrEqual(3)
  })
})

describe('buildNudgeNotifications (mobile)', () => {
  const now = new Date(2026, 8, 7, 12, 0) // Monday noon
  it('schedules the evening of each upcoming missed day, at most 3 past the last workout', () => {
    const n = buildNudgeNotifications(S({ workouts: [w('2026-09-04')] }), now)
    expect(n.map(x => [x.schedule.at.getDate(), x.schedule.at.getHours(), x.schedule.at.getMinutes()]))
      .toEqual([[7, 20, 0], [9, 20, 0], [11, 20, 0]])
    expect(n[0].title).toBe(NUDGE_COPY.friendly.title)
    expect(n[0].body).toBe(NUDGE_COPY.friendly.lines[lineIndex('2026-09-07', 4)].replace('{0}', 'Push'))
    expect(new Set(n.map(x => x.id)).size).toBe(3)
  })
  it('is off unless both the reminder and the nudge are on', () => {
    expect(buildNudgeNotifications(S({ reminder: { on: true, time: '08:00' } }), now)).toEqual([])
    expect(buildNudgeNotifications(S({ reminder: { on: false, nudge: true } }), now)).toEqual([])
    expect(buildNudgeNotifications(S({ workouts: [w('2026-09-04')], reminder: { on: true, nudge: true, time: '20:30' } }), now)).toEqual([])
  })
  it('skips today when it is trained, past its evening, or a session is on screen', () => {
    const trained = buildNudgeNotifications(S({ workouts: [w('2026-09-07')] }), now)
    expect(trained[0].schedule.at.getDate()).toBe(9)
    const late = buildNudgeNotifications(S({ workouts: [w('2026-09-04')] }), new Date(2026, 8, 7, 21, 0))
    expect(late[0].schedule.at.getDate()).toBe(9)
    const live = buildNudgeNotifications(S({ workouts: [w('2026-09-04')], active: { rid: 'push' } }), now)
    expect(live[0].schedule.at.getDate()).toBe(9)
  })
  it('skips today once it carries a day note (#261)', () => {
    const n = buildNudgeNotifications(S({ workouts: [w('2026-09-04')], dayNotes: { '2026-09-07': { tag: 'travel', _ts: 1 } } }), now)
    expect(n[0].schedule.at.getDate()).toBe(9)
  })
  it('takes the tone, and runs 2 hours after a late reminder', () => {
    const n = buildNudgeNotifications(S({ workouts: [w('2026-09-04')], reminder: { on: true, time: '19:00', nudge: true, tone: 'drill' } }), now)
    expect(n[0].title).toBe(NUDGE_COPY.drill.title)
    expect([n[0].schedule.at.getHours(), n[0].schedule.at.getMinutes()]).toEqual([21, 0])
  })
})

//// Neoffice — THE CLUB'S RULE (S.perms.nudge = { enabled, after, once }, Gym Settings), the table the neoffice_gym fork mirrors in Python
//// (tests/test_training_day.py `test_nudge_for_club_rule_table`): THE SAME CASES, THE SAME ANSWERS. Keep them in step.
////
//// d = the number of missed PLANNED days in a row since the last workout, today included.
////   no club object (an older server, a journal not signed in to a club, the mobile build) : nudge on d = 1, 2, 3   (upstream's back-off)
////   { enabled: false }                                                                      : never
////   { enabled: true, after: N, once: true  }  (once is the default)                         : only on d == N
////   { enabled: true, after: N, once: false }                                                : on d = N, N + 1, N + 2 (at most three)
////   `after` is clamped to 2..8 (4 when it is not a number); an object that does not say `enabled` is read as no object.
//// Excused days (a note on them) are neither missed nor a break in the chain; unplanned days are skipped without breaking it; a logged
//// workout resets the count. Look-back: 28 days with a club rule (14 without).
describe('nudgeFor — the club\'s rule (the table the server mirrors)', () => {
  // Planned EVERY day, last workout Sunday 2026-09-06: d = 1 is Monday 2026-09-07, d = 10 is Wednesday 2026-09-16.
  const everyDay = { 0: 'push', 1: 'push', 2: 'push', 3: 'push', 4: 'push', 5: 'push', 6: 'push' }
  const daily = (over = {}) => S({ week: everyDay, workouts: [w('2026-09-06')], ...over })
  const days = Array.from({ length: 10 }, (_, i) => `2026-09-${String(7 + i).padStart(2, '0')}`)   // d = 1..10
  const answers = (state, club) => days.map(iso => !!nudgeFor(state, iso, club))
  const T = true, F = false

  it('table — planned every day, no workout since the 6th: d = 1..10', () => {
    expect(answers(daily(), undefined)).toEqual([T, T, T, F, F, F, F, F, F, F])                                    // legacy
    expect(answers(daily(), { enabled: true, after: 4, once: true })).toEqual([F, F, F, T, F, F, F, F, F, F])
    expect(answers(daily(), { enabled: true, after: 4 })).toEqual([F, F, F, T, F, F, F, F, F, F])                 // once is the default
    expect(answers(daily(), { enabled: true, after: 4, once: false })).toEqual([F, F, F, T, T, T, F, F, F, F])
    expect(answers(daily(), { enabled: true, after: 2, once: true })).toEqual([F, T, F, F, F, F, F, F, F, F])
    expect(answers(daily(), { enabled: true, after: 8, once: true })).toEqual([F, F, F, F, F, F, F, T, F, F])
    expect(answers(daily(), { enabled: false, after: 4, once: true })).toEqual([F, F, F, F, F, F, F, F, F, F])
  })

  it('what comes back is the routine to nudge about, as upstream\'s does', () => {
    expect(nudgeFor(daily(), '2026-09-10', { enabled: true, after: 4, once: true })).toEqual(['push'])
  })

  it('`after` is clamped to 2..8 and falls back to 4; an object with no `enabled` is no object', () => {
    expect(answers(daily(), { enabled: true, after: 1, once: true })).toEqual(answers(daily(), { enabled: true, after: 2, once: true }))
    expect(answers(daily(), { enabled: true, after: 99, once: true })).toEqual(answers(daily(), { enabled: true, after: 8, once: true }))
    expect(answers(daily(), { enabled: true, after: 'x', once: true })).toEqual(answers(daily(), { enabled: true, after: 4, once: true }))
    expect(answers(daily(), { enabled: true, once: true })).toEqual(answers(daily(), { enabled: true, after: 4, once: true }))
    expect(answers(daily(), {})).toEqual(answers(daily(), undefined))
    expect(answers(daily(), null)).toEqual(answers(daily(), undefined))
  })

  it('an excused day is not a miss and does not count: 4 misses in a row means 4 days that were not excused', () => {
    const notes = { '2026-09-08': { tag: 'sick', _ts: 1 } }
    const s = daily({ dayNotes: notes })
    // 07 (1) · 08 excused · 09 (2) · 10 (3) · 11 (4) · 12 (5)
    expect(['2026-09-07', '2026-09-08', '2026-09-09', '2026-09-10', '2026-09-11', '2026-09-12'].map(iso => !!nudgeFor(s, iso, { enabled: true, after: 4, once: true })))
      .toEqual([F, F, F, F, T, F])
  })

  it('a workout resets the count', () => {
    const s = daily({ workouts: [w('2026-09-06'), w('2026-09-10')] })
    const club = { enabled: true, after: 4, once: true }
    // 11 (1) · 12 (2) · 13 (3) · 14 (4) · 15 (5)
    expect(['2026-09-11', '2026-09-12', '2026-09-13', '2026-09-14', '2026-09-15'].map(iso => !!nudgeFor(s, iso, club))).toEqual([F, F, F, T, F])
    expect(!!nudgeFor(s, '2026-09-11')).toBe(true)                                // upstream's: the first miss after a workout is nudged
  })

  it('unplanned days are skipped without breaking the chain: Monday, Wednesday, Friday plan, last workout Friday the 4th', () => {
    const s = S({ workouts: [w('2026-09-04')] })                                  // week: Mon / Wed / Fri
    const club = { enabled: true, after: 4, once: true }
    // misses: Mon 07 (1) · Wed 09 (2) · Fri 11 (3) · Mon 14 (4) · Wed 16 (5)
    expect(['2026-09-07', '2026-09-09', '2026-09-11', '2026-09-14', '2026-09-16'].map(iso => !!nudgeFor(s, iso, club))).toEqual([F, F, F, T, F])
    // Tuesday is not a planned day: never a nudge, whatever the count
    expect(nudgeFor(s, '2026-09-08', club)).toBeNull()
    expect(nudgeFor(s, '2026-09-15', club)).toBeNull()
  })

  it('looks 28 days back with a club rule: a count of 8 on a plan of one session a week is still found', () => {
    const weekly = S({ week: { 1: 'push' }, workouts: [w('2026-08-03')] })      // Mondays only
    const club = { enabled: true, after: 4, once: true }
    // Mondays after the 3rd of August: 10 (1) · 17 (2) · 24 (3) · 31 (4) — 28 days back from the 31st reaches the 3rd
    expect(nudgeFor(weekly, '2026-08-31', club)).toEqual(['push'])
    expect(nudgeFor(weekly, '2026-08-24', club)).toBeNull()
    expect(nudgeFor(weekly, '2026-09-07', club)).toBeNull()
  })

  it('clubNudgeOf and nudgeAllowed say the same thing the table does', () => {
    expect(clubNudgeOf(undefined)).toBeNull()
    expect(clubNudgeOf({})).toBeNull()
    expect(clubNudgeOf({ enabled: false })).toEqual({ off: true })
    expect(clubNudgeOf({ enabled: true, after: 5, once: false })).toEqual({ off: false, after: 5, once: false })
    expect(clubNudgeOf({ enabled: true })).toEqual({ off: false, after: 4, once: true })
    expect(nudgeAllowed({})).toBe(true)
    expect(nudgeAllowed({ perms: {} })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: {} } })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: { enabled: true } } })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: { enabled: false } } })).toBe(false)
  })
})

describe('buildNudgeNotifications — the club\'s rule on the phone', () => {
  const now = new Date(2026, 8, 7, 12, 0)                                         // Monday noon
  it('schedules nothing when the club switched the relance off, even for a member who turned it on', () => {
    expect(buildNudgeNotifications(S({ workouts: [w('2026-09-04')], perms: { nudge: { enabled: false } } }), now)).toEqual([])
  })
  it('follows the club\'s count: with 3 missed days wanted before the one nudge, only the third planned day is scheduled', () => {
    const n = buildNudgeNotifications(S({ workouts: [w('2026-09-04')], perms: { nudge: { enabled: true, after: 3, once: true } } }), now)
    expect(n.map(x => x.schedule.at.getDate())).toEqual([11])                    // Mon 7 (1), Wed 9 (2), Fri 11 (3)
  })
})
