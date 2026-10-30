//// Neoffice — added file (no upstream equivalent).
////
//// What the home screen says about today (views/HomeToday.jsx), as plain data so that a test can read it without mounting anything.
//// It decides nothing of its own: it reads the same lib functions the upstream home screen (views/Home.jsx) and the Start button read
//// (effectiveRoutines, effectiveRoutineIds, nextTrainingDay, the coach week's queue), so the two can never disagree about what today is.
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay } from './history.js'
import { queueOf, pinState } from './queue.js'
import { scheduleModeOf } from './rotation.js'
import { dayNoteOf } from './day-notes.js'
import { isoOf, weekStartOf, weekDayOffset } from './format.js'

/**
 * The state of today, in one of six kinds:
 *  - `running`  a session is under way (`title` is its name);
 *  - `editing`  a saved workout is open in the editor (it holds S.active too, but it is not a session in progress);
 *  - `done`     today's plan is covered by what was logged (`title` is the last session's name, possibly empty);
 *  - `planned`  there is something to do (`title`, `exercises`, `routineIds`, `rescheduled`);
 *  - `rest`     there are routines, none for today (`next` says when the next session is, when it can be told);
 *  - `empty`    the member has no routine at all.
 */
export function todayHero(S, iso) {
  const routines = effectiveRoutines(S, iso)
  if (S.active) {
    return { kind: S.active.editingWorkoutId ? 'editing' : 'running', title: S.active.name || '', routineIds: [] }
  }

  // The last session logged today, if any, once today's plan is covered. A freestyle session on a planned day leaves the plan outstanding;
  // a coach-week session is never "covered" by an earlier workout: the queue only names one it does not count as done yet (same rule as Home).
  const logged = (S.workouts || []).filter(w => w.d === iso)
  const queueIds = queueOf(S)?.ids || []
  const covered = id => !queueIds.includes(id) && logged.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  const last = logged.at(-1)
  if (last && routines.every(r => covered(r.id))) return { kind: 'done', title: last.name || '', routineIds: [] }

  if (routines.length) {
    // A fulfilled pin (a coach session pinned to today and since done) reads as no override.
    const pinned = S.dayPlan && S.dayPlan[iso] !== undefined && pinState(S, S.dayPlan[iso]) !== 'done'
    return {
      kind: 'planned',
      title: routines.map(r => r.name).join(' + '),
      exercises: routines.reduce((n, r) => n + (r.ex ? r.ex.length : 0), 0),
      routineIds: effectiveRoutineIds(S, iso),
      rescheduled: !!pinned,
    }
  }

  if (!(S.routines || []).length) return { kind: 'empty', routineIds: [] }

  // On a rest day, saying when you train next beats a full stop. A rotation has no weekday of its own (lib/rotation.js), so it names none,
  // unless a planner wrote a queue with weekdays: naming one would be the fixed-week model leaking into a schedule that never had it.
  const liveQ = queueOf(S)
  const rotating = scheduleModeOf(S) === 'rotation' && !(liveQ && !liveQ.rotationId)
  const next = rotating ? null : nextTrainingDay(S, iso)
  return { kind: 'rest', next, routineIds: [] }
}

/**
 * The seven days of the week that holds `today` (a Date), as dots: `state` is '' (nothing), 'plan', 'ovr' (rescheduled), 'noted' (a day off with a
 * note reads as excused), or 'done'. Same states as the upstream week strip, so the stylesheet's .dot classes apply unchanged.
 */
export function weekDots(S, today, iso) {
  const start = new Date(today)
  start.setDate(today.getDate() - weekDayOffset(today.getDay(), weekStartOf(S)))
  const done = new Set((S.workouts || []).map(w => w.d))
  const out = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(start)
    d.setDate(start.getDate() + i)
    const day = isoOf(d)
    const planned = effectiveRoutineIds(S, day).length > 0
    const moved = S.dayPlan && S.dayPlan[day] !== undefined
    const state = done.has(day) ? 'done' : dayNoteOf(S, day) ? 'noted' : moved && planned ? 'ovr' : planned ? 'plan' : ''
    out.push({ iso: day, weekday: d.getDay(), date: d.getDate(), state, today: day === iso })
  }
  return out
}
