// Missed-workout nudge — one playful notification on the evening of a planned day that went by
// without a workout. Opt-in, under the workout-day reminder (S.reminder.nudge, S.reminder.tone).
//
// The self-hosted app sends it as a web push from the server (api/nudge.js, a hand copy of the
// rules below, as api/queue.js is of lib/queue.js); the mobile build schedules it as a native
// local notification (lib/mobile.js). Both answer the same three questions the same way:
//
//   WHEN  — at 20:00 on the user's clock, or 2 hours after the reminder when that is later, and
//           never after 21:30: a nudge is owed from that time until 21:30, once per day.
//   WHICH — a day is a MISSED day when it has a routine planned (the same plan the reminder
//           reads, coach week/rotation included) and no workout dated on it. A floating coach
//           week or rotation names a session every day until it is done, so on such a day the
//           day right after a workout is a rest day, not a miss — only the second day off in a
//           row counts. A day you left a note on (lib/day-notes.js: sick, travelling, …) is
//           excused, never missed: it is not nudged about and does not count towards the back-off.
//   HOW OFTEN — back-off: the missed days since the last workout are counted (14 days back at
//           most). After 3 of them the nudge goes quiet until the next workout is logged, so a
//           break never turns into a daily nag. No counter is stored anywhere: it is read off
//           the plan and the log, so the server and the phone agree without syncing anything.
//           //// Neoffice — a CLUB may set its own rule instead (S.perms.nudge, Gym Settings): see nudgeFor.
//
// Copy: three tones, one title and four lines each. The line is chosen by the date, so a day
// always gets the same one and consecutive days rotate. Keys are the English source strings;
// api/nudge-copy.js carries the server's copy of their translations (a test keeps the two equal).
import { isoOf } from './format.js'
import { effectiveRoutineIds } from './history.js'
import { queueLiveOn } from './queue.js'
import { excusedOn } from './day-notes.js'

export const NUDGE_TONES = ['friendly', 'guilt', 'drill']
export const NUDGE_MAX_MISSES = 3
export const NUDGE_LOOKBACK_DAYS = 14
//// Neoffice — a club's rule counts back to the last workout, however long ago, up to this many days (8 weeks: a club may ask for 8 missed
//// sessions in a row, which on a plan of one a week is two months). Not « once »: the nudge goes on this many planned days.
export const NUDGE_CLUB_HORIZON_DAYS = 56
export const NUDGE_CLUB_REPEATS = 3
const EVENING = 20 * 60, LATEST = 21 * 60 + 30, AFTER_REMINDER = 120

export const NUDGE_COPY = {
  friendly: {
    title: 'Everything okay?',
    lines: [
      '{0} is still waiting. What’s up?',
      'No {0} today? Even a short session tomorrow counts.',
      'Rough day? {0} will keep. Tomorrow is a fresh start.',
      'Hey, {0} didn’t happen today. All good?',
    ],
  },
  guilt: {
    title: 'I miss you',
    lines: [
      '{0} waited by the door all evening. For you.',
      'The barbell asked about you today. I didn’t know what to say.',
      'Was it something I said? {0} misses you.',
      'I saved you a spot on the bench. It’s still empty.',
    ],
  },
  drill: {
    title: 'Attention, recruit!',
    lines: [
      'Your gains are packing their bags. {0} tomorrow, no excuses!',
      '{0} doesn’t do itself, recruit. Move it!',
      'Excuses don’t lift weights. Report for {0} tomorrow!',
      'Your muscles filed a missing-person report. Show up for {0}!',
    ],
  },
}

export const toneOf = r => (NUDGE_TONES.includes(r?.tone) ? r.tone : 'friendly')

const hhmmToMin = v => {
  const m = /^(\d{2}):(\d{2})$/.exec(v || '')
  return m ? Number(m[1]) * 60 + Number(m[2]) : NaN
}

/** Minutes after midnight the nudge is owed from, or null when that would be after 21:30. */
export function nudgeMinute(reminderTime) {
  const r = hhmmToMin(reminderTime)
  const at = Math.max(EVENING, Number.isNaN(r) ? 0 : r + AFTER_REMINDER)
  return at > LATEST ? null : at
}
export const NUDGE_LATEST_MINUTE = LATEST

const dayBefore = iso => { const d = new Date(iso + 'T12:00:00'); d.setDate(d.getDate() - 1); return isoOf(d) }
const logged = (S, iso) => (S.workouts || []).some(w => w?.d === iso)
const norm = S => ({
  ...S,
  routines: Array.isArray(S?.routines) ? S.routines.filter(Boolean) : [],
  workouts: Array.isArray(S?.workouts) ? S.workouts.filter(Boolean) : [],
  week: S?.week || {}, dayPlan: S?.dayPlan || {},
})

