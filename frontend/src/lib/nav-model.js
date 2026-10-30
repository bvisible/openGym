//// Neoffice — added file (no upstream equivalent).
////
//// What the bottom bar holds (30.10, the pilot club's review of the plan: the Start button must stay in the middle, and the classes need a place a member can see).
//// Pure, so a test can read it without mounting the bar: components/TabBar.jsx only draws what this says.
////
//// FIVE places, always two on each side of the Start button:
////   Home · Plan | Start | Coach · Stats
//// - the second place is « Planning » when the club runs classes (the screen then carries two segments, « My sessions » and « Group
////   classes », views/Planning.jsx) and « Plan » when it does not: the word says what is inside;
//// - the third place is « Coach » when the club has a coach or Nora, and « Exercises » when it has neither: the bar keeps its
////   shape, only the place changes;
//// - the account is not a tab: it is the round button at the top right of every screen of the bar (components/AccountButton.jsx).
//// The Start button is centred by the bar's grid (index.css lives apart: src/tabbar-centered.css), not by counting tabs.

/**
 * @param {{ classes?: boolean, coach?: boolean, library?: boolean }} opts `classes`: the club runs classes and the member wants them; `coach`: a coach or Nora
 * is there; `library`: the catalogue has a place (from the Normal level up, lib/level-visibility.js showsLibraryTab: at Simple the bar has one place less
 * on the right when there is no coach, and the Start button stays in the middle all the same).
 */
export function barModel({ classes = false, coach = false, library = true } = {}) {
  return {
    left: ['home', classes ? 'planning' : 'plan'],
    right: [coach ? 'coach' : (library ? 'library' : null), 'stats'].filter(Boolean),
  }
}

/**
 * Whether the Plan place carries a door to the exercise catalogue: the member's level has a catalogue (`library`, Normal and up) but the Coach place
 * took its seat in the bar (`coach`). Without it the catalogue would have no way in at all once a club has a coach (found on screen, 30.10).
 * At Simple (`library` false) there is no door on purpose: the plan's and the workout's « Add exercise » reach the catalogue.
 */
export const libraryDoor = ({ coach = false, library = true } = {}) => !!coach && !!library

/**
 * Whether the club's classes are reachable at all (`club`: a server behind them, a club that runs classes) and whether this member wants
 * them in the bar (`bar`: their own setting `classesTab`, which defaults to yes: `!== false`, not `=== true`, otherwise the place would
 * change its name for as long as the state takes to arrive from the server). The standalone mobile and demo builds have no server at all.
 */
export function classesPlaces({ mobile = false, demo = false, perms, classesTab } = {}) {
  const club = !mobile && !demo && !(perms && perms.classes === false)
  return { club, bar: club && classesTab !== false }
}

/** Each place's route and glyph (the label is drawn by the bar, through t() literals, so the string checks see it). */
export const BAR_PLACES = {
  home: { path: '/home', icon: 'house' },
  plan: { path: '/plan', icon: 'clipboard' },
  planning: { path: '/plan', icon: 'calendar' },
  coach: { path: '/coach-hub', icon: 'chat' },
  library: { path: '/library', icon: 'dumbbell' },
  stats: { path: '/stats', icon: 'chart' },
}

/**
 * Which place a screen lights. A screen without a place of its own lights the one it is opened from (Muscles from the library or from Stats),
 * and the screens that moved under a place keep it lit: group classes under Plan / Planning, the library under Plan when there is no library place.
 * `cur` is the first path segment, `fromStats` whether the screen was opened from Stats (location.state.from).
 */
export function litPlace(cur, { coach = false, fromStats = false } = {}) {
  const own = { home: 'home', plan: 'plan', stats: 'stats', coach: 'coach', 'coach-hub': 'coach', library: 'library' }
  if (cur === 'classes') return 'plan'
  if (cur === 'muscles') return fromStats ? 'stats' : (coach ? 'plan' : 'library')
  if (cur === 'library' && coach) return 'plan'
  const parent = { history: 'stats', 'structural-balance': 'stats', 'progress-photos': 'stats', measurements: 'stats', checkin: 'home', membership: null, settings: null }
  if (cur in parent) return parent[cur]
  return own[cur] || null
}

/** The screens that carry the round account button: the places of the bar, by exact path (a screen with its own back button keeps its header to itself). */
export const ACCOUNT_SCREENS = new Set(['/home', '/plan', '/stats', '/coach-hub', '/library'])
