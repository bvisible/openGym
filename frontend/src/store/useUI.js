import { create } from 'zustand'
import { uid } from '../lib/format.js'
import { beep, vibrate } from '../lib/sound.js'
import { t } from '../lib/i18n.js'
import { useStore } from './useStore.js'

//// Neoffice — the server-side rest alert is a no-op here. Upstream asked its
//// Node server to push a "rest over" notification in case this tab got
//// suspended mid-countdown; that server is gone, and Frappe self-hosted has no
//// push relay either (frappe/push_notification talks to Frappe Cloud, which our
//// instances do not have). It comes back with pywebpush, in its own lot.
////
//// It matters much less than it did: maybeRestNotification() below fires a
//// LOCAL notification when the tab is hidden, which covers the case the server
//// push existed for. Left as named no-ops rather than deleted so the timer
//// keeps calling them and there is exactly one place to fill in.
const pushRestTimer = () => {}
const cancelPushRestTimer = () => {}

const notificationsSupported = () => typeof window !== 'undefined' && 'Notification' in window
let requestRestNotificationPermissionP = null

const requestRestNotificationPermission = async () => {
  if (!notificationsSupported()) return false
  if (Notification.permission === 'granted') return true
  if (Notification.permission === 'denied') return false
  if (!requestRestNotificationPermissionP) {
    requestRestNotificationPermissionP = Notification.requestPermission()
      .then(perm => perm === 'granted')
      .catch(() => false)
      .finally(() => {
        requestRestNotificationPermissionP = null
      })
  }
  return requestRestNotificationPermissionP
}

const maybeRestNotification = async () => {
  if (!notificationsSupported()) return
  if (!document.hidden && document.visibilityState !== 'hidden') return
  if (Notification.permission !== 'granted' && !(await requestRestNotificationPermission())) return
  try {
    // Android Chrome forbids the Notification constructor (Illegal constructor) - the
    // service-worker registration path is the one that actually pops there.
    const reg = await navigator.serviceWorker?.getRegistration?.()
    if (reg?.showNotification) {
      reg.showNotification(t('Rest over — next set!'), { body: t('Rest over — next set!') })
      return
    }
    new Notification(t('Rest over — next set!'), { body: t('Rest over — next set!') })
  } catch {
    // Intentionally ignore: notification APIs vary by browser and policy in edge cases.
  }
}

let toastTm = null
let timerInt = null
let timerTick = null
let workInt = null
let prepInt = null, prepStart = null   // the 3-2-1 before a timed set (Neoffice)
let workTick = null
let workDone = null

