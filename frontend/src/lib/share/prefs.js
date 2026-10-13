//// Neoffice — added file (no upstream equivalent).
////
//// What a member chose the last time they shared — the picture (photo, numbers, muscles, sticker), its shape (feed or story) and what appears on
//// it — kept on THIS device, so that the next share opens on the same choices. A preference of the device, not of the profile: nothing
//// about it is synced, and a storage that refuses (a private window) only means the sheet opens on its defaults.
import { PICKS, DEFAULT_PICKS } from './model.js'
import { FORMATS } from './layout.js'

export const TEMPLATES = Object.freeze(['photo', 'numbers', 'muscles', 'sticker'])
export const DEFAULT_PREFS = Object.freeze({ template: 'photo', format: 'feed', picks: DEFAULT_PICKS })
const KEY = 'opengym.share.v1'

/** Whatever was stored, read back as valid choices: an unknown picture or shape falls back to the default, unknown picks are dropped. */
export function readPrefs(raw) {
  let data = null
  try { data = typeof raw === 'string' ? JSON.parse(raw) : raw } catch { data = null }
  if (!data || typeof data !== 'object') return { ...DEFAULT_PREFS, picks: [...DEFAULT_PICKS] }
  const picks = Array.isArray(data.picks) ? PICKS.filter(k => data.picks.includes(k)) : [...DEFAULT_PICKS]
  return {
    template: TEMPLATES.includes(data.template) ? data.template : DEFAULT_PREFS.template,
    format: Object.hasOwn(FORMATS, data.format) ? data.format : DEFAULT_PREFS.format,
    picks,
  }
}

export function loadPrefs(storage = globalThis.localStorage) {
  try { return readPrefs(storage?.getItem(KEY)) } catch { return readPrefs(null) }
}

export function savePrefs(prefs, storage = globalThis.localStorage) {
  try { storage?.setItem(KEY, JSON.stringify({ template: prefs.template, format: prefs.format, picks: [...prefs.picks] })) } catch { /* the choices are not kept, nothing else is lost */ }
}
