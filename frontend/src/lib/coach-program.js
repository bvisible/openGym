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

  //// mergePlan gives every imported routine a BRAND-NEW id so it never
  //// overwrites the member's own — and it keeps its mapping table to itself.
  //// The cycle, though, speaks in the BUNDLE's ids: without rebuilding that
  //// map, week 2 would point at nothing.
  ////
  //// It is rebuilt from the ORDER: mergePlan appends the bundle's routines in
  //// bundle order. That is what its code does, and the test "week 2 points at
  //// the right routines" checks it — if upstream ever changed that order, the
  //// test would fail before anyone noticed on screen.
  const added = (s.routines || []).filter(r => !before.has(r.id))
  const idMap = {}
  added.forEach((r, i) => {
    r.coachProgram = offer.program
    r.coachVersion = offer.version
    //// The name, so the routine list can say where they came from as soon as
    //// they are imported — without waiting for the first server round trip,
    //// which sends it back afterwards (the server is authoritative; a copied
    //// name would be wrong the moment the coach renames their program).
    r.coachProgramName = bundle.name || undefined
    const source = bundle.routines[i]
    if (source) idMap[source.id] = r.id
  })
  attachCycle(s, offer, bundle, idMap)
  return { added: bundle.routineCount, replaced, dropped: bundle.dropped }
}

/**
 * Keep the calendar of a periodized program.
 *
 * The logbook has only ONE typical week — that is its model, and changing it
 * would touch everything that reads it. So we keep the cycle alongside, and
 * LAY THE WEEK DOWN AGAIN whenever the member moves to another cycle week. The
 * logbook's own mechanism stays intact, it is simply re-fed.
 */
export function attachCycle(s, offer, bundle, idMap) {
  const raw = (offer.bundle && offer.bundle.cycle) || null
  if (!raw || !raw.weeks) {
    // A non-periodized program clears the previous one's cycle: otherwise a
    // "single typical week" v2 would leave v1's calendar running.
    if (s.coachCycle && s.coachCycle.program === offer.program) delete s.coachCycle
    return
  }
  const weeks = {}
  Object.keys(raw.weeks).forEach(n => {
    const day = {}
    Object.entries(raw.weeks[n] || {}).forEach(([d, rid]) => { day[d] = idMap[rid] || rid })
    weeks[n] = day
  })
  s.coachCycle = {
    program: offer.program,
    // The program's name, so the banner says WHICH one. A member following
    // strength and cardio at once has two calendars; "your program" does not
    // tell them which is meant.
    name: bundle.name || null,
    version: offer.version,
    span: raw.span || Object.keys(weeks).length,
    weeks,
    // Where the count starts. The coach's own start date when they set one,
    // otherwise today — a member who accepts on a Tuesday starts week 1 that
    // Tuesday, not the following Monday.
    startedOn: offer.startDate || todayISO(),
    appliedWeek: null
  }
  syncCycleWeek(s)
}

const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * Lay down the cycle week that matches today.
 *
 * Does NOTHING when the week has not changed: re-laying the schedule on every
 * open would wipe the day a member moved mid-week, and they would not
 * understand why their Tuesday keeps coming back on its own.
 *
 * Returns the current week number, or null when there is no cycle.
 */
export function syncCycleWeek(s, when) {
  const c = s.coachCycle
  if (!c || !c.weeks) return null
  const n = cycleWeekOf(c, when)
  if (c.appliedWeek === n) return n
  const plan = c.weeks[String(n)]
  if (plan) {
    // The cycle week REPLACES: the days it leaves empty become rest days. A
    // half-replaced week would mix two program weeks together, and this is
    // already the rule the import follows.
    s.week = { ...plan }
  }
  c.appliedWeek = n
  return n
}

/** Where the member stands in their cycle — 1 to `span`, and it wraps. */
export function cycleWeekOf(cycle, when) {
  const span = Math.max(1, cycle.span || 1)
  const start = new Date(cycle.startedOn + 'T00:00:00')
  const now = when ? new Date(when + 'T00:00:00') : new Date()
  const days = Math.floor((now - start) / 86400000)
  // Before the start date we are in week 1: a program dated next week is
  // being prepared, it does not send you back to the end of a previous cycle.
  if (days < 0) return 1
  return (Math.floor(days / 7) % span) + 1
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
      name: bundle.name,
      // The number of weeks, when the program has them. Without it a
      // four-week cycle announces itself as "scheduled over 3 days" — the
      // member accepts what looks like a typical week and finds out later
      // that their schedule changes on its own.
      cycleSpan: (offer.bundle && offer.bundle.cycle && offer.bundle.cycle.span) || 0
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