export const useUI = create((set, get) => ({
  sheets: [],          // { id, render:(close)=>JSX, kind:'sheet'|'center', locked }
  toastMsg: '',
  timer: null,         // rest countdown between sets — { left, total, endsAt, forIdx }
                       // forIdx: index of the active entry whose set started the rest (undefined when unknown)
  work: null,          // work countdown DURING a timed set (issue #16) — { left, total, endsAt, label }
  prep: null,          // the 3-2-1 BEFORE a timed set starts — { left, total, label } (Neoffice)
  timerFlashId: 0,     // changing the id remounts the four-pulse visual alert

  flashTimer() {
    if (!useStore.getState().S.timerFlash) return
    set(s => ({ timerFlashId: s.timerFlashId + 1 }))
  },

  openSheet(render, { kind = 'sheet', locked = false } = {}) {
    const id = uid()
    set(s => ({ sheets: [...s.sheets, { id, render, kind, locked }] }))
    const close = () => get().closeSheet(id)
    return { id, close, lock: v => set(s => ({ sheets: s.sheets.map(x => x.id === id ? { ...x, locked: v } : x) })) }
  },
  closeSheet(id) { set(s => ({ sheets: s.sheets.filter(x => x.id !== id) })) },
  closeAll() { set({ sheets: [] }) },

  toast(msg) {
    set({ toastMsg: msg })
    clearTimeout(toastTm)
    toastTm = setTimeout(() => set({ toastMsg: '' }), 2200)
  },

  startRest(sec, forIdx) {
    get().stopRest()
    // Rest timer set to Off. Stopping and returning rather than starting a zero-length timer
    // keeps every caller honest: the four places that start a rest do not each need to know.
    if (!(sec > 0)) return
    const endsAt = Date.now() + sec * 1000
    set({ timer: { left: sec, total: sec, endsAt, forIdx } })
    requestRestNotificationPermission()
    pushRestTimer(sec)
    timerTick = () => {
      const tm = get().timer
      if (!tm) return
      const left = Math.max(0, Math.round((tm.endsAt - Date.now()) / 1000))
      if (left === tm.left) return
      const snd = useStore.getState().S.sound
      if (left <= 0) {
        beep(snd, 880, 0.15); beep(snd, 880, 0.15, 0.25); beep(snd, 1320, 0.4, 0.5)
        vibrate([200, 100, 200]); get().flashTimer(); maybeRestNotification(); get().toast(t('Rest over — next set!')); get().stopRest(); return
      }
      if (left <= 3) beep(snd, 660, 0.1)
      set({ timer: { ...tm, left } })
    }
    timerInt = setInterval(timerTick, 1000)
    document.addEventListener('visibilitychange', timerTick)
  },
  addRest(sec) {
    const tm = get().timer
    if (!tm) return
    const left = tm.left + sec
    // taking off more than is left means "I'm ready now" — same as skipping, and it keeps a
    // negative duration out of both the progress bar and the server-side push schedule
    if (left <= 0) { get().stopRest(); return }
    set({ timer: { ...tm, left, total: tm.total + sec, endsAt: tm.endsAt + sec * 1000 } })
    pushRestTimer(left)
  },
  // The active list changed shape (an exercise removed or inserted at `at`): keep the rest
  // pointing at the same exercise. Returns nothing; the caller decides whether to stop instead.
  shiftRestOwner(at, delta) {
    const tm = get().timer
    if (!tm || !(tm.forIdx >= at)) return
    set({ timer: { ...tm, forIdx: tm.forIdx + delta } })
  },
  stopRest() {
    if (timerInt) clearInterval(timerInt); timerInt = null
    if (timerTick) document.removeEventListener('visibilitychange', timerTick); timerTick = null
    if (get().timer) cancelPushRestTimer()
    set({ timer: null })
  },

  /* ---- work timer (issue #16) ----
     Times the set itself, not the recovery after it. Kept separate from the rest timer on
     purpose: the two mean opposite things, they must never run together, and a work set is
     something you are watching — so it gets no server push (that endpoint says "rest over",
     and a plank does not need a notification you are staring at anyway).
     `onDone(elapsedSec)` is called both when the countdown reaches zero and on an early
     finish; the elapsed time is what actually gets logged, so stopping at 0:38 of a 0:45
     hold records 0:38 rather than crediting the full target. */
  startWork(sec, label, onDone) {
    get().stopWork()
    get().stopRest()
    const total = Math.max(1, Math.round(sec) || 1)
    const endsAt = Date.now() + total * 1000
    workDone = onDone
    set({ work: { left: total, total, endsAt, label } })
    workTick = () => {
      const wk = get().work
      if (!wk) return
      const left = Math.max(0, Math.round((wk.endsAt - Date.now()) / 1000))
      if (left === wk.left) return
      const snd = useStore.getState().S.sound
      if (left <= 0) {
        beep(snd, 880, 0.15); beep(snd, 880, 0.15, 0.25); beep(snd, 1320, 0.4, 0.5)
        vibrate([200, 100, 200]); get().flashTimer()
        const done = workDone
        get().stopWork()
        if (done) done(wk.total)
        return
      }
      if (left <= 3) beep(snd, 660, 0.1)
      set({ work: { ...wk, left } })
    }
    workInt = setInterval(workTick, 1000)
    document.addEventListener('visibilitychange', workTick)
  },
  //// Neoffice — THE 3-2-1 BEFORE A TIMED SET.
  ////
  //// Jérémy, 02.09: *"j'ai cliqué sur démarrer et il a le décompte direct,
  //// alors que j'aurais préféré avoir un 3 2 1 en overlay pour dire que ça
  //// commence"*. A plank starts when you are ON the floor, not when your
  //// thumb leaves the button — and the work timer started the moment the
  //// button was tapped, so the first three seconds of every hold were spent
  //// getting into position and counted as if they were not.
  ////
  //// So the tap arms a short, loud, full-screen count — 3, 2, 1 — and the
  //// work timer starts at zero. Tapping the overlay skips straight to the
  //// hold (somebody already in position should not wait); the small cancel
  //// abandons without logging anything, exactly like the work bar's own.
  //// The count is a state here and not in the component, for the same reason
  //// the work timer is: the overlay must survive a re-render, and the tick
  //// must keep counting behind a sheet.
  startWorkWithPrep(sec, label, onDone, prepSec = 3) {
    get().cancelPrep()
    const total = Math.max(1, Math.round(prepSec) || 3)
    prepStart = () => { get().cancelPrep(); get().startWork(sec, label, onDone) }
    set({ prep: { left: total, total, label } })
    const snd = () => useStore.getState().S.sound
    beep(snd(), 660, 0.1); vibrate(20)
    prepInt = setInterval(() => {
      const pr = get().prep
      if (!pr) return
      const left = pr.left - 1
      if (left <= 0) {
        //: A higher note than the count: the ear hears "go", not "one more".
        beep(snd(), 1040, 0.18); vibrate(60)
        const go = prepStart
        get().cancelPrep()
        if (go) go()
        return
      }
      beep(snd(), 660, 0.1); vibrate(20)
      set({ prep: { ...pr, left } })
    }, 1000)
  },
  // Already in position: start the hold now.
  skipPrep() {
    const go = prepStart
    get().cancelPrep()
    if (go) go()
  },
  // Abandon: nothing starts, nothing is logged.
  cancelPrep() {
    if (prepInt) clearInterval(prepInt); prepInt = null
    prepStart = null
    set({ prep: null })
  },
  // Ended the hold early — log what was actually held.
  finishWorkEarly() {
    const wk = get().work
    if (!wk) return
    const elapsed = Math.max(1, wk.total - wk.left)
    const done = workDone
    vibrate(30)
    get().stopWork()
    if (done) done(elapsed)
  },
  // Abandon without logging anything.
  stopWork() {
    if (workInt) clearInterval(workInt); workInt = null
    if (workTick) document.removeEventListener('visibilitychange', workTick); workTick = null
    workDone = null
    set({ work: null })
  }
}))
