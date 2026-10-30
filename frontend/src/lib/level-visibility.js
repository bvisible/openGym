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

import { atLeast, isSimple } from './level.js'

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

//// Neoffice — the link of the ROUTINE EDITOR (the paperclip between two exercises) is offered at every level.
//// The pilot club (23.10) asked to link two exercises as a superset with the paperclip, even three, because the coach does it
//// all the time with beginners. The coach builds the plan, the beginner only follows it, so the control the coach
//// reaches for must not be one a level hides. Chaining three is the same gesture twice (the second row links to the first,
//// the third to the second). The pair buttons of the LIVE session (Workout.jsx) keep `showsSupersetControl`: a member in the
//// middle of a set is not offered a technique he was never taught (views/jargon.level.test.jsx).
export const showsRoutineSupersetLink = () => true

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

/** The "Rest between warm-ups" row in Settings (upstream v1.4.2).
 *
 *  Warm-up sets are a technique of the full level here (the ramp stepper and the in-session « Add warm-up set » are hidden below it),
 *  so a setting that times the rest between them goes with them. Kept once the member has moved it off « like the work sets »
 *  (a number, 0 for no timer): they changed it, so they know what it is. */
export const showsWarmupRestSetting = S =>
  atLeast(S, 'full') || typeof (S && S.warmupRestSec) === 'number'

//// ─── what v1.4 added ───────────────────────────────────────────────────────
//// Upstream's v1.4 brought four techniques a beginner was never taught. Same
//// shape as the rest, same exception: a plan, an exercise or a set that already
//// carries one keeps its control, so nobody is trapped with a setting they can
//// no longer reach. Found by reading the merge, not by the pilot club — the
//// point of keeping the rules in one place.

/** "Last set to failure" on an exercise config and "Taken to failure" in a set's
 *  menu. Training until nothing is left is a technique, and it changes how the
 *  effort is read (a failure set counts as RIR 0): taught before the switch
 *  means anything. `inUse` = this exercise plans it, or one of its sets carries it. */
export const showsFailureControl = (S, inUse) => atLeast(S, 'full') || Boolean(inUse)

/** Back-off sets on an exercise config: lighter sets after the top one. */
export const showsBackoffControl = (S, config) => atLeast(S, 'full') || Boolean(config && config.backoff === true)

/** Triple progression among the progression rules (sets first, then load). */
export const showsTripleProgression = (S, config) => atLeast(S, 'full') || Boolean(config && config.prog === 'triple')

/** The 1RM formula in Settings. From `normal`, like the estimated 1RM curve it
 *  feeds; kept once the member has chosen one, whatever the level. */
export const showsOneRmFormula = S => atLeast(S, 'normal') || Boolean(S && S.oneRmFormula)

//// ─── what the simple level no longer carries in an exercise's settings (12.10) ─────────────
//// The sheet a member opens on an exercise should hold, at Simple, what a first week needs:
//// reps or time, sets, weight, rest, bodyweight. Four things move up to Normal:
//// « different reps per set », « per side », plate loading and the
//// progression section (rule, step, deload). Same shape as everything above, same exception:
//// the CONTROL leaves, never the DATA — an exercise that already uses one keeps it, so nobody is
//// trapped with a setting they can no longer reach. A program written at the desk, or by the
//// member at a higher level, therefore looks the same at every level.

/** « Different reps per set » (a pyramid, a ramp) on an exercise config.
 *  `inUse` = the exercise already carries a per-set plan. */
export const showsSetPlanControl = (S, inUse) => atLeast(S, 'normal') || Boolean(inUse)

/** « Per side » on an exercise config. `inUse` = the exercise IS per side, by its own config or
 *  by what it is (a lunge, a single-arm row): the switch stays where it is on. */
export const showsPerSideControl = (S, inUse) => atLeast(S, 'normal') || Boolean(inUse)

/** Plate loading: the section of the exercise sheet, the editor of the exercise's detail sheet and
 *  the entry of the live session's exercise menu. Kept once this exercise has a bar weight of its
 *  own or its own way of loading (`S.barWeights`, `S.loadKind`). The plate line under each set,
 *  which the club's plates and the exercise's defaults draw, is an output, not a control. */
