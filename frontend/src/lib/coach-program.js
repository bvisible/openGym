//// Neoffice — added file (no upstream equivalent).
////
//// Upstream's plan sharing is member-to-member: a file you hand a friend, which
//// `mergePlan` folds in as brand-new routines. That is exactly right for a
//// friend, and exactly wrong for a coach, for one reason — a coach REVISES.
//// Sending version 2 of a program through the plain import would leave the
//// member with both versions side by side, and neither of them marked.
////
//// So a routine that arrived from a coach carries `coachProgram` (the program
//// it came from) and `coachVersion`. Nothing upstream reads those keys, and
//// `buildPlanBundle` does not copy them — so a member who shares their plan
//// with a friend hands over the routines without the attachment to our club's
//// program, which is what you want on both counts.

import { parsePlan, mergePlan } from './plan-share.js'

/**
 * Fold a coach's program into the member's state, replacing what an earlier
 * version of the SAME program had put there.
 *
 * Returns what happened, so the caller can say it out loud: a revision that
 * silently deletes routines the member had been training is the one thing this
 * must never do without telling them.
 */
export function applyCoachProgram(s, offer) {
  const bundle = parsePlan(offer.bundle)
  const replaced = removeProgramRoutines(s, offer.program)
  const before = new Set((s.routines || []).map(r => r.id))
  mergePlan(s, bundle, { schedule: offer.replaceSchedule })

  //// mergePlan donne un identifiant NEUF à chaque routine importée, pour ne
  //// jamais écraser celles du membre — et il garde sa table de correspondance
  //// pour lui. Le cycle, lui, parle des identifiants du BUNDLE : sans la
  //// refaire, la semaine 2 pointerait dans le vide.
  ////
  //// Elle se reconstruit par l'ORDRE : mergePlan empile les routines du bundle
  //// dans l'ordre du bundle. C'est ce que fait son code, et le test
  //// « la semaine 2 pointe sur les bonnes routines » le vérifie — si l'amont
  //// changeait d'ordre un jour, ce test tomberait avant que quiconque s'en
  //// aperçoive à l'écran.
  const added = (s.routines || []).filter(r => !before.has(r.id))
  const idMap = {}
  added.forEach((r, i) => {
    r.coachProgram = offer.program
    r.coachVersion = offer.version
    const source = bundle.routines[i]
    if (source) idMap[source.id] = r.id
  })
  attachCycle(s, offer, bundle, idMap)
  return { added: bundle.routineCount, replaced, dropped: bundle.dropped }
}

/**
 * Retenir le calendrier d'un programme périodisé.
 *
 * Le carnet n'a qu'UNE semaine type — c'est son modèle, et le changer toucherait
 * tout ce qui la lit. On garde donc le cycle à côté, et on REPOSE la semaine
 * quand le membre change de semaine de cycle. Le mécanisme du carnet reste
 * intact, il est simplement réalimenté.
 */
export function attachCycle(s, offer, bundle, idMap) {
  const raw = (offer.bundle && offer.bundle.cycle) || null
  if (!raw || !raw.weeks) {
    // Un programme non périodisé efface le cycle du précédent : sinon la v2
    // « une semaine type » laisserait tourner le calendrier de la v1.
    if (s.coachCycle && s.coachCycle.program === offer.program) delete s.coachCycle
    return
  }
  const weeks = {}
  Object.keys(raw.weeks).forEach(n => {
    const day = {}
    Object.entries(raw.weeks[n] || {}).forEach(([d, rid]) => { day[d] = idMap[rid] || rid })
    weeks[n] = day
  })
  s.coachCycle = {
    program: offer.program,
    version: offer.version,
    span: raw.span || Object.keys(weeks).length,
    weeks,
    // Le point de départ du compte. La date d'échéance du coach quand il en a
    // posé une, sinon aujourd'hui — un membre qui accepte un mardi commence sa
    // semaine 1 ce mardi-là, pas au lundi suivant.
    startedOn: offer.startDate || todayISO(),
    appliedWeek: null
  }
  syncCycleWeek(s)
}

const todayISO = () => new Date().toISOString().slice(0, 10)

/**
 * Poser la semaine du cycle qui correspond à aujourd'hui.
 *
 * Ne fait RIEN quand la semaine n'a pas changé : reposer le planning à chaque
 * ouverture effacerait le jour qu'un membre a déplacé en milieu de semaine, et
 * il ne comprendrait pas pourquoi son mardi revient tout seul.
 *
 * Retourne le numéro de semaine courant, ou null s'il n'y a pas de cycle.
 */
export function syncCycleWeek(s, when) {
  const c = s.coachCycle
  if (!c || !c.weeks) return null
  const n = cycleWeekOf(c, when)
  if (c.appliedWeek === n) return n
  const plan = c.weeks[String(n)]
  if (plan) {
    // La semaine du cycle REMPLACE : les jours qu'elle laisse vides deviennent
    // des jours de repos. Une semaine à moitié remplacée mélangerait deux
    // semaines de programme, et c'est déjà la règle de l'import.
    s.week = { ...plan }
  }
  c.appliedWeek = n
  return n
}

/** Où en est le membre dans son cycle — de 1 à `span`, et ça boucle. */
export function cycleWeekOf(cycle, when) {
  const span = Math.max(1, cycle.span || 1)
  const start = new Date(cycle.startedOn + 'T00:00:00')
  const now = when ? new Date(when + 'T00:00:00') : new Date()
  const days = Math.floor((now - start) / 86400000)
  // Avant le début, on est en semaine 1 : un programme daté de la semaine
  // prochaine se prépare, il ne renvoie pas à la fin du cycle précédent.
  if (days < 0) return 1
  return (Math.floor(days / 7) % span) + 1
}

/**
 * Drop every routine this program had previously installed, and any weekday
 * pointing at one.
 *
 * The week is cleaned even when the new bundle does not replace the schedule:
 * a day left pointing at a deleted routine renders an empty session the member
 * cannot start, and that is worse than an honest rest day.
 */
export function removeProgramRoutines(s, program) {
  const doomed = new Set((s.routines || []).filter(r => r.coachProgram === program).map(r => r.id))
  if (!doomed.size) return 0
  s.routines = (s.routines || []).filter(r => !doomed.has(r.id))
  Object.keys(s.week || {}).forEach(d => { if (doomed.has(s.week[d])) delete s.week[d] })
  return doomed.size
}

/** How many routines a member is currently training from this program. */
export function countProgramRoutines(s, program) {
  return (s.routines || []).filter(r => r.coachProgram === program).length
}

/**
 * Describe a parsed offer without applying it — what the offer screen shows.
 *
 * Parsing here rather than in the sheet means a malformed bundle surfaces as a
 * message on the offer, not as a blank screen after the member taps Accept.
 */
export function describeOffer(offer) {
  try {
    const bundle = parsePlan(offer.bundle)
    return {
      ok: true,
      routineCount: bundle.routineCount,
      exerciseCount: bundle.exerciseCount,
      scheduledDays: bundle.scheduledDays,
      dropped: bundle.dropped,
      name: bundle.name
    }
  } catch (e) {
    return { ok: false, error: e.message }
  }
}
