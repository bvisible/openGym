import { EXDB } from './exercises-data.js'
import { t } from './i18n-core.js'

export { EXDB }

// The generated dataset already supplies secondary muscles for most exercises. Keep the
// handful of conservative catalogue additions that are useful to the muscle map here so a
// dataset refresh does not erase them. Values follow the dataset's existing alias vocabulary.
const SECONDARY_ADDITIONS = {
  '0027': ['rear deltoids'], // barbell bent over row
  '0293': ['rear deltoids'], // dumbbell bent over row
  '0499': ['rear deltoids'], // inverted row
  '0861': ['rear deltoids'], // cable seated row
}

// Secondary muscles for an exercise, with the small conservative additions applied as an
// overlay. The raw dataset is never mutated - consumers that want the pristine catalogue
// (export, print, import) keep reading EXDB untouched, while the muscle map sees the
// enriched list. Values follow the dataset's existing alias vocabulary.
export const smOf = ex => {
  const base = Array.isArray(ex?.sm) ? ex.sm : (ex?.sm ? [ex.sm] : [])
  return [...new Set([...base, ...(SECONDARY_ADDITIONS[ex?.id] || [])])]
}

export const EXIDX = {}
EXDB.forEach(e => { EXIDX[e.id] = e })

//// Neoffice — exercise names follow the language.
////
//// Upstream translates the instructions but not the names: the library stays
//// English in every language. So we apply a name pack (src/names/<lang>.js)
//// whenever the language changes.
////
//// The translation MUTATES `e.n` on the EXDB objects rather than adding a
//// nameFor(ex) called everywhere. The reason is the number of callers: the
//// name is read by the list, the search, the filters, the detail sheet, the
//// timer, the printable PDF, the CSV export and the session feed. An accessor
//// would have been forgotten in one place — and that place would have been an
//// English screen in the middle of a French app, with no error to flag it.
////
//// The English name stays available as `e.en`, which makes the search
//// BILINGUAL: typing "bench press" finds "développé couché". A member coming
//// from another app knows the English names.
////
//// `buildPlanBundle` copies only the id, never `n` — so a plan shared with a
//// friend stays language-neutral, which is what we want.
const ORIGINAL_NAMES = new Map()

export function applyExerciseNames(pack) {
  // First pass: remember the English before replacing it. Without that, a
  // second language change would translate a translation.
  if (!ORIGINAL_NAMES.size) EXDB.forEach(e => ORIGINAL_NAMES.set(e.id, e.n))
  EXDB.forEach(e => {
    const en = ORIGINAL_NAMES.get(e.id)
    e.en = en
    e.n = (pack && pack[e.id]) || en
  })
}
export const BODYPARTS = [...new Set(EXDB.map(e => e.bp))].sort()

// Equipment options present in a given list of exercises, most common first (issue #6).
// Deriving them from the *already filtered* list keeps the chip row short and means
// every body-part × equipment combination on screen has results behind it.
export function equipmentOf(list) {
  const c = {}
  list.forEach(e => { if (e.eq) c[e.eq] = (c[e.eq] || 0) + 1 })
  return Object.keys(c).sort((a, b) => c[b] - c[a] || (a < b ? -1 : 1))
}

// Custom (user-created) exercises live in synced state S.customEx (issue #11) and are
// merged into the id index here so every EXIDX[id] lookup keeps working unchanged.
let customIds = []
export function registerCustom(list) {
  customIds.forEach(id => delete EXIDX[id])
  customIds = (list || []).map(e => e.id)
  ;(list || []).forEach(e => { EXIDX[e.id] = e })
}
// Full searchable catalogue — customs first so your own exercises are easy to find.
export const allExercises = st => [...(st.customEx || []), ...EXDB]

// Media normally sits next to the app (img/ and gif/, mounted into the web container).
// A build can point them somewhere else — the demo build pulls them off a CDN instead of
// shipping ~140 MB of images into the deployment. `import.meta.env` is undefined in plain
// Node; the guard keeps this module loadable without Vite.
// The defaults are absolute on purpose (issue #79). A bare 'img/' resolves against the
// current document's directory, so on the one two-segment route in the app, /plan/r/:id,
// every request went to /plan/r/img/… and 404'd — and nginx's extension block has no
// try_files, so it 404s rather than falling through to index.html, leaving a blank image
// and nothing in the console.
const ENV = import.meta.env || {}
//// Neoffice — media is served by Frappe from the app, not from the site root:
//// '/img/' leads nowhere on a Frappe instance. The media/ folder is NOT in the
//// repository (see .gitignore) — the instance downloads it with
//// scripts/fetch-media.sh, the way upstream's `docker compose up` does for a
//// self-hoster. Environment variables still win: that is what lets the mobile
//// build point at a CDN.
const IMG_BASE = ENV.VITE_IMG_BASE || '/assets/opengym/media/img/'
const GIF_BASE = ENV.VITE_GIF_BASE || '/assets/opengym/media/gif/'
//// Neoffice — search matching, in a single place.
//// It ALSO looks at `e.en`, the English name kept by applyExerciseNames:
//// typing "bench press" in a French app finds "développé couché". A member
//// arriving from another application knows the English names, and coaches mix
//// the two when they speak.
export function matchesExercise(e, q) {
  if (!q) return true
  return (
    (e.n || '').toLowerCase().includes(q) ||
    (e.en || '').toLowerCase().includes(q) ||
    (e.tg || '').includes(q) ||
    (e.eq || '').includes(q) ||
    (e.desc || '').toLowerCase().includes(q)
  )
}

//// Neoffice — a club can put ITS OWN media on an exercise.
//// An absolute URL ("/files/…", set from the desk) is served as is; a bare
//// file name stays a library one and gets the folder prefix.
//// The test is on the shape of the value, not on a flag: the logbook has no
//// business knowing where a media comes from, only where to fetch it.
const isAbsolute = v => typeof v === 'string' && (v.startsWith('/') || v.startsWith('http'))
export const imgSrc = ex => (isAbsolute(ex.img) ? ex.img : IMG_BASE + ex.img)
export const gifSrc = ex => (isAbsolute(ex.gif) ? ex.gif : GIF_BASE + ex.gif)

//// Neoffice — the media a club has attached to library exercises, applied by
//// id. Nothing else on the sheet moves: the name, the instructions and the
//// muscles stay the library's.
export function applyClubMedia(media) {
  if (!media) return
  Object.keys(media).forEach(id => {
    const e = EXIDX[id]
    if (!e) return
    if (media[id].img) e.img = media[id].img
    if (media[id].gif) e.gif = media[id].gif
  })
}

// Cardio exercises log time + speed instead of weight × reps.
export const isCardio = idOrEx => (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.bp === 'cardio'

// Exercises the dataset already knows carry no external load (issue #32) — a quarter of the
// catalogue. This seeds the `bw` flag on a fresh config so a push-up never asks for a weight
// nobody was going to enter. It is only the default: the flag lives on the config, so a dip
// done with a belt can turn it off and a custom exercise can turn it on.
export const isBodyweightEq = idOrEx =>
  (typeof idOrEx === 'string' ? EXIDX[idOrEx] : idOrEx)?.eq === 'body weight'

// An id that resolves to nothing — a plan file built against a different exercise dataset,
// a custom exercise deleted on another device before the sync arrived — still has to
// render. A placeholder keeps it visible (and removable) instead of taking the whole view
// down on the first `ex.n`.
export const exOr = id => EXIDX[id] ||
  { id, n: t('Unknown exercise'), bp: '', tg: '', eq: '', sm: [], st: [], missing: true }
