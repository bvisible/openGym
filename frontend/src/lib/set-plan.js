//// Neoffice — added file (no upstream equivalent).
////
//// A routine exercise carried ONE target for all its sets (`sets` × `reps`). A coach — and a
//// member — can now ask something different of each set: a pyramid, 6 · 8 · 10 · 6 · 8. The
//// journal then has to read it, write it, share it, start a session from it and judge the
//// session against it. All of that lives in this file, so each hook into an upstream file stays
//// a line or two and the next upstream merge has one place to look. Upstream plans the same
//// thing for v1.3.12 ("rep or set ranges per set", #154); when it lands, this is what to compare.
////
//// The shape is `cfg.setPlan = [{ r, w? }, …]`: one entry per set, `r` the reps and `w` an
//// optional load (the letters a logged set row uses, so a plan row and a performed row read
//// alike). `cfg.sets` is the list's length and `cfg.reps` its first entry, so an app that does
//// not know the list still shows « 5 × 6 ». A list that disagrees with them was edited by
//// something that does not know it (an older app, the AI coach changing the reps): the later
//// edit wins and the list is ignored, never half-applied.
////
//// The server keeps the same list as `Gym Routine Exercise.set_targets` (neoffice_gym,
//// set_targets.py): the two clean the same way, so what one writes the other reads.

export const MAX_SET_PLAN = 30
const MAX_REPS = 999
const MAX_WEIGHT = 9999.99

const whole = v => {
  const n = typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN
  return Number.isFinite(n) && Number.isInteger(n) ? n : null
}

/**
 * `[{ r, w? }]` from whatever was stored or imported, or undefined when it is no plan.
 * One bad entry makes the whole list no plan: dropping just that entry would change the
 * number of sets without anyone having asked. `perSide` rounds every total up to an even
 * number — half of an odd total is a rep one side does not get.
 */
export function cleanSetPlan(raw, { perSide = false } = {}) {
  if (!Array.isArray(raw) || !raw.length || raw.length > MAX_SET_PLAN) return undefined
  const out = []
  for (const item of raw) {
    if (!item || typeof item !== 'object') return undefined
    let r = whole(item.r)
    if (r == null || r < 1 || r > MAX_REPS) return undefined
    if (perSide) r = Math.ceil(r / 2) * 2
    const entry = { r }
    const w = Number(item.w)
    if (Number.isFinite(w) && w > 0 && w <= MAX_WEIGHT) entry.w = Math.round(w * 100) / 100
    out.push(entry)
  }
  return out
}

/**
 * The plan an exercise config carries, or null. Null for what a plan cannot be: a timed or
 * cardio set, a rest-pause exercise (it trains as exactly two rows whatever `sets` says), a list
 * that is not valid, and one that disagrees with `sets` / `reps` (see the header).
 */
export function setPlanOf(cfg) {
  if (!cfg || !Array.isArray(cfg.setPlan) || !cfg.setPlan.length) return null
  if (cfg.mode === 'time' || cfg.mode === 'cardio') return null
  if (cfg.intensifier && cfg.intensifier.type === 'restpause') return null
  const plan = cleanSetPlan(cfg.setPlan)
  if (!plan) return null
  if (Number(cfg.sets) !== plan.length) return null
  if (cfg.reps != null && Number(cfg.reps) !== plan[0].r) return null
  return plan
}

/** True when the plan fixes a load for some set: the coach prescribed exact weights. */
export const plannedWeights = cfg => !!(setPlanOf(cfg) || []).some(p => p.w > 0)

/**
 * The progression rule that can drive an exercise with a plan. The plan fixes every set's reps,
 * so only a rule that moves the weight alone can drive it: « linear », or none. Any other — double
 * progression (a range), Greyskull (a last set to failure), and whatever upstream adds that moves
 * reps or sets — is read as linear. A plan that also fixes the weights has nothing left to progress.
 */
export function policyWithPlan(cfg, mode, policy) {
  if (mode !== 'reps' || !setPlanOf(cfg)) return policy
  if (plannedWeights(cfg)) return 'off'
  return policy === 'off' ? 'off' : 'linear'
}

