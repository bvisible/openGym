import { create } from 'zustand'
import { api, setRemoteAuth } from '../lib/api.js'
//// Neoffice — the store no longer speaks HTTP directly. Upstream called
//// /api/me, /api/data and /api/logout on its own Node server; on Neoffice
//// those are Frappe endpoints, and who we are comes from the page boot rather
//// than from a round-trip. Naming the calls instead of the URLs means moving
//// an endpoint never reaches in here.
import { getState, putState, logout, currentUser } from '../lib/api.js'
//// Neoffice — the media a club has filmed itself.
import { applyClubMedia } from '../lib/exercises.js'
//// Neoffice — a periodized program moves on from week to week by itself.
import { syncCycleWeek } from '../lib/coach-program.js'
import { localTZ } from '../lib/format.js'
import { registerCustom } from '../lib/exercises.js'
import { LANGS } from '../lib/i18n.js'
//// Neoffice — from i18n-core, not i18n: tests mock '../lib/i18n.js' with a bare
//// `t`, and a store that imports more from it breaks every one of them.
import { setExerciseAliases } from '../lib/i18n-core.js'
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { MOBILE, initReminderSync, nativeLoad, nativeSave, syncReminder, writeAutoBackup } from '../lib/mobile.js'
import { loadRemote, chooseLocal, forgetRemote, connect } from '../lib/remote.js'
import { loadCoachDevice, saveCoachDevice, coachDeviceSettings } from '../lib/coach-device.js'

import { WC_DEFAULT } from '../lib/workout-controls.js'

const KEY = 'gym_state_v1'
//// Neoffice — the journal opens in the member's Neoffice language.
//// Upstream defaulted to English and left the member to find the setting; here
//// the language is already known (Frappe hands it over in the page boot), and a
//// club in Suisse romande should never see an English screen on first run. The
//// setting still exists and still wins once touched — this only changes the
//// starting point. Falls back to English for a locale the journal has no pack
//// for, rather than half-translating the screen.
const bootLang = () => {
  //// Neoffice — the member's language, then the SITE's. A visitor has no
  //// member yet, and the server sends `gym_boot.lang` precisely for that
  //// case ("the first thing a member sees") — but this read only the member's
  //// field, so a new member of a French-speaking club landed on an English
  //// sign-in screen. Seen on 2026-09-02, testing the Olympia branding.
  const boot = (typeof window !== 'undefined' && window.gym_boot) || {}
  const raw = boot.user?.language || boot.lang || ''
  const short = String(raw).toLowerCase().split(/[-_]/)[0]
  return LANGS[short] ? short : 'en'
}

