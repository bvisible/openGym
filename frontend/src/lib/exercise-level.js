//// Neoffice — added file (no upstream equivalent).
////
//// Which exercises a member is OFFERED, by detail level.
////
//// Asked for by Olympia on 2026-08-31, alongside the three levels: *"filtrer
//// les exercices proposés"*. The catalogue is 1324 movements built by and for
//// advanced lifters; a beginner opening it lands on hang power snatches next
//// to sit-ups, with nothing telling them the two are not interchangeable.
////
//// 🔴 OFFERED, NOT ALLOWED. This is the same rule as everywhere else in the
//// level work: hide the CONTROL, never the DATA. Concretely, and it is what
//// keeps this from becoming a smaller product:
////
////   * SEARCH IS NEVER FILTERED. Type "snatch" and you get snatches, at every
////     level. A member whose coach prescribed one must be able to log it, and
////     an exercise you cannot find is indistinguishable from one that does not
////     exist.
////   * The filter is VISIBLE AND REVERSIBLE, next to the equipment filter that
////     already works this way — "Show every exercise" is one tap.
////   * Anything the member already uses, has favourited, or the club picked is
////     never hidden. Removing an exercise from under a running programme is
////     how you make someone think their plan was deleted.
////
//// DERIVATION, and why not a hand-annotated list: the dataset carries no
//// difficulty field, and annotating 1324 rows by hand would be 1324 chances to
//// be wrong, unreviewable, and stale the day upstream adds a row. Two signals
//// carry almost all of it instead:
////
////   1. THE MOVEMENT, by name. Olympic lifts and gymnastic skills are advanced
////      whatever they are done with — a muscle-up is body weight, and it is not
////      a beginner's exercise. Name patterns win over equipment for exactly
////      this reason.
////   2. THE EQUIPMENT. A guided machine imposes the path: there is no balance
////      to manage and far less to do wrong unsupervised. Free weights ask for
////      technique before they ask for strength.
////
//// The result is a suggestion, not a verdict. It is allowed to be imperfect on
//// a given row — the cost of being wrong is that somebody taps "show every
//// exercise", which is one tap and is written on screen.

import { atLeast } from '../store/useStore.js'

//// Olympic lifts, their variants, and gymnastic skills. Matched on the ENGLISH
//// name, which is what the dataset stores (`ex.n`) — translations never reach
//// here, so a French UI classifies identically to an English one.
const ADVANCED_PATTERNS = [
  'snatch', 'clean', 'jerk',                     // olympic lifts and their variants
  'muscle up', 'muscle-up', 'planche', 'front lever', 'human flag',
  'pistol', 'handstand', 'kipping', 'get-up', 'get up',
  'overhead squat', 'plyo', 'depth jump', 'sissy', 'nordic',
]

//// Guided or self-limiting: the machine holds the path, or the load is your own
//// body in a position you can simply stop. Where a beginner can be sent alone.
const SIMPLE_EQUIPMENT = new Set([
  'body weight', 'leverage machine', 'smith machine', 'cable', 'assisted',
  'sled machine', 'band', 'stability ball', 'medicine ball', 'rope',
  'elliptical machine', 'stationary bike', 'skierg machine', 'stepmill machine',
  'upper body ergometer', 'tire', 'wheel roller', 'bosu ball',
])

/** The level from which an exercise is offered: 'simple' | 'normal' | 'full'.
 *
 *  Deliberately independent of the member — it is a property of the movement,
 *  so it is worth computing once and is trivial to reason about in a test.
 */
export function exerciseLevelOf(ex) {
  if (!ex) return 'simple'
  //// A custom exercise the member or the club wrote is theirs, and nobody
  //// asked us to grade it. Never hidden.
  if (ex.custom || ex.isCustom) return 'simple'

  const name = String(ex.n || '').toLowerCase()
  //// The movement first: equipment cannot make a snatch a beginner's exercise.
  if (ADVANCED_PATTERNS.some(p => name.includes(p))) return 'full'

  return SIMPLE_EQUIPMENT.has(String(ex.eq || '').toLowerCase()) ? 'simple' : 'normal'
}

/** Should this exercise be OFFERED to this member?
 *
 *  `inUse` covers the three "already theirs" cases the caller knows about and
 *  this module does not: logged before, favourited, or picked by the club.
 *  Passing it in rather than reading the store keeps this a pure function —
 *  and keeps the exception impossible to forget, since it is an argument.
 */
export function suitsLevel(S, ex, inUse) {
  if (inUse) return true
  return atLeast(S, exerciseLevelOf(ex))
}

/** Does the level filter actually remove anything for this member?
 *
 *  Used to decide whether to draw the "showing simpler exercises" line at all:
 *  a member on the full level must not be told about a filter that is doing
 *  nothing, and an explanation for an invisible rule is just noise.
 */
export const levelFiltersExercises = S => !atLeast(S, 'full')
