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

//// Neoffice — THE CLUB'S RULE (S.perms.nudge = { enabled, after, once }, Gym Settings): the table the neoffice_gym fork mirrors in Python
//// (neoffice_gym/tests/test_training_day.py, `TestTheClubsOwnNudgeRule`): THE SAME CASES, WITH THE SAME DATES AND THE SAME ANSWERS. The phone's
//// local notifications and the server's pushes must read a club's rule alike; keep the two in step.
////
//// d = the number of missed PLANNED days in a row since the last workout, today included.
////   no club object (an older server, a journal not signed in to a club, the mobile build) : nudge on d = 1, 2, 3   (upstream's back-off)
////   a club object that does not switch it on (enabled false, missing, `{}`)               : never
////   { enabled: true, after: N, once: true  }  (once is the default)                       : only on d == N
////   { enabled: true, after: N, once: false }                                              : on d = N, N + 1, N + 2 (at most three)
////   `after` is a whole number of at least 1, 4 otherwise. Excused days (a note on them) are neither missed nor a break in the chain; unplanned
////   days are skipped without breaking it; a logged workout starts the count again; a member who never trained, and a chain no workout closes
////   inside 56 days, are never nudged.
////
////  case                                        club                        last workout  day asked        d   nudge
////  A  once, after 4, daily                     on, 4, once                 2026-09-01    09-02 .. 09-09   1..8  only on 09-05 (d = 4)
////  B  not once, after 4, daily                 on, 4, repeat               2026-09-01    09-02 .. 09-09   1..8  09-05, 09-06, 09-07 (d = 4, 5, 6)
////  C  after 2 (the smallest), daily            on, 2, once                 2026-09-01    09-02 .. 09-05   1..4  only on 09-03
////  D  the club switched it off                 off, 4, once                2026-09-01    09-02 .. 09-09   1..8  never
////  E  an excused day is no miss and breaks nothing   on, 4, once            2026-09-01    09-03 sick       09-06 is d = 4
////  F  Mon / Wed / Fri, unplanned days skipped  on, 4, once                 2026-09-04    09-07 .. 09-16   1..4  only on Mon 09-14 (d = 4)
////  G  a workout starts the count again         on, 4, once                 09-01, 09-03  09-04 .. 09-09   1..6  only on 09-07 (d = 4)
////  H  a member who never trained               on, 4, once                 none          any day          -     never
////  I  a chain no workout closes inside 56 days on, 4 / 5, once             2026-06-01    weekly, 07-06 .. 09-07  5th Monday only, never again
////  I2 sparse pinned dates, chain cut by the horizon   on, 5, once        2026-06-01    09-05            -     never (counted short)
describe('nudgeFor — the club\'s rule (the table the server mirrors)', () => {
  const T = true, F = false
  const DAILY = { 0: 'push', 1: 'push', 2: 'push', 3: 'push', 4: 'push', 5: 'push', 6: 'push' }
  const daily = (over = {}) => S({ week: DAILY, ...over })
  const ON_4_ONCE = { enabled: true, after: 4, once: true }
  const sept = d => `2026-09-${String(d).padStart(2, '0')}`
  const asked = (state, club, days) => days.map(d => !!nudgeFor(state, sept(d), club))
  const range = (from, to) => Array.from({ length: to - from }, (_, i) => from + i)           // Python's range(from, to)

  it('A — once: only on the day the count is reached', () => {
    expect(asked(daily({ workouts: [w('2026-09-01')] }), ON_4_ONCE, range(2, 10))).toEqual([F, F, F, T, F, F, F, F])
  })

  it('B — not once: it is sent on three planned days from the count', () => {
    expect(asked(daily({ workouts: [w('2026-09-01')] }), { enabled: true, after: 4, once: false }, range(2, 10))).toEqual([F, F, F, T, T, T, F, F])
  })

  it('C — the smallest count is the second missed session', () => {
    expect(asked(daily({ workouts: [w('2026-09-01')] }), { enabled: true, after: 2, once: true }, range(2, 6))).toEqual([F, T, F, F])
  })

  it('D — a club that did not switch it on sends none: off, no `enabled`, an empty object', () => {
    const state = daily({ workouts: [w('2026-09-01')] })
    for (const club of [{ enabled: false, after: 4, once: true }, { after: 4, once: true }, {}]) {
      expect(asked(state, club, range(2, 10)), JSON.stringify(club)).toEqual([F, F, F, F, F, F, F, F])
    }
  })

  it('E — an excused day is not missed and does not break the chain', () => {
    const state = daily({ workouts: [w('2026-09-01')], dayNotes: { '2026-09-03': { tag: 'sick', _ts: 1 } } })
    expect(asked(state, ON_4_ONCE, range(2, 10))).toEqual([F, F, F, F, T, F, F, F])
    expect(nudgeFor(state, '2026-09-03', ON_4_ONCE)).toBeNull()                                   // the sick day itself is never nudged
  })

  it('F — days with nothing planned are skipped without breaking the chain (Mon / Wed / Fri)', () => {
    const state = S({ workouts: [w('2026-09-04')] })
    const due = range(7, 17).filter(d => nudgeFor(state, sept(d), ON_4_ONCE))
    expect(due).toEqual([14])
    expect(nudgeFor(state, '2026-09-08', ON_4_ONCE)).toBeNull()                                   // Tuesday plans nothing: nothing to miss
  })

  it('G — a workout starts the count again', () => {
    expect(asked(daily({ workouts: [w('2026-09-01'), w('2026-09-03')] }), ON_4_ONCE, range(4, 10))).toEqual([F, F, F, T, F, F])
  })

  it('H — a member who never trained is never nudged by a club\'s rule', () => {
    expect(asked(daily(), ON_4_ONCE, range(2, 10))).toEqual([F, F, F, F, F, F, F, F])
    expect(asked(daily(), { enabled: true, after: 2, once: false }, range(2, 10))).toEqual([F, F, F, F, F, F, F, F])
  })

  it('I — a chain no workout closes inside the horizon is never nudged', () => {
    const state = S({ week: { 1: 'push' }, workouts: [w('2026-06-01')] })                        // a Monday, trained once
    const club = { enabled: true, after: 5, once: true }
    const mondays = ['2026-06-08', '2026-06-15', '2026-06-22', '2026-06-29', '2026-07-06', '2026-07-13', '2026-08-03', '2026-09-07']
    expect(mondays.map(d => !!nudgeFor(state, d, club))).toEqual([F, F, F, F, T, F, F, F])
    // two months later it would be the fifth miss of a weekly count cut at the horizon: it must not be sent again
    expect(nudgeFor(state, '2026-09-14', club)).toBeNull()
    expect(nudgeFor(daily({ workouts: [w('2026-06-01')] }), '2026-09-05', ON_4_ONCE)).toBeNull()
  })

  it('I2 — a sparse plan cut by the horizon would be counted short, so it is not nudged', () => {
    // sessions pinned on a few dates only (`dayPlan`): inside the 56 days before 09-05 there are four of them, the fifth miss of a count cut
    // at the horizon, while the chain since the last workout (06-01) is longer
    const pins = Object.fromEntries(['2026-07-01', '2026-07-15', '2026-08-01', '2026-08-15', '2026-09-01', '2026-09-05'].map(d => [d, 'push']))
    const state = S({ week: {}, dayPlan: pins, workouts: [w('2026-06-01')] })
    expect(nudgeFor(state, '2026-09-05', { enabled: true, after: 5, once: true })).toBeNull()
    // closed inside the horizon (last workout 2026-08-20, then the pins of 09-01 and 09-05): d = 2, counted
    const close = S({ week: {}, dayPlan: pins, workouts: [w('2026-08-20')] })
    expect(nudgeFor(close, '2026-09-05', { enabled: true, after: 2, once: true })).toEqual(['push'])
  })

  it('the club object is read tolerantly: `after` is a whole number of at least 1, 4 otherwise; `once` is true unless it says otherwise', () => {
    const state = daily({ workouts: [w('2026-09-01')] })
    for (const club of [{ enabled: true }, { enabled: true, after: '4' }, { enabled: true, after: 0 }, { enabled: true, after: true }, { enabled: true, after: 3.5 }]) {
      expect(asked(state, club, range(2, 10)), JSON.stringify(club)).toEqual([F, F, F, T, F, F, F, F])
    }
    expect(asked(state, { enabled: true, after: 4, once: null }, range(2, 7))).toEqual([F, F, F, T, F])
  })

  it('no club object is the journal\'s own rule, unchanged', () => {
    const state = S({ workouts: [w('2026-09-04')] })
    expect(nudgeFor(state, '2026-09-07', undefined)).toEqual(['push'])
    expect(nudgeFor(state, '2026-09-11', null)).toEqual(['push'])
    expect(nudgeFor(state, '2026-09-14')).toBeNull()
  })

  it('what comes back is the routine to nudge about, as upstream\'s does', () => {
    expect(nudgeFor(daily({ workouts: [w('2026-09-06')] }), '2026-09-10', ON_4_ONCE)).toEqual(['push'])
  })

  it('every table row as one grid: planned every day, no workout since the 6th, d = 1..10', () => {
    const state = daily({ workouts: [w('2026-09-06')] })
    const days = Array.from({ length: 10 }, (_, i) => sept(7 + i))
    const grid = club => days.map(iso => !!nudgeFor(state, iso, club))
    expect(grid(undefined)).toEqual([T, T, T, F, F, F, F, F, F, F])                                // legacy: d = 1..3
    expect(grid({ enabled: true, after: 4, once: true })).toEqual([F, F, F, T, F, F, F, F, F, F])
    expect(grid({ enabled: true, after: 4 })).toEqual([F, F, F, T, F, F, F, F, F, F])               // once is the default
    expect(grid({ enabled: true, after: 4, once: false })).toEqual([F, F, F, T, T, T, F, F, F, F])
    expect(grid({ enabled: true, after: 8, once: true })).toEqual([F, F, F, F, F, F, F, T, F, F])
    expect(grid({ enabled: false, after: 4, once: true })).toEqual([F, F, F, F, F, F, F, F, F, F])
  })

  it('clubNudgeOf and nudgeAllowed say the same thing the table does', () => {
    expect(clubNudgeOf(undefined)).toBeNull()
    expect(clubNudgeOf(null)).toBeNull()
    expect(clubNudgeOf({})).toEqual({ off: true })
    expect(clubNudgeOf({ enabled: false })).toEqual({ off: true })
    expect(clubNudgeOf({ enabled: true, after: 5, once: false })).toEqual({ off: false, after: 5, once: false })
    expect(clubNudgeOf({ enabled: true })).toEqual({ off: false, after: 4, once: true })
    expect(nudgeAllowed({})).toBe(true)
    expect(nudgeAllowed({ perms: {} })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: null } })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: { enabled: true } } })).toBe(true)
    expect(nudgeAllowed({ perms: { nudge: { enabled: false } } })).toBe(false)
    expect(nudgeAllowed({ perms: { nudge: {} } })).toBe(false)
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
