//// Neoffice — added file (no upstream equivalent).
////
//// What the picture a member shares of a finished workout SAYS (the layout is lib/share/layout.js, the drawing lib/share/draw.js):
//// the session's name and day, the figures the member ticked, and the exercises as the lines of a training log — « Bench press
//// 4 × 8 · 80 kg ». The member chooses what appears (31.08: « nobody publishes a number they did not mean to publish »); the
//// numbers read exactly as the history reads them, because each line is built from the history's own set labels (lib/history.js
//// setLabel), never recomputed.
import { sessionSections, workoutVolume, workoutDuration, workoutDay, doneUnits, setLabel, modeOf } from '../history.js'
import { EXIDX } from '../exercises.js'
import { hasCompletedWork, isWarmupRow } from '../workout-model.js'
import { fmtDate, fmtDur, fmtNum, fmtVol, capWords } from '../format.js'
import { t, tn, exerciseNameClass } from '../i18n-core.js'

/** What a member can put on the picture, in the order the sheet lists them. */
export const PICKS = Object.freeze(['duration', 'sets', 'volume', 'exercises', 'weights', 'records'])
/** Ticked the first time: the duration, the exercises with their loads, the new bests. Sets and the total weight moved are for whoever wants them. */
export const DEFAULT_PICKS = Object.freeze(['duration', 'exercises', 'weights', 'records'])

// What setLabel writes for a plain rep set ("80×8", the load first), a bodyweight one ("12") and a timed one ("0:45").
const PLAIN_LOAD = /^(\d+(?:[.,]\d+)?)×(\d+)$/
const PLAIN_REPS = /^\d+$/
const PLAIN_TIME = /^\d+:\d{2}(?::\d{2})?$/
// The effort ("(RIR 2)") and the failure mark ("F") setLabel appends say how a set felt, not what it was: left out here, and out of the
// comparison between sets, so that four sets of 80×8 at different effort are still « 4 × 8 · 80 kg ».
const core = label => String(label).replace(/\s*\([^()]*\)\s*$/, '').replace(/\s+\p{L}{1,2}$/u, '').trim()
const MAX_INLINE_SETS = 4

const num = text => Number(String(text).replace(',', '.'))

/**
 * One exercise as a short line: « 4 × 8 · 80 kg » when every work set was the same, the sets side by side when there are at most
 * four of them (« 40×6 · 40×8 · 40×10 »), their number and the heaviest beyond that. null for an exercise with no work set done.
 * `weights: false` keeps the sets and the reps and drops every load.
 */
export function exerciseDetail(entry, { unit, speedUnit, weights = true }) {
  const sets = (entry.sets || []).filter(s => hasCompletedWork(s) && !isWarmupRow(s))
  if (!sets.length) return null
  const n = sets.length
  const labels = sets.map(s => setLabel(entry.id, s, entry.target, speedUnit))
  const cores = labels.map(core)
  const count = tn('{0} set', '{0} sets', n)
  const same = cores.every(c => c === cores[0])
  if (same) {
    const c = cores[0]
    const m = PLAIN_LOAD.exec(c)
    if (m) {
      const base = `${n} × ${m[2]}`
      return weights && num(m[1]) > 0 ? `${base} · ${m[1]} ${unit}` : base
    }
    if (PLAIN_REPS.test(c) || PLAIN_TIME.test(c)) return n > 1 ? `${n} × ${c}` : c
  }
  // Cardio has no load to hide: it reads the way the history reads it.
  if (modeOf({ ...(entry.target || {}), id: entry.id }) === 'cardio') return cores.slice(0, 2).join(' · ')
  if (!weights) return count
  if (same) return n > 1 ? `${cores[0]} · ${count}` : cores[0]
  if (n <= MAX_INLINE_SETS) return cores.join(' · ')
  const heaviest = Math.max(0, ...cores.map(c => { const m = PLAIN_LOAD.exec(c); return m ? num(m[1]) : 0 }))
  return heaviest > 0 ? `${count} · ${t('max {0}', `${fmtNum(heaviest)} ${unit}`)}` : count
}