/**
 * A prescription minus what the plan owns. Linear progression speaks of the weight only, but
 * a deload, double progression or a bodyweight rule also name reps and sets — applied, they
 * would flatten the pyramid into 5 × 6 the day the weight moves.
 */
export function withoutRepsOfPlan(cfg, prescription) {
  if (!prescription || !setPlanOf(cfg)) return prescription
  const { reps, sets, sec, ...rest } = prescription
  return rest
}

/** The reps one set of a performed session was asked for: its own entry in the plan, else the flat target. */
export const goalFor = (target, index, fallback) => {
  const plan = setPlanOf(target)
  return plan && plan[index] ? plan[index].r : fallback
}

// ---------------------------------------------------------------- the config sheet's moves
// Each takes the sheet's draft `c` and returns the next one, `sets` and `reps` kept in step
// with the list so the draft is always a coherent plan (or none).

const rowsOf = c => (Array.isArray(c.setPlan) ? c.setPlan : [])

/** Every set asks what the exercise asks today — 3 × 10 becomes 10 · 10 · 10 — then each is edited. */
export function startSetPlan(c) {
  const sets = Math.max(1, Math.min(MAX_SET_PLAN, Math.round(c.sets) || 3))
  const r = Math.max(1, Math.round(c.reps) || 10)
  return { ...c, sets, reps: r, setPlan: Array.from({ length: sets }, () => ({ r })) }
}

/** Back to one target for all: as many sets as there were, the first set's reps. */
export function dropSetPlan(c) {
  const rows = rowsOf(c)
  const { setPlan, ...rest } = c
  return rows.length ? { ...rest, sets: rows.length, reps: rows[0].r } : rest
}

/** Add or remove sets. A new set asks what the last one asks. */
export function resizeSetPlan(c, n) {
  const size = Math.max(1, Math.min(MAX_SET_PLAN, Math.round(n) || 1))
  const rows = rowsOf(c)
  if (!rows.length) return { ...c, sets: size }
  const next = size <= rows.length
    ? rows.slice(0, size)
    : [...rows, ...Array.from({ length: size - rows.length }, () => ({ ...rows[rows.length - 1] }))]
  return { ...c, sets: size, reps: next[0].r, setPlan: next }
}

/** Change one set's reps. */
export function editSetReps(c, index, reps) {
  const r = Math.max(1, Math.min(MAX_REPS, Math.round(reps) || 1))
  const next = rowsOf(c).map((p, i) => (i === index ? { ...p, r } : p))
  return { ...c, reps: next[0].r, setPlan: next }
}

/** Reps per side: every total is even. */
export function evenSetPlan(c) {
  const rows = rowsOf(c)
  if (!rows.length) return c
  const next = rows.map(p => ({ ...p, r: Math.ceil(p.r / 2) * 2 }))
  return { ...c, reps: next[0].r, setPlan: next }
}

/** A bodyweight exercise has no load to ask of a set: the plan keeps its reps only. */
export function unloadSetPlan(c) {
  const rows = rowsOf(c)
  return rows.length ? { ...c, setPlan: rows.map(({ r }) => ({ r })) } : c
}

/**
 * « 6 · 8 · 10 · 6 · 8 », then « @ 60 kg » — or « @ 40 · 45 · 50 kg » when sets carry their own
 * load, a dash for a set with none. `fmt` is the app's number formatter, passed in so this file
 * imports nothing.
 */
export function setPlanLine(plan, { weight = 0, bodyweight = false, unit = 'kg', fmt = String } = {}) {
  const reps = plan.map(p => p.r).join(' · ')
  const loads = plan.map(p => p.w || weight || 0)
  if (!loads.some(Boolean)) return reps
  const shown = new Set(loads).size > 1 ? loads : loads.slice(0, 1)
  return `${reps} @ ${shown.map(w => (w ? (bodyweight ? '+' : '') + fmt(w) : '–')).join(' · ')} ${unit}`
}