export const DEF = {
  //// Neoffice — `lang: bootLang()` and not upstream's 'en': the journal is
  //// served from Frappe, which already knows the member's language. Landing in
  //// English and switching a beat later is a flash of the wrong language on
  //// every cold start. `timerFlash` is upstream's, added in v1.2.14.
  unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, timerFlash: false, keepAwake: true, lang: bootLang(),
  //// Neoffice — 'system' and not 'dark'. Upstream ships a dark journal, and the
  //// three-way control (Sombre / Clair / Système) has always been there — only
  //// the default was a fixed choice, so a phone in light mode opened a black
  //// app for no reason it could explain. Asked for on 01.09: *"est-ce qu'on
  //// peut se synchroniser avec le thème du téléphone"*.
  ////
  //// Only NEW journals are affected: a member who already has a state keeps
  //// whatever it holds, including a 'dark' they never actively picked. Changing
  //// the appearance of an app under somebody who did not ask is worse than a
  //// default that was wrong for a while.
  theme: 'system', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], exAliases: {}, gifSize: 'full',
  // How the active workout is laid out — 'cards' (one exercise at a time with Prev/Next),
  // 'list' (every exercise stacked and scrollable) or 'compact' (that stack stripped to just
  // names and set rows — no media, tags, notes, last-time or progression line). Purely
  // presentational: profiles written before this setting existed overlay onto DEF and keep the
  // 'cards' behaviour. beginWorkout copies the value onto s.active, so the header ⋮ menu can
  // override it for the running session without touching this saved default.
  workoutView: 'cards',
  // Which controls the workout screen shows besides the sets themselves. The default is the
  // lean layout: one "more" button per exercise and a menu on each set number. Every switch
  // brings one of the old always-visible button groups back (Settings → During a workout).
  wc: { ...WC_DEFAULT },
  // effort: which per-set effort scale is logged — 'none' | 'rir' | 'rpe'. null, not 'none', so
  // that a profile which never chose (loaded state is overlaid on DEF, on every path: local,
  // server pull, backup import) still falls back to the `showRir` boolean this replaced and
  // keeps the column it had. See effortOf.
  reminder: { on: false, time: '08:00', tz: null }, effort: null, autoBackup: false,
  // Equipment profiles (issue: filter Library/picker/routines by what you actually own —
  // e.g. "Home" vs "Gym" — building on the session-only equipment filter from issue #6).
  equipProfiles: [], activeEquipId: null, equipFilterOn: false,
  //// Neoffice — how much of the journal is shown. Asked for by Olympia on
  //// 2026-08-31, and it was the most structurally important thing in the call:
  //// *"on a des données qui sont très techniques, trop techniques. Un débutant,
  //// ça peut lui faire peur […] ça a ce côté rédhibitoire."*
  ////
  //// It is NOT a permission and NOT a skill grade — it is DENSITY. The same
  //// journal, shown at two depths; nothing is deleted and nothing is locked.
  //// Same idea as the desk's Simple/Advanced mode, carried into the journal.
  ////
  //// null and not 'full' so a profile that never chose follows the CLUB's
  //// default (levelOf below), and starts following it again if the club
  //// changes its mind. An explicit choice by the member always wins.
  level: null,
  //// Neoffice — how often the journal ASKS for a weigh-in before a workout.
  ////
  //// 'never' by default, and that is a deliberate reversal of upstream, which
  //// asked every single time. Two reasons, the second one decisive:
  ////
  ////   1. it turned a measurement into a toll gate paid to start training;
  ////   2. body weight is a SENSITIVE subject. For somebody who does not want
  ////      to think about their weight — and a gym has those members — being
  ////      made to look at a number before every session is not a neutral
  ////      prompt. Jérémy, 31.08: *"le poids ça peut être un problème pour les
  ////      gens, donc mettre ça au second plan et pas au premier"*.
  ////
  //// Nothing is removed: the Log button on Home and on Stats is there, the
  //// curve keeps working, and a member who WANTS the reminder switches this to
  //// 'week' or 'workout'. The setting is about being ASKED, never about being
  //// able to.
  weighInEvery: 'never',
  // Standing per-exercise notes, keyed by exercise id: the gym-specific facts that are true
  // every time you do the movement ("seat 4, pin 7"). Distinct from a routine's `note`, which
  // belongs to one exercise in one plan, and from a session note, which belongs to one day.
  exNotes: {},
  // Favourite exercise ids (issue #6) — sorted to the top of the picker/Library. Personal, so
  // it syncs with the profile but is never part of a shared plan bundle (lib/favourites.js).
  favEx: [],
  // First day of the week as a getDay() index — 1 Monday, 0 Sunday. Monday is the default so
  // every profile written before this setting existed keeps the week it has been looking at.
  // See lib/format.js: nothing reads this field directly, everything goes through the helpers.
  weekStart: 1,
  // Per-exercise bar weight overrides, keyed by exercise id, in the profile unit (see
  // lib/bar.js). Personal equipment, so it syncs with the account but never travels in a
  // shared plan. Logged weights stay the total — this only feeds the plate math.
  barWeights: {},
  // Gym check-in cards (see views/CheckIn.jsx). Each is a membership
  // code shown as a QR/barcode at the gym's turnstile — added by typing it, importing a photo
  // of the card, or scanning it. We only ever keep the code's VALUE, never a photo: the image
  // is regenerated from `value` every time it's shown (lib/qr.js). `fmt` is the barcode symbology
  // ('qrcode' | 'ean13' | 'code128' | … — lower-cased BarcodeFormat) so it renders as the same
  // kind of code the gym issued. Just data, so it syncs and backs up like everything else.
  //   [{ id, label, value, fmt }]
  gymCards: [],
  // The card the check-in screen last settled on, so it reopens where you left it (handy when
  // you have more than one gym). Holds a gymCards id, or null before any card exists / is chosen;
  // a stale id (card since removed) is simply ignored by the view.
  lastGymCardId: null,
  // Whether the check-in feature is on at all (Settings toggle). Off hides the Home
  // card and the /checkin route; the saved gymCards stay so turning it back on restores them.
  // Defaults on; an older profile without the key reads as on (`!== false`).
  checkIn: true,
}
//// Neoffice — resolve the level: the member's own choice, else the club's
//// default (sent in perms), else the full journal. `=== 'simple'` and never a
//// truthiness test: a club that has set nothing must not silently simplify.
//// Neoffice — should the journal ask for a weigh-in before this workout?
//// Answers on the LAST ENTRY, not on a counter: somebody who weighed in this
//// morning from the Home screen must not be asked again on their way in.
export function shouldAskWeighIn(S) {
  //// `|| 'never'` and not `|| 'week'`: an unset value must follow the default
  //// above, and the default is to leave people alone.
  const how = (S && S.weighInEvery) || 'never'
  if (how === 'never') return false
  if (how === 'workout') return true
  const last = S && S.bodyweight && S.bodyweight.length
    ? S.bodyweight[S.bodyweight.length - 1]
    : null
  if (!last) return true                       // never weighed: ask once
  const when = last.t || new Date(last.d).getTime()
  //// 6 days and not 7: asked on a Monday, a weekly rhythm would otherwise slip
  //// an hour later every week and eventually skip one.
  return (Date.now() - when) > 6 * 86400000
}

//// THREE levels, not two. The client asked for "simple / intermédiaire /
//// avancé" and two was a misreading on my side: the middle one is where most
//// members actually sit — past the first weeks, not counting RIR.
////
////   simple  : what you did. No body map, no effort scale, no 1RM, no
////             intensity techniques, no equipment profiles.
////   normal  : + the body map and the estimated 1RM. The readings you can use
////             without a vocabulary lesson.
////   full    : everything, including RIR/RPE, drop-sets, warm-up ramps and
////             supersets.
////
//// 'full' is kept as the top level's name rather than renamed to 'advanced':
//// it is already stored on profiles and in club settings, and renaming it
//// would silently reset every member who had chosen it.
//// Neoffice — the level helpers live in lib/level.js (pure, no store): the
//// screens' visibility rules import them from there, so an upstream test that
//// mocks this store never has to know about them. Re-exported for callers.
export { LEVELS, levelOf, isSimple, atLeast } from '../lib/level.js'

const clone = o => JSON.parse(JSON.stringify(o))

function loadState() {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return Object.assign(clone(DEF), JSON.parse(raw))
  } catch (e) { /* ignore */ }
  return clone(DEF)
}

const hasData = st => !!((st.workouts || []).length || (st.routines || []).length || (st.bodyweight || []).length)

// Decide whether a pulled account state may replace the local saved state. A local active workout
// is deliberately carried forward: the server stores completed/saved state, while the in-progress
// session belongs to the device that is currently running it.
export function restoredStateFor(local, remote, dirty = false) {
  if (!remote || (hasData(local) && (dirty || (remote._ts || 0) < (local._ts || 0)))) return null
  const next = Object.assign(clone(DEF), remote)
  if (local.active) next.active = local.active
  return next
}

export const useStore = create((set, get) => {
  let pushTm = null
  let saveTm = null
  //// Neoffice — the push currently in the air, so a retry never doubles it.
  let inFlight = null

  initReminderSync(() => get().S)

  // Mobile build: mirror the state into a file in the app's data directory (survives WebView
  // storage eviction) and keep the native reminder schedule in step with the weekly plan.
  const nativePersist = () => {
    clearTimeout(saveTm)
    saveTm = setTimeout(() => { saveTm = null; nativeSave(get().S); syncReminder(get().S) }, 800)
  }

  const persist = (S, push = true) => {
    S._ts = Date.now()
    registerCustom(S.customEx)
    //// Neoffice — the names a coach gave in a programme become this member's
    //// aliases, unless the member already chose their own (theirs wins).
    for (const r of S.routines || []) for (const e of r.ex || []) {
      if (e.alias && !(S.exAliases && S.exAliases[e.id])) S.exAliases = { ...(S.exAliases || {}), [e.id]: e.alias }
    }
    setExerciseAliases(S.exAliases)
    localStorage.setItem(KEY, JSON.stringify(S))
    set({ S })
    if (MOBILE) nativePersist()
    if (push && get().user) {
      clearTimeout(pushTm)
      pushTm = setTimeout(() => get().pushState(), 1500)
    }
  }

  // A setting changed right before switching away/closing the tab must not get lost mid-debounce
  // (e.g. setting the reminder time then immediately backgrounding to test it). On mobile the
  // same applies to the file mirror — backgrounding is often the last thing before the OS
  // kills the app.
  //// Neoffice — the network came back: send what is still owed, at once.
  window.addEventListener('online', () => { useStore.getState().retryPending() })

  document.addEventListener('visibilitychange', () => {
    //// Neoffice — back in the foreground. A phone that was in a pocket
    //// throughout a dead-zone session gets its chance here, even when the
    //// `online` event never fired (a Wi-Fi that answers DHCP but not the
    //// internet does not raise it).
    if (document.visibilityState === 'visible') {
      //// The cycle moves on when the week changes, not on every open:
      //// syncCycleWeek does nothing while we stay inside the same week, so
      //// calling it often costs nothing and guarantees that a member reopening
      //// their logbook on Monday sees their new week without doing anything.
      useStore.getState().advanceCycle()
      useStore.getState().retryPending(); return
    }
    if (document.visibilityState !== 'hidden') return
    if (MOBILE && saveTm) {
      clearTimeout(saveTm)
      saveTm = null
      nativeSave(get().S)
      syncReminder(get().S)
    }
    if (pushTm) {
      clearTimeout(pushTm)
      pushTm = null
      get().pushState()
    }
  })

  // Everything a sign-out leaves behind on this device, whichever way it was triggered.
  const clearLocalSession = () => {
    get().setUser(null)
    localStorage.removeItem('gym_guest')
    localStorage.removeItem('gym_dirty')
    localStorage.removeItem(KEY)
    persist(clone(DEF), false)
    //// Neoffice — and drop the service worker's caches, which localStorage
    //// alone does not cover. The offline shell cached at /gym is a RENDERED,
    //// per-member page: it carries the member's name and their CSRF token. On a
    //// personal phone that is harmless; on a tablet shared by a club it means
    //// the next person could be served the previous member's shell while
    //// offline. Signing out has to take the cache with it.
    if (typeof caches !== 'undefined') {
      caches.keys().then(keys => Promise.all(
        keys.filter(k => k.startsWith('opengym')).map(k => caches.delete(k))
      )).catch(() => { /* no cache API, nothing cached, nothing to clear */ })
    }
  }

  return {
    S: (() => { const s = loadState(); registerCustom(s.customEx); setExerciseAliases(s.exAliases); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,
    /* Instance capabilities from GET /api/config. `config.coach` is present only when the owner
       has both enabled the Coach and connected a provider — every Coach entry point in the app
       hangs off it via coachAvailable(), so an unconfigured instance renders exactly what it
       always did, and a configured one is the only place any of it appears. */
    config: null,
    needsMobileOnboarding: false,   // mobile build only — set true by boot() on a genuine first launch
    // Mobile build only: how the Coach runs on this phone — { mode: 'off'|'server'|'byok',
    // provider, model, baseUrl } from lib/coach-device.js. Never the key, never a proposal.
    coachLocal: null,
    async setCoachLocal(patch) {
      set({ coachLocal: coachDeviceSettings(await saveCoachDevice(patch)) })
    },

    // Mutate a draft of S via producer fn, then persist + schedule sync.
    update(mut, push = true) {
      const S = clone(get().S)
      mut(S)
      persist(S, push)
    },
    replaceState(S, push = false) { persist(clone(S), push) },

    // Fires after the moments where losing local data would actually hurt — a workout just
    // logged, a routine just edited — not on every keystroke. No-op off mobile or with the
    // setting off; the private file mirror (nativePersist, above) already covers every change.
    autoBackupNow() {
      const S = get().S
      if (MOBILE && S.autoBackup) writeAutoBackup(S)
    },

    isGuest: () => localStorage.getItem('gym_guest') === '1',
    setGuest(v) { if (v) localStorage.setItem('gym_guest', '1'); else localStorage.removeItem('gym_guest'); set({}) },

    //// Neoffice — upstream reads `config` from /api/config on its Node server
    //// (invite-only, guest mode, and since v1.3 whether the Coach is on). There
    //// is no Node server here: the instance's capabilities travel in the boot
    //// blob written by www/gym.py — BOOT.coach is present only when the club
    //// switched the AI coach on in Gym Settings — so the "fetch" is a read of
    //// what the page already carries, and the screens that gate themselves on
    //// `config.coach` (coachAvailable) work unchanged.
    config: null,
    async loadConfig() {
      if (get().config) return get().config
      return get().refreshConfig()
    },
    async refreshConfig() {
      const boot = (typeof window !== 'undefined' && window.gym_boot) || {}
      const c = { invite_only: true, allow_guest: false, ...(boot.coach ? { coach: boot.coach } : {}) }
      set({ config: c })
      return c
    },

    setUser(u) {
      if (u) { localStorage.setItem('gym_user', JSON.stringify(u)); localStorage.removeItem('gym_guest') }
      else localStorage.removeItem('gym_user')
      set({ user: u })
    },

    //// Neoffice — same contract as upstream (push the whole state), still
    //// debounced, still flagging gym_dirty when the network is gone. That flag
    //// holds the local copy authoritative until the push succeeds — it is what
    //// makes a workout logged in a basement survive.
    ////
    //// `inFlight` guards against two pushes overlapping: a retry firing while
    //// the debounced push is still in the air would send the same state twice
    //// and, worse, could clear the dirty flag on the answer of the older one.
    async pushState() {
      if (!get().user) return
      clearTimeout(pushTm)
      if (inFlight) return inFlight
      inFlight = (async () => {
        try {
          await putState(get().S)
          localStorage.removeItem('gym_dirty')
          return true
        } catch (e) {
          localStorage.setItem('gym_dirty', '1')
          return false
        } finally {
          inFlight = null
        }
      })()
      return inFlight
    },

    //// Neoffice — retry whatever is still unsynced. Upstream set gym_dirty and
    //// nothing ever consumed it: a member who finished a session in a basement,
    //// pocketed the phone and went home saw NOTHING come back up until they
    //// reopened the app AND changed something. In a gym with poor reception —
    //// which is most of them — that is the normal case, not the edge case.
    //// Called on three signals: the network coming back, the app returning to
    //// the foreground, and startup.
    async retryPending() {
      if (!get().user) return
      if (localStorage.getItem('gym_dirty') !== '1') return
      await get().pushState()
    },
    //// Neoffice — move a periodized program on.
    //// A no-op when there is no cycle, or when the week has not changed:
    //// re-laying the schedule on every open would wipe the day a member moved
    //// mid-week.
    advanceCycle() {
      const S = get().S
      if (!S.coachCycle) return
      const before = S.coachCycle.appliedWeek
      get().update(s => { syncCycleWeek(s) })
      return get().S.coachCycle.appliedWeek !== before
    },

    async pullState() {
      try {
        const { state } = await getState()
        const S = get().S
        const dirty = localStorage.getItem('gym_dirty') === '1'
        const restored = restoredStateFor(S, state, dirty)
        if (restored) {
          //// Neoffice — applied before persisting, so the very first render
          //// already shows the photo of the club's machine and not the
          //// library's drawing. Any later and the screen would flicker.
          //// Upstream moved this block into restoredStateFor() in v1.2.14; the
          //// call has to move WITH it, or the club's media silently stops
          //// being applied — nothing would break, the wrong picture would just
          //// come back.
          applyClubMedia(restored.clubMedia)
          persist(restored, false)
        } else if (hasData(S)) { await get().pushState() }
      } catch (e) { /* offline — keep local */ }
    },

    //// Neoffice — signing out ends the FRAPPE session, so it cannot stay
    //// inside the app: the browser must leave for /login, otherwise the next
    //// request comes back 403 on a page that still looks signed in. The local
    //// copy is pushed first — a session ended with an unsynced workout is the
    //// one case where the member loses real work.
    //// Neoffice — the membership gate signs out without pushing a state it never loaded.
    clearLocal() { clearLocalSession() },

    async signOut() {
      try { await get().pushState(); await logout() } catch (e) { /* offline: the local copy stays */ }
      clearLocalSession()
      window.location.href = '/login'
    },

    // Mobile-only ("connect to my server" onboarding, see App.jsx's needsMobileOnboarding).
    // Picking local — even before there's any data — persists the choice so onboarding never
    // asks again.
    async chooseLocalMode() {
      await chooseLocal()
      set({ needsMobileOnboarding: false })
    },
    // Redeems the pairing code shown in the browser (Settings → "Pair the mobile app") and
    // switches this device over to that account, same as signing in on the web does.
    async connectToServer(url, code) {
      const user = await connect(url, code)   // throws on a bad URL/expired code — caller shows it
      get().setUser(user)
      await get().refreshConfig()   // what this server offers (the Coach, guest mode) — see boot()
      await get().pullState()
      syncReminder(get().S)
      set({ needsMobileOnboarding: false })
    },
    // Leaves remote mode and drops cleanly back to local-only, without losing whatever was last
    // synced (signOut() already pushes before it clears).
    async disconnectServer() {
      await get().signOut()
      await forgetRemote()
      get().setGuest(true)
      set({ ready: true })
    },

    // "Sign out everywhere": the server bumps this profile's session version, which kills every
    // session it has on any device — this browser included, so the app has to end up exactly
    // where a normal signOut leaves it. Unlike signOut the request is NOT swallowed: if it fails
    // the sessions elsewhere are all still valid, and wiping this device's copy of the data
    // would sign the user out of the one place the bump didn't reach. Caller reports the error.
    //// Neoffice — "sign out everywhere" is not ours to implement any more.
    //// Upstream bumped a session version in its own db.json; sessions now
    //// belong to Frappe, which offers the same thing under Settings → My
    //// Settings. Kept as a delegation rather than deleted so the Settings
    //// screen still has something to call, and so nobody re-invents a second
    //// session store next to Frappe's.
    async signOutAll() {
      await get().signOut()
    },

    // Demo build only: drop the seeded example profile back in (Settings → "Reset demo data").
    // Dynamic import so the generator never ships in a self-hosted bundle.
    async resetDemo() {
      const { buildDemoState } = await import('../lib/demoSeed.js')
      localStorage.removeItem('gym_dirty')
      persist(Object.assign(clone(DEF), buildDemoState()), false)
    },

    // Boot: ask the server who we are, then pull.
    async boot() {
      //// Neoffice — upstream's boot() reads /api/config here; ours reads the boot blob
      //// (loadConfig, see above). Before the pull, so the Plan's Coach entry and the
      //// Coach screens have what they gate on from the first render.
      await get().loadConfig()
      // Mobile build: no backend by default — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in. Unless this
      // device was paired to a server ("connect to my server" mode, lib/remote.js), in which
      // case it behaves exactly like the signed-in web flow below, straight from here.
      if (MOBILE) {
        const remote = await loadRemote()
        set({ coachLocal: coachDeviceSettings(await loadCoachDevice()) })
        if (remote?.mode === 'remote') {
          setRemoteAuth(remote.base, remote.token)
          try {
            const me = await api('/api/me')   // also catches a token revoked elsewhere (sign out everywhere)
            get().setUser(me.user)
            // The paired server's /api/config, the same one the web boot reads: without it the
            // phone never learned whether the server offers the Coach and told everyone "your
            // server has no Coach enabled" — with the admin looking at a green test.
            await get().loadConfig()
            await get().pullState()
          } catch (e) {
            if (e.status === 401) { await forgetRemote(); get().setGuest(true) }
            else get().setUser(remote.user)   // offline — keep going from the last-synced local copy
          }
          syncReminder(get().S)
          set({ ready: true })
          return
        }
        const saved = await nativeLoad()
        const S = get().S
        if (saved && (!hasData(S) || (saved._ts || 0) >= (S._ts || 0))) {
          persist(Object.assign(clone(DEF), saved), false)
        } else if (hasData(S)) {
          nativeSave(S)   // first run after an update from a file-less version: seed the mirror
        }
        get().setGuest(true)
        syncReminder(get().S)
        // Only a genuinely first launch — nothing chosen yet and nothing to lose either — offers
        // the choice. Picking local (even with no data yet) persists that choice below and this
        // never asks again.
        set({ ready: true, needsMobileOnboarding: !remote && !hasData(get().S) })
        return
      }
      // Demo build (GitHub Pages): no backend at all — seed once, stay in guest mode.
      if (DEMO) {
        if (!localStorage.getItem(DEMO_SEEDED)) {
          localStorage.setItem(DEMO_SEEDED, '1')
          await get().resetDemo()
        }
        get().setGuest(true)
        set({ ready: true })
        return
      }
      //// Neoffice — no /api/me round-trip: gym.py already put the member in
      //// the page boot, and an anonymous visitor never reaches this code (the
      //// route redirects to /login first). One less request before the first
      //// paint, and no "logged out" flash while it resolves.
      try {
        const me = currentUser()
        if (!me) { set({ ready: true }); return }
        get().setUser(me)
        await get().pullState()
        //// Neoffice — and on BOOT, not only on tab return.
        //// A member opens their logbook on Monday morning: the app was not
        //// open, so no visibilitychange happens and they would stay on last
        //// week until they switched tabs and came back.
        get().advanceCycle()
        // Re-stamp the reminder's timezone on every load — keeps it correct if you're travelling,
        // without needing to revisit Settings.
        const tz = localTZ()
        if (get().S.reminder?.on && get().S.reminder.tz !== tz) {
          get().update(s => { s.reminder = { ...s.reminder, tz } })
        }
      } catch (e) {
        if (e.status === 401) get().setUser(null)
      }
      set({ ready: true })
    }
  }
})

export { hasData }