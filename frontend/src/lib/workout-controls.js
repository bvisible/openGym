// Which optional control groups the workout screen shows besides the sets themselves
// (Settings → During a workout → Workout controls). The lean default keeps the sets and one
// "more" button per exercise; each flag brings one of the old always-visible groups back.
// Lives in its own module so views can read it without the store — the store's DEF only
// references it.
//// Neoffice — the level of the journal (lib/level.js).
import { isSimple } from './level.js'
export const WC_DEFAULT = Object.freeze({
  steppers: true,         // +/- buttons on every weight/reps/effort field
  setShortcuts: false,    // "+ Drop" / "+ Burst" chips on every set and the warm-up/remove/add row
  pairButtons: false,     // "Make superset with previous/next" in the exercise header
  exerciseButtons: false, // Move up/down, Swap, Remove exercise below the exercise
  exerciseChips: true,    // the numbered chip per exercise at the top of the workout (#323); one row
                          // of fixed height that replaces the "Exercise 2 / 5" line in Cards and Focus
  muscleMap: true,        // the tiny body in the workout header that fills in as sets are ticked (#670);
                          // no taller than the header's buttons, so it costs no height
  swipeSets: true,        // swipe actions: a set row (start deletes with Undo, end copies) and, despite the
                          // name, Plan's routines, loop and routine exercises too (Settings: "Swipe actions")
})

//// Neoffice — at the Simple level the figure in the workout's header is off (lib/level-visibility.js showsMuscleInfo): a picture that fills
//// in as sets are ticked is a second thing to watch on a screen that has one job. A member's own choice (S.wc) still wins.
export function workoutControls(S) {
  return { ...WC_DEFAULT, ...(isSimple(S) ? { muscleMap: false } : {}), ...((S && S.wc) || {}) }
}
