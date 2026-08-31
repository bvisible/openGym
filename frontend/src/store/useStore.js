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
import { DEMO, DEMO_SEEDED } from '../lib/demo.js'
import { guestAllowed } from '../lib/guest.js'
import { MOBILE, initReminderSync, nativeLoad, nativeSave, syncReminder, writeAutoBackup } from '../lib/mobile.js'
import { loadRemote, chooseLocal, forgetRemote, connect } from '../lib/remote.js'

const KEY = 'gym_state_v1'
//// Neoffice — the journal opens in the member's Neoffice language.
//// Upstream defaulted to English and left the member to find the setting; here
//// the language is already known (Frappe hands it over in the page boot), and a
//// club in Suisse romande should never see an English screen on first run. The
//// setting still exists and still wins once touched — this only changes the
//// starting point. Falls back to English for a locale the journal has no pack
//// for, rather than half-translating the screen.
const bootLang = () => {
  const raw = (typeof window !== 'undefined' && window.gym_boot?.user?.language) || ''
  const short = String(raw).toLowerCase().split(/[-_]/)[0]
  return LANGS[short] ? short : 'en'
}

export const DEF = {
  //// Neoffice — `lang: bootLang()` and not upstream's 'en': the journal is
  //// served from Frappe, which already knows the member's language. Landing in
  //// English and switching a beat later is a flash of the wrong language on
  //// every cold start. `timerFlash` is upstream's, added in v1.2.14.
  unit: 'kg', restSec: 90, restPauseSec: 15, sound: true, timerFlash: false, keepAwake: true, lang: bootLang(),
  theme: 'dark', accent: 'lime', body: 'male', targetW: null,
  bodyweight: [], routines: [], week: {}, dayPlan: {},
  exWeights: {}, workouts: [], active: null, customEx: [], gifSize: 'full',
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
}
//// Neoffice — resolve the level: the member's own choice, else the club's
//// default (sent in perms), else the full journal. `=== 'simple'` and never a
//// truthiness test: a club that has set nothing must not silently simplify.
export const levelOf = S => (S && S.level) || (S && S.perms && S.perms.defaultLevel) || 'full'
export const isSimple = S => levelOf(S) === 'simple'

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
    S: (() => { const s = loadState(); registerCustom(s.customEx); return s })(),
    user: (() => { try { return JSON.parse(localStorage.getItem('gym_user')) || null } catch { return null } })(),
    ready: false,
    needsMobileOnboarding: false,   // mobile build only — set true by boot() on a genuine first launch

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

    //// Neoffice — upstream added `config` / `loadConfig()` here, reading
    //// /api/config from its Node server to learn whether the instance is
    //// invite-only and whether guest mode is allowed. Neither applies: there is
    //// no Node server, and there is no guest mode — /gym redirects an anonymous
    //// visitor to /login before any of this loads, so the only session that
    //// exists is a Frappe one. Kept as a note rather than a stub, so the next
    //// merge shows plainly that the omission is deliberate.

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
      // Mobile build: no backend by default — restore from the file mirror (the durable copy;
      // localStorage may have been evicted since the last run) and go straight in. Unless this
      // device was paired to a server ("connect to my server" mode, lib/remote.js), in which
      // case it behaves exactly like the signed-in web flow below, straight from here.
      if (MOBILE) {
        const remote = await loadRemote()
        if (remote?.mode === 'remote') {
          setRemoteAuth(remote.base, remote.token)
          try {
            const me = await api('/api/me')   // also catches a token revoked elsewhere (sign out everywhere)
            get().setUser(me.user)
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