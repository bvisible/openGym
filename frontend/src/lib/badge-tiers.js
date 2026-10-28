//// Neoffice — added file (no upstream equivalent).
////
//// Badges with levels (bronze, silver, gold) and what the journal draws of them. Asked for by the club on 2026-10-28: badges to put forward on the
//// home screen « avec leur progression », defined by the club, « en trois niveaux » (bronze 20 000 kg, silver 40 000, gold 60 000 as an example).
////
//// The server (neoffice_gym.api.badges.mine) sends, per badge: `levels` (1 or 3), `thresholds`, `tier` (0 to levels: the highest reached), `next` (the
//// threshold of the next level, null once the last is reached), `value` (what the member has done), `progress` (0 to 1 towards `next`, 1 when every
//// level is reached), `featured` (the club put it forward) and `tierEarnedOn`. It never sends the medals' NAMES: a badge with three levels calls them
//// bronze, silver, gold, a badge with one level has no medal; the names are translated here.
//// A server that predates levels sends none of that: such a badge reads as one level, earned or not.

import { t, tn } from './i18n.js'
import { fmtNum } from './format.js'

const MEDALS = ['bronze', 'silver', 'gold']

/** 'bronze' | 'silver' | 'gold' for the level `tier` (1 to 3) of a badge with three levels, else null (a one-level badge has no medal). */
export const medalOf = (levels, tier) => (levels === 3 && tier >= 1 && tier <= 3 ? MEDALS[tier - 1] : null)

/** The medal's name in the member's language. */
export const medalName = medal => (medal === 'bronze' ? t('Bronze') : medal === 'silver' ? t('Silver') : medal === 'gold' ? t('Gold') : '')

/** What the card draws of one badge: where it stands and what is left to the next level. */
export function tierState(b) {
  const levels = b && b.levels === 3 ? 3 : 1
  const tier = Math.max(0, Math.min(levels, Number(b && b.tier) || (b && b.earned ? 1 : 0)))
  const complete = tier >= levels
  const value = Number(b && b.value) || 0
  const next = complete ? null : (Number(b && b.next) || Number(b && b.thresholds && b.thresholds[tier]) || null)
  const raw = complete ? 1 : (b && typeof b.progress === 'number' ? b.progress : (next ? value / next : 0))
  const progress = Math.max(0, Math.min(1, raw))
  return {
    levels, tier, complete, value, next, progress,
    pct: Math.round(progress * 100),
    medal: medalOf(levels, tier),
    nextMedal: complete ? null : medalOf(levels, tier + 1),
    remaining: next != null ? Math.max(0, next - value) : 0,
  }
}

/** An amount with the unit of what the badge measures, in the member's language (« 8 800 kg », « 1 séance », « 6 semaines »). */
export function amountOf(metric, n) {
  const x = Number(n) || 0
  const whole = Math.ceil(x - 1e-9)
  switch (metric) {
    case 'Workout Count': return tn('{0} workout', '{0} workouts', whole)
    case 'Weight Moved': return t('{0} kg', fmtNum(x))
    case 'Active Minutes': return t('{0} min', fmtNum(x))
    case 'Class Attendance': return tn('{0} class', '{0} classes', whole)
    case 'Week Streak': return tn('{0} week', '{0} weeks', whole)
    case 'Goals Reached': return tn('{0} goal', '{0} goals', whole)
    default: return fmtNum(x)
  }
}

/** What a member has done towards the next level, then that level: « 31 200 / 40 000 kg ». */
export function progressLine(b, state = tierState(b)) {
  if (state.next == null) return ''
  return fmtNum(state.value) + ' / ' + amountOf(b.metric, state.next)
}

/**
 * The sentence under it: the level to come and what it takes (« Silver in 8 800 kg »), or what the member holds once nothing is left.
 * A badge with ONE level has no level to name while it is open: the progress line already says what it takes, so the sentence is empty.
 */
export function nextLine(b, state = tierState(b)) {
  if (state.complete) return state.medal ? t('{0} reached', medalName(state.medal)) : t('Earned')
  return state.nextMedal ? t('{0} in {1}', medalName(state.nextMedal), amountOf(b.metric, state.remaining)) : ''
}

const byName = (a, b) => String(a.name || '').localeCompare(String(b.name || ''))

/**
 * The badges the home screen puts forward: those the CLUB featured, the ones closest to their next level first, then, if there is room, the ones
 * earned most recently (their last level). At most `limit`. Nothing when the club featured none: the club chooses what climbs to the home screen.
 */
export function featuredBadges(badges, limit = 3) {
  const featured = (badges || []).filter(b => b && b.featured)
  const open = featured.filter(b => !tierState(b).complete).sort((a, b) => tierState(b).progress - tierState(a).progress || byName(a, b))
  const done = featured.filter(b => tierState(b).complete)
    .sort((a, b) => String(b.tierEarnedOn || b.earnedOn || '').localeCompare(String(a.tierEarnedOn || a.earnedOn || '')) || byName(a, b))
  return [...open, ...done].slice(0, limit)
}
