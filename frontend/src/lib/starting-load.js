//// Neoffice — added file (no upstream equivalent).
////
//// A starting load for an exercise the member has never done.
////
//// Asked for by Olympia on 2026-08-31, as the second use of the detail level:
//// *"les charges de départ (peut-être aussi)"*. Today a new exercise arrives
//// at `weight: 0` and the member has to guess — which, in a room, means asking
//// the person next to them or loading whatever is already on the bar.
////
//// 🔴 THE ONE RULE THIS MODULE IS BUILT AROUND: never invent a number.
////
//// A suggested load is not a UI nicety. Suggest 40 kg to somebody who bench
//// presses 25 and they either fail the rep with a bar over their chest, or
//// they believe the app knows something about them that it does not. So:
////
////   * the suggestion comes ONLY from what this member has already lifted.
////     There is no table of norms, no bodyweight ratio, no age or sex
////     coefficient — those describe populations, and nobody trains a
////     population;
////   * with nothing comparable to go on, the answer is NULL. Zero and a blank
////     field are honest; a confident guess is not. This is the common case for
////     a new member and it must stay the quiet one;
////   * it looks for the LIGHTEST comparable exercise, not the average and not
////     the best. Starting under is a set that felt easy; starting over is an
////     injury;
////   * and it is a starting point that says where it came from. The caller
////     shows the source ("d'après votre tirage vertical"), so the member can
////     judge the reasoning instead of trusting a number.
////
//// Comparable means SAME TARGET MUSCLE AND SAME EQUIPMENT. Both halves matter:
//// a dumbbell press and a machine press are not the same load even though they
//// train the same muscle, and a barbell row and a barbell curl share equipment
//// and nothing else.

import { EXIDX } from './exercises.js'
import { lastEntryFor } from './history.js'

/** Round down to something you can actually load on the bar or find on the rack.
 *
 *  Down, never to nearest: rounding 22.5 up to 25 hands the member a heavier
 *  set than the evidence supports, which is the one direction this module is
 *  not allowed to be wrong in.
 */
export function roundDownToPlate(weight, step = 2.5) {
  if (!weight || weight <= 0) return 0
  return Math.max(step, Math.floor(weight / step) * step)
}

/** The exercises this member has lifted that are comparable to `exId`. */
function comparableEntries(S, exId) {
  const target = EXIDX[exId]
  if (!target) return []

  const out = []
  for (const id of Object.keys(EXIDX)) {
    if (id === exId) continue
    const ex = EXIDX[id]
    if (!ex || ex.tg !== target.tg || ex.eq !== target.eq) continue
    const last = lastEntryFor(S, id)
    if (!last) continue
    //// The heaviest WORK set of that exercise: it is what the member handles
    //// there, and lastEntryFor already excludes warm-up rows for exactly the
    //// reasons written at its own definition.
    const heaviest = (last.sets || [])
      .filter(s => s.done && Number(s.w) > 0)
      .reduce((m, s) => Math.max(m, Number(s.w)), 0)
    if (heaviest > 0) out.push({ id, name: ex.n, weight: heaviest })
  }
  return out
}

/** A starting load for `exId`, or null when there is nothing honest to say.
 *
 *  Returns `{ weight, fromId, fromName }` so the caller can name its source.
 */
export function suggestStartingLoad(S, exId, step = 2.5) {
  if (!S || !exId) return null
  //// Already done it: that is not a suggestion, it is history, and
  //// progression owns it. Answering here would fight the progression rules.
  if (lastEntryFor(S, exId)) return null

  const comparable = comparableEntries(S, exId)
  if (!comparable.length) return null

  //// The LIGHTEST comparable exercise, then rounded down. Two deliberate steps
  //// in the same direction: the first exposure to a new movement should be a
  //// set the member finishes, not one they discover they cannot.
  const lightest = comparable.reduce((a, b) => (b.weight < a.weight ? b : a))
  const weight = roundDownToPlate(lightest.weight, step)
  if (!weight) return null

  return { weight, fromId: lightest.id, fromName: lightest.name }
}
