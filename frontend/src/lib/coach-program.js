//// Neoffice — added file (no upstream equivalent).
////
//// Upstream's plan sharing is member-to-member: a file you hand a friend, which
//// `mergePlan` folds in as brand-new routines. That is exactly right for a
//// friend, and exactly wrong for a coach, for one reason — a coach REVISES.
//// Sending version 2 of a program through the plain import would leave the
//// member with both versions side by side, and neither of them marked.
////
//// So a routine that arrived from a coach carries `coachProgram` (the program
//// it came from) and `coachVersion`. Nothing upstream reads those keys, and
//// `buildPlanBundle` does not copy them — so a member who shares their plan
//// with a friend hands over the routines without the attachment to our club's
//// program, which is what you want on both counts.

import { parsePlan, mergePlan } from './plan-share.js'

/**
 * Fold a coach's program into the member's state, replacing what an earlier
 * version of the SAME program had put there.
 *
 * Returns what happened, so the caller can say it out loud: a revision that
 * silently deletes routines the member had been training is the one thing this
 * must never do without telling them.
 */
export function applyCoachProgram(s, offer) {
  const bundle = parsePlan(offer.bundle)
  const replaced = removeProgramRoutines(s, offer.program)
  const before = new Set((s.routines || []).map(r => r.id))
  mergePlan(s, bundle, { schedule: offer.replaceSchedule })
  ;(s.routines || []).forEach(r => {
    if (!before.has(r.id)) {
      r.coachProgram = offer.program
      r.coachVersion = offer.version
    }
  })
  return { added: bundle.routineCount, replaced, dropped: bundle.dropped }
}

/**
 * Drop every routine this program had previously installed, and any weekday
 * pointing at one.
 *
 * The week is cleaned even when the new bundle does not replace the schedule:
 * a day left pointing at a deleted routine renders an empty session the member
 * cannot start, and that is worse than an honest rest day.
 */
export function removeProgramRoutines(s, program) {
  const doomed = new Set((s.routines || []).filter(r => r.coachProgram === program).map(r => r.id))
  if (!doomed.size) return 0
  s.routines = (s.routines || []).filter(r => !doomed.has(r.id))
  Object.keys(s.week || {}).forEach(d => { if (doomed.has(s.week[d])) delete s.week[d] })
  return doomed.size
}

/** How many routines a member is currently training from this program. */
export function countProgramRoutines(s, program) {
  return (s.routines || []).filter(r => r.coachProgram === program).length
}

/**
 * Describe a parsed offer without applying it — what the offer screen shows.
 *
 * Parsing here rather than in the sheet means a malformed bundle surfaces as a
 * message on the offer, not as a blank screen after the member taps Accept.
 */
export function describeOffer(offer) {
  try {
    const bundle = parsePlan(offer.bundle)
    return {
      ok: true,
      routineCount: bundle.routineCount,
      exerciseCount: bundle.exerciseCount,
      scheduledDays: bundle.scheduledDays,
      dropped: bundle.dropped,
      name: bundle.name
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
