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

import { isSimple } from '../store/useStore.js'

/** Drop-set / rest-pause picker on an exercise config. */
export const showsIntensifier = (S, config) =>
  !isSimple(S) || Boolean(config && config.intensifier && config.intensifier.type)

/** Planned warm-up ramp stepper. Ramps are excluded from volume and records —
 *  a rule you have to know before the setting means anything. */
export const showsWarmupRamp = (S, config) =>
  !isSimple(S) || Number((config && config.warmupSets) || 0) > 0

/** The button that chains this exercise with the one next to it.
 *  `linked` = this row is ALREADY part of a superset. */
export const showsSupersetControl = (S, linked) => !isSimple(S) || Boolean(linked)

/** The whole "Equipment" section in Settings. */
export const showsEquipmentProfiles = S =>
  !isSimple(S) || ((S && S.equipProfiles) || []).length > 0

/** Body map (fatigue / retained strength / muscle balance) and effort histogram. */
export const showsBodyMap = S => !isSimple(S)
export const showsEffortHistogram = S => !isSimple(S)

/** Estimated 1RM curve — an Epley extrapolation, not a measurement. */
export const showsEstimated1RM = S => !isSimple(S)

/** The RIR/RPE scale picker in Settings. Hidden at the simple level unless the
 *  member already logs one: turning the setting invisible while the column is
 *  still asked for on every set is the worst of both. */
export const showsEffortSetting = S => {
  const chosen = S && S.effort
  return !isSimple(S) || (chosen === 'rir' || chosen === 'rpe')
}