// The routine ids `iso` missed, or [] when it is not a missed day. Each date is asked as if it
// were today, as the reminder does: a coach week's session is due every day until it is done.
function missed(S, iso) {
  if (logged(S, iso) || excusedOn(S, iso)) return []
  const ids = effectiveRoutineIds(S, iso, iso)
  if (!ids.length) return []
  if (queueLiveOn(S, iso, iso) && logged(S, dayBefore(iso))) return []
  return ids
}

//// Neoffice — the club's rule, from S.perms.nudge = { enabled, after, once } (Gym Settings: the missed-day relance), read the way the server
//// reads it (neoffice_gym api/training_day.py `nudge_for` and `_club_nudge_due`): the phone's own notifications and the server's pushes
//// must never disagree. Two answers:
////   · no object at all (null / undefined: an older server, a journal not signed in to a club, the mobile build) → null: upstream's rule;
////   · an object → the club's rule: `enabled` not true (an object that does not say it included) → { off: true }, the club sends none,
////     whatever a member's own switch says; else { off: false, after, once } with `after` a whole number of at least 1 (4 otherwise: a
////     string, 0, a boolean, a fraction) and `once` true unless it says otherwise. The server keeps `after` inside 2..8 before it sends it.
export function clubNudgeOf(club) {
  if (club == null) return null
  const c = typeof club === 'object' && !Array.isArray(club) ? club : {}
  if (!c.enabled) return { off: true }
  return {
    off: false,
    after: Number.isInteger(c.after) && c.after >= 1 ? c.after : 4,
    once: c.once == null ? true : Boolean(c.once),
  }
}
/** Whether a member is offered the relance at all: not when the club sends none (S.perms.nudge is there and does not switch it on). */
export const nudgeAllowed = S => { const rule = clubNudgeOf(S && S.perms ? S.perms.nudge : undefined); return !(rule && rule.off) }

/**
 * The routine ids to nudge about on `iso`, or null: not a missed day, or already 3 missed days in
 * a row since the last workout (back-off). Workouts dated after `iso` are not looked at, so the
 * phone can ask about future dates and get the back-off of a break that simply goes on.
 *
 * //// Neoffice — `club` (S.perms.nudge, see clubNudgeOf) replaces the back-off by the club's own count. With d = the number of missed
 * planned days in a row since the last workout, TODAY INCLUDED: the club off → never; once (the default) → only on d == after;
 * not once → on d = after, after + 1, after + 2 (at most three). No `club` → upstream's: d = 1, 2, 3. A member who never trained, and a
 * chain no workout closes inside NUDGE_CLUB_HORIZON_DAYS, are never nudged by a club's rule: cut at the horizon the count would stop
 * growing and « once » would repeat every week. The same table, case for case, is api/training_day.py's `nudge_for` in neoffice_gym
 * (tests/test_training_day.py `TestTheClubsOwnNudgeRule`) and this file's test.
 */
export function nudgeFor(state, iso, club) {
  const rule = clubNudgeOf(club)
  if (rule && rule.off) return null
  const S = norm(state)
  const ids = missed(S, iso)
  if (!ids.length) return null
  const last = S.workouts.reduce((m, w) => (typeof w.d === 'string' && w.d < iso && w.d > m ? w.d : m), '')
  if (rule) return clubDue(S, iso, last, rule) ? ids : null
  let misses = 0
  let d = dayBefore(iso)
  for (let i = 0; i < NUDGE_LOOKBACK_DAYS && d > last; i++, d = dayBefore(d)) {
    if (missed(S, d).length && ++misses >= NUDGE_MAX_MISSES) return null
  }
  return ids
}

//// Neoffice — whether the club's rule asks for a nudge on `iso`, a missed planned day (the caller checked it); `last` = the last workout before it.
function clubDue(S, iso, last, rule) {
  if (!last) return false
  let misses = 0
  let d = dayBefore(iso)
  for (let i = 0; i < NUDGE_CLUB_HORIZON_DAYS && d > last; i++, d = dayBefore(d)) {
    if (missed(S, d).length) misses++
  }
  // the horizon cut the chain before the last workout: the count would be short, and wrong for good
  if (d > last) return false
  const n = misses + 1
  return rule.once ? n === rule.after : n >= rule.after && n < rule.after + NUDGE_CLUB_REPEATS
}

/** The day's line index: by date, so a day keeps its line and consecutive days rotate. */
export const lineIndex = (iso, n) => Math.floor(Date.parse(iso + 'T00:00:00Z') / 86400000) % n
