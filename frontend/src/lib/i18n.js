// Browser-only shell of the i18n module. The runtime-agnostic state and readers live
// in i18n-core.js (plain Node-loadable); this file adds the two pieces that genuinely need
// the browser: `setLang` (which lazy-loads locale packs via import.meta.glob) and the React
// subscription hook `useLang`.

import { useSyncExternalStore } from 'react'
import {
  LANGS, INSTR_LANGS, DATE_LOCALES,
  getLang, dateLocale, t, instrFor, getVersion, _setLangState
} from './i18n-core.js'
//// Neoffice — voir applyExerciseNames() : l'amont ne traduit pas les noms.
import { applyExerciseNames } from './exercises.js'

export { LANGS, INSTR_LANGS, DATE_LOCALES, getLang, dateLocale, t, instrFor }

// Vite code-splits each locale pack into its own chunk via import.meta.glob; instructions use
// the same mechanism in src/instr/. Both are lazy, so the production bundle ships English only.
const localePacks = import.meta.glob('../locales/*.js')
const instrPacks = import.meta.glob('../instr/*.js')
//// Neoffice — exercise names, loaded like the instructions: a separate chunk,
//// so the default bundle stays English-only.
const namePacks = import.meta.glob('../names/*.js')

// React subscription bookkeeping — kept here, not in core, so core has zero React coupling.
const subs = new Set()
const notify = () => { subs.forEach(f => f()) }

export async function setLang(l) {
  if (!LANGS[l]) l = 'en'
  if (l === getLang() && getVersion() > 0) return
  let dict = {}, instr = null, names = null
  try {
    dict = l === 'en' ? {} : (await localePacks['../locales/' + l + '.js']()).default
    instr = l === 'en' || !INSTR_LANGS.includes(l) ? null : (await instrPacks['../instr/' + l + '.js']()).default
  } catch (e) { dict = {}; instr = null }
  //// Neoffice — le pack de noms a son propre try : toutes les langues n'en ont
  //// pas, et une langue sans pack doit rendre l'anglais, pas casser le
  //// changement de langue au complet.
  try {
    const loader = namePacks['../names/' + l + '.js']
    names = l === 'en' || !loader ? null : (await loader()).default
  } catch (e) { names = null }
  applyExerciseNames(names)
  _setLangState(l, dict, instr)
  notify()
}

// Re-renders the subscribing component (and its children) whenever the language changes.
export function useLang() {
  return useSyncExternalStore(fn => { subs.add(fn); return () => subs.delete(fn) }, getVersion)
}
