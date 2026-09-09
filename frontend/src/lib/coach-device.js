// Mobile build only: how the Coach runs on this phone, and the little it keeps between runs.
//
// Deliberately NOT part of S. S is the training log — it syncs to a paired server, travels in
// the JSON export, and is what "back up your data" means. Which provider this phone talks to,
// the pseudonym it uses, today's run count and a proposal waiting to be looked at are device
// facts, so they live in their own file next to the remote-pairing one. The API key itself is
// not even here: see coach-secrets.js.
//
// This module is intentionally light. The setup screen imports it before the user has chosen
// anything, and the promise there is that nothing AI-shaped loads until they do.
import { readJsonFile, writeJsonFile } from './mobile.js'
//// Neoffice — see coach-nora.js: on a club's journal the Coach is the club's Nora, switched on by the club.
import { noraConfigured } from './coach-nora.js'
import { BOOT } from './api.js'

const FILE = 'opengym-coach.json'

export const COACH_MODES = ['off', 'server', 'byok', 'nora']

const DEFAULTS = { mode: 'off', provider: null, model: null, baseUrl: null, handle: null, daily: null, pending: null }

let cache = null
export async function loadCoachDevice() {
  if (cache) return cache
  const saved = await readJsonFile(FILE)
  cache = { ...DEFAULTS, ...(saved && typeof saved === 'object' ? saved : {}) }
  if (!COACH_MODES.includes(cache.mode)) cache.mode = 'off'
  //// Neoffice — the club decided: no mode to pick, no key to enter. The pending
  //// proposal, the handle and the daily count still live in this file.
  if (noraConfigured()) cache = { ...cache, mode: 'nora', provider: 'nora', model: (BOOT.coach && BOOT.coach.model) || 'nora', baseUrl: null }
  return cache
}
export async function saveCoachDevice(patch) {
  const next = { ...(await loadCoachDevice()), ...patch }
  cache = next
  await writeJsonFile(FILE, next)
  return next
}
/** The part of it a UI may show: never the pending proposal, never the handle. */
export const coachDeviceSettings = d => d ? { mode: d.mode, provider: d.provider, model: d.model, baseUrl: d.baseUrl } : null

// Test seam.
export function _resetCoachDevice() { cache = null }