const clean = v => (typeof v === 'string' ? v.replace(/\s+/g, ' ').trim() : '')

/**
 * `picks`: what the member ticked (a Set or an array of PICKS). `club` = { name, logo, site, info } as the server gives it (+ `logoAspect`, the proportions of the loaded logo, when known). `nameOf(entry)`
 * is the exercise's display name, `speedUnit` the one cardio reads in. Returns what layoutShare takes: `figures` (the ticked numbers
 * this workout has — never a "0 kg"), `lines` (every exercise with a work set done, in the order the history lists them; the layout
 * keeps those that fit), and the club's foot.
 */
export function shareModel(w, { unit, nameOf, speedUnit, picks, club }) {
  const has = k => (picks instanceof Set ? picks.has(k) : Array.isArray(picks) && picks.includes(k))
  const entries = w.entries || []
  const prs = new Set(w.prs || [])
  const ms = workoutDuration(w)
  const sets = entries.reduce((n, e) => n + (e.sets || []).reduce((m, s) => m + (isWarmupRow(s) ? 0 : doneUnits(s)), 0), 0)
  const volume = w.vol ?? workoutVolume(w)
  const day = workoutDay(w)

  // The order the detail sheet lists the exercises in, supersets together (sessionSections), each named once.
  const order = []
  for (const i of sessionSections(entries).flatMap(section => section.units).flat()) if (entries[i] && !order.includes(i)) order.push(i)
  const named = entry => { const name = nameOf(entry); return exerciseNameClass(EXIDX[entry.id]) ? capWords(name) : name }

  const lines = []
  if (has('exercises')) {
    for (const i of order) {
      const entry = entries[i]
      const detail = exerciseDetail(entry, { unit, speedUnit, weights: has('weights') })
      if (detail == null) continue
      lines.push({ name: named(entry), detail, pr: has('records') && prs.has(entry.id) })
    }
  }
  // The new bests by themselves, when the member wants them but not the whole list.
  const records = []
  for (const i of order) {
    const entry = entries[i]
    if (prs.has(entry.id) && !records.some(r => r.id === entry.id)) records.push({ id: entry.id, name: named(entry) })
  }
  if (!has('exercises') && has('records')) for (const r of records) lines.push({ name: r.name, detail: '', pr: true })

  const figures = []
  if (has('duration') && ms >= 60000) figures.push({ key: 'duration', label: t('Duration'), value: fmtDur(ms) })
  if (has('sets') && sets > 0) figures.push({ key: 'sets', label: t('Sets'), value: fmtNum(sets) })
  if (has('volume') && volume > 0) figures.push({ key: 'volume', label: t('Weight moved'), value: fmtVol(volume, unit) })

  return {
    title: clean(w.name),
    date: day ? fmtDate(day, true, true) : '',
    figures,
    lines,
    recordCount: records.length,
    club: { name: clean(club?.name), logo: clean(club?.logo), site: clean(club?.site), info: clean(club?.info), logoAspect: Number.isFinite(club?.logoAspect) && club.logoAspect > 0 ? club.logoAspect : undefined },
    labels: { done: t('Session done'), more: n => tn('+ {0} more exercise', '+ {0} more exercises', n) },
  }
}

/**
 * What the sheet offers for this workout and what each choice holds: only the choices this workout can fill, so that no switch can
 * only disappoint (a « 0 kg », a « records » of none). `keys` in the order of PICKS, `values` the text shown beside each.
 */
export function shareChoices(w, { unit, nameOf, speedUnit }) {
  const m = shareModel(w, { unit, nameOf, speedUnit, picks: PICKS, club: null })
  const values = {}
  for (const f of m.figures) values[f.key] = f.value
  if (m.lines.length) values.exercises = String(m.lines.length)
  if (m.recordCount) values.records = String(m.recordCount)
  const keys = PICKS.filter(k => (k === 'weights' ? m.lines.length > 0 : values[k] != null))
  return { keys, values }
}
