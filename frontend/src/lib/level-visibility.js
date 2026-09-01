//// Neoffice — added file (no upstream equivalent).
////
//// What the simple level shows, in ONE place.
////
//// These rules were inline JSX conditions at first, spread over four files.
//// That is exactly the shape an upstream merge destroys without a conflict:
//// upstream rewrites the surrounding block, our condition disappears with it,
//// nothing fails, and a beginner gets the technical screen back.
////
//// Gathered here they are: readable in one pass, testable without mounting a
//// screen, and greppable at the next merge.
////
//// THE RULE THEY ALL FOLLOW: hide the CONTROL, never the DATA. Someone whose
//// exercise already carries a drop-set, a warm-up ramp, a superset or an
//// equipment profile keeps seeing it — and keeps being able to undo it.
//// Hiding a control that is already in use does not simplify anything: it
//// traps the member with a setting they can no longer reach.

import { atLeast, isSimple } from '../store/useStore.js'

/** Drop-set / rest-pause picker on an exercise config. */
export const showsIntensifier = (S, config) =>
  atLeast(S, 'full') || Boolean(config && config.intensifier && config.intensifier.type)

/** Planned warm-up ramp stepper. Ramps are excluded from volume and records —
 *  a rule you have to know before the setting means anything. */
export const showsWarmupRamp = (S, config) =>
  atLeast(S, 'full') || Number((config && config.warmupSets) || 0) > 0

/** The button that chains this exercise with the one next to it.
 *  `linked` = this row is ALREADY part of a superset. */
export const showsSupersetControl = (S, linked) => atLeast(S, 'full') || Boolean(linked)

/** The whole "Equipment" section in Settings. */
export const showsEquipmentProfiles = S =>
  atLeast(S, 'normal') || ((S && S.equipProfiles) || []).length > 0

/** Body map: fatigue, retained strength, muscle balance.
 *  From `normal` up — it is a picture, and a picture is readable without a
 *  vocabulary lesson. */
export const showsBodyMap = S => atLeast(S, 'normal')

/** Estimated 1RM curve. Also from `normal`: a member past their first weeks
 *  wants to know roughly what they could lift, and the label says "estimated". */
export const showsEstimated1RM = S => atLeast(S, 'normal')

/** The effort histogram — RIR/RPE, "how close to failure". FULL only: it is the
 *  one reading that requires being taught a scale before it means anything. */
export const showsEffortHistogram = S => atLeast(S, 'full')

/** The RIR/RPE scale picker in Settings. Hidden at the simple level unless the
 *  member already logs one: turning the setting invisible while the column is
 *  still asked for on every set is the worst of both. */
export const showsEffortSetting = S => {
  const chosen = S && S.effort
  return atLeast(S, 'full') || chosen === 'rir' || chosen === 'rpe'
}

//// ─── the LIVE session screen ───────────────────────────────────────────────
//// The rules above were written for the config sheet and for Settings, and I
//// stopped there. Found on screen on 31.08, at the Normal level, on a workout
//// whose exercises carried nothing at all: "+ Drop", "+ Burst" and "Add
//// warm-up set" were sitting under every set. A member who asked for a
//// simpler journal got the jargon back the moment they started training —
//// which is precisely the screen they spend their time on.
////
//// Same shape as the others, and the same exception: a row that ALREADY
//// carries drops or clusters keeps its chips, so nobody is trapped mid-set
//// with an intensifier they cannot extend or match.

/** The in-session "+ Drop" / "+ Burst" chips under a live set.
 *  `intensified` = this row already carries drops or rest-pause clusters. */
export const showsSetIntensifierChips = (S, intensified) =>
  atLeast(S, 'full') || Boolean(intensified)

/** The in-session "Add warm-up set" button.
 *  `hasWarmups` = this exercise already has warm-up rows in the session. */
export const showsInSessionWarmup = (S, hasWarmups) =>
  atLeast(S, 'full') || Boolean(hasWarmups)

/** The "Rest-pause rest" row in Settings.
 *
 *  Found by views/jargon.level.test.jsx: it was drawn unconditionally, so a
 *  beginner's Settings screen carried the words "rest-pause" for a technique
 *  they will never see offered anywhere else at their level. Hiding a control
 *  while the term it names sits in Settings is the worst of both.
 *
 *  Kept once the member has moved it off the default: they changed it, so they
 *  know what it is, and taking it away would be the trap this whole module
 *  exists to avoid.
 */
export const showsRestPauseSetting = (S, defaultSec = 15) =>
  atLeast(S, 'full') || Number((S && S.restPauseSec) ?? defaultSec) !== defaultSec
