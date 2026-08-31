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