export const showsPlateLoading = (S, exId) => atLeast(S, 'normal')
  || (Boolean(exId) && (S?.loadKind?.[exId] != null || typeof S?.barWeights?.[exId] === 'number'))

/** The progression section of an exercise (rule, step, deload) and the routine's own rule row.
 *  `config` = the exercise's config or the routine: kept when it carries a rule of its own, a
 *  step, a deload, back-off sets, or is a deload routine. */
export const showsProgressionControls = (S, config) => atLeast(S, 'normal')
  || Boolean(config && (config.prog || config.inc > 0 || config.deloadFactor != null || config.backoff === true || config.excludeFromProgression === true))

//// ─── Simple, « de gros bébé » (30.10) ──────────────────────────────────────────────────────────────────
//// Asked for by the pilot club, who had three of its members who did not know the journal try it: « trop d'informations, trop de
//// texte, intimidant pour un débutant » (29.10), then by Jérémy: « un truc de Google, de gros bébé ». What Simple keeps is what
//// a person does in front of a machine: the exercise (its picture), its sets, repetitions, weight and rest. Everything below leaves
//// the screen at Simple and comes back at Normal. Same rule as above: the CONTROL goes, never the DATA, and what a plan, an
//// exercise or a set already carries keeps its control.

/** The exercise sheet's « Rest between warm-ups » row. Warm-ups are a Full technique here (their ramp and their in-session button are
 *  hidden below it), so the row that times the rest between them goes with them, unless this exercise already carries one. */
export const showsWarmupRestRow = (S, config) =>
  atLeast(S, 'full') || Number((config && config.warmupSets) || 0) > 0
  || (config && (config.warmupRestOff === true || Number(config.warmupRestSec) > 0)) || false

/** The exercise sheet's « Backups » row (the planned replacement for a taken machine): from Normal, or once the exercise has some. */
export const showsBackupsRow = (S, config) =>
  atLeast(S, 'normal') || Boolean(config && Array.isArray(config.subs) && config.subs.length)

/** The exercise sheet's « Bodyweight » switch: the catalogue already knows which exercises are bodyweight. From Normal, or once on. */
export const showsBodyweightSwitch = (S, on) => atLeast(S, 'normal') || Boolean(on)

/** What the plan and the session say about MUSCLES: the figure under a routine, in the workout's header and on the home card, the
 *  muscle chip under an exercise's name. A picture, but a second thing to read on a screen that has one job. */
export const showsMuscleInfo = S => atLeast(S, 'normal')

/** The equipment and best-set chips under an exercise's name during a workout. */
export const showsExerciseChips = S => atLeast(S, 'normal')

/** Copying a routine and printing the plan: the plan's tools, from Normal. */
export const showsPlanTools = S => atLeast(S, 'normal')

/** The seasonal layer (Halloween's cobweb, bats and pumpkin, v1.4.3) and its settings: from Normal. A member who switched a season ON keeps it. */
export const showsSeasonalThemes = (S, id) => atLeast(S, 'normal') || Boolean(id && S && S.seasonal && S.seasonal[id] === 'on')

/** The performance report (PDF) and the exports (CSV): from Normal. */
export const showsReports = S => atLeast(S, 'normal')

/** The home screen: its extra cards. At Simple it keeps the club's notices, the badges, a coach's offer, today's session, the
 *  check-in codes and the next class; the rest (floor plan, challenges, the week's recent workouts, weight, streak) is one tab away. */
export const showsHomeExtras = S => atLeast(S, 'normal')

/** The « Exercises » tab (the catalogue to browse): from Normal. At Simple the plan and the workout's own « Add exercise » reach the catalogue,
 *  and a bar of five or six tabs has room to read. */
export const showsLibraryTab = S => atLeast(S, 'normal')

/** The live workout's menus: moving an exercise up or down, and choosing the layout (cards, list, focus): from Normal. At Simple the plan
 *  already says the order, and the cards layout is the one a beginner meets. */
export const showsExerciseOrder = S => atLeast(S, 'normal')
export const showsLayoutChoice = S => atLeast(S, 'normal')

/** The finish summary's volume tile (weight × reps, summed): from Normal. At Simple it says how long, how many sets, and a record when there is one. */
export const showsSessionVolume = S => atLeast(S, 'normal')
