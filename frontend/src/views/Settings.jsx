//// Neoffice — no useSyncExternalStore: it read the media sync status, and photos and videos never leave the phone here.
import { useEffect, useRef, useState, forwardRef } from 'react'
import { useNavigate, useParams, useLocation, Navigate } from 'react-router-dom'
import { useStore, DEF, hasData } from '../store/useStore.js'
//// Neoffice — level helpers from lib/level.js, not the store: upstream's view tests mock the store.
import { levelOf } from '../lib/level.js'
import { healthStatus, loadHealth, enableHealth, disableHealth, openHealthConnect, onHealthChange, enableRead, disableRead } from '../lib/health-sync.js'
import { workoutControls } from '../lib/workout-controls.js'
import { speedUnitOf } from '../lib/speed.js'
import { formulaOf, FORMULA_NAMES } from '../lib/onerm.js'
import { copyText } from '../lib/clipboard.js'
import { useUI } from '../store/useUI.js'
import { ACCENTS, ACCENT_NAMES, todayISO, localTZ, weekStartOf, MONDAY, SUNDAY, fmtPlate } from '../lib/format.js'
import { inventoryFor, ownsPlates } from '../lib/plates.js'
import { BAR_TYPES, ownBarDefault } from '../lib/bar.js'
import { dumbbellsOf, ownsNoDumbbells } from '../lib/dumbbells.js'
import { effortOf } from '../lib/history.js'
import { figureOf } from '../lib/exercises.js'
import { unlock, chime, playOnSilentSupported, vibrateSupported, appleTouchDevice } from '../lib/sound.js'
import { REST_SOUND_IDS, restSoundOf } from '../lib/rest-sounds.js'
import { scheduleModeOf, chooseFixedWeek, chooseRotation } from '../lib/rotation.js'
import { queueOf } from '../lib/queue.js'
//// Neoffice — passkeys are gone: the Frappe session is the sign-in, and the
//// journal never had a user directory of its own here. IS_ANDROID stays (it
//// only phrases a hint about the install prompt); the rest is the club's (MyClub, MyCoach).
import { BOOT, IS_ANDROID, myCoach, wallet, classesMine, myMembership } from '../lib/api.js'
import { pushSupported, enablePush, disablePush, sendTestPush, syncPushSubscription } from '../lib/push.js'
import { wakeLockSupported } from '../lib/wakelock.js'
import { t, tn, LANGS, INSTR_LANGS, EXERCISE_NAME_LANGS, baseLang, dateLocale } from '../lib/i18n.js'
import { effectiveLang } from '../lib/default-lang.js'
import { DEMO, REPO } from '../lib/demo.js'
//// Neoffice — no photos or videos of members' exercises on the club's server (Jérémy, 06.10): none of
//// upstream's media imports (backup zip, media store, uploads).
import { MOBILE, isAndroid, shareExport, syncReminder } from '../lib/mobile.js'
import { NUDGE_COPY, NUDGE_TONES, nudgeAllowed, toneOf } from '../lib/nudge.js'
import { setRestAccent } from '../lib/rest-alert.js'
import { CLUB, CUSTOM, accentKey, adjustedIn, applyAccent, cleanHex, clubAccent, inkOn, isGrey } from '../lib/accent.js'
import { checkForUpdate, downloadAndInstall, fetchChecksum, forgetDownloadedUpdate, RELEASES_PAGE } from '../lib/update.js'
import { selfUpdates } from '../lib/channel.js'
import { forgetCoach } from '../lib/coach-api.js'
import { coachAvailable } from '../lib/coach.js'
import { REST_MAX, REST_PAUSE_MIN, REST_PAUSE_MAX, fmtRest, fmtDuration } from '../lib/duration.js'
import { starterPlanSheet, confirmSheet, importFromApp, importFromHevy, equipmentProfileSheet, plateInventorySheet, dumbbellInventorySheet, barDefaultsSheet, menuSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { durationSheet } from '../components/DurationWheel.jsx'
import { showsConnection, showsLocalLine } from '../components/SyncBanner.jsx'
import BackupFolderRow, { useBackupFolder, autoBackupSubtitle } from '../components/BackupFolderRow.jsx'
//// Neoffice — the sync rows of the account page (upstream's ServerSync, kept for them).
import { SyncRows } from '../components/ServerSync.jsx'
import AppIconRow from '../components/AppIconRow.jsx'
//// Neoffice — upstream v1.4.2's AnimationQualityRow draws nothing outside the store apps (`if (!MOBILE) return null`), so it is kept as it is.
import { AnimationQualityRow } from '../components/Animations.jsx'
import { Section, Row, SelectRow, Switch, Segmented, Button, SearchField } from '../components/ui.jsx'
//// Neoffice — what the detail level shows (Simple / Normal / Complete); see lib/level-visibility.js.
import { showsEffortSetting, showsEquipmentProfiles, showsRestPauseSetting, showsWarmupRestSetting, showsOneRmFormula, showsSeasonalThemes, showsReports } from '../lib/level-visibility.js'
import { PAGES, ROOT_GROUPS, pageVisible, searchSettings, pageTrail } from './settings-pages.js'
import { platformNow } from '../lib/platform-now.js'
import { pathBefore } from '../lib/nav.js'
import WatchSettingsPage from './WatchSettings.jsx'
import { reportSheet } from '../components/ReportSheet.jsx'
import { csvExportSheet } from '../components/CsvExportSheet.jsx'
import GymReminderPage, { GymEditPage } from './GymReminder.jsx'
import { readGymConfig } from '../lib/gym-reminder.js'
import { THEMES, inSeason, seasonChoice, activeSeason } from '../lib/seasonal.js'

/* Settings (v1.3.11). The root is one screen: an account card, eleven rows that each open a page
   (/settings/<page>), and a search over every row. Rare things live one level further down
   (Workout → Fine-tuning). The rows and their rules are the ones the single long page had; only
   where they sit changed. settings-pages.js says which page holds what, and is what the search
   reads. `page` is the open page (null for the root), `find` a row a search hit asked for, which
   is scrolled to and flashed. */

// What was typed into the search, kept while you step into a hit and back out again: tied to
// the history entry it was typed on, so Back (in the app, the browser's or Android's) brings the
// results back, while Settings opened afresh from anywhere (the gear, a tab) starts at the root.
let lastQuery = { q: '', key: null }

// The route: /settings and /settings/<page>. An unknown page, or one this device does not have
// (the Coach page off the phone app), goes back to the root.
export function SettingsRoute() {
  const { page } = useParams()
  const loc = useLocation()
  // `ios` now, not after an async platform check: the Apple Watch page is iPhone only, and a route
  // that did not know yet sent every visit to it straight back to the root.
  // (Unknown counts as yes inside the phone app: the page itself then says there is no watch.)
  const ctx = { user: useStore(s => s.user), mobile: MOBILE, ios: MOBILE && platformNow() !== 'android' }
  if (page && (!PAGES[page] || !pageVisible(PAGES[page].parent || page, ctx) || !pageVisible(page, ctx))) return <Navigate to="/settings" replace />
  if (page === 'coach') return <Navigate to="/coach/setup" replace />
  return <Settings key={page || 'root'} page={page || null} find={loc.state?.find || null} via={loc.state?.via || null} entryKey={loc.key} />
}

// "Mon" / "Sun" in the app's language, for the Plan & schedule row's preview.
const shortWeekday = day => {
  try { return new Intl.DateTimeFormat(dateLocale(), { weekday: 'short' }).format(new Date(2024, 0, day === 0 ? 7 : 1)) } catch { return day === 0 ? 'Sun' : 'Mon' }
}

// Running as an installed app (home-screen web app or the phone app): no install tip then.
const standalone = () => {
  try { return !!(window.matchMedia?.('(display-mode: standalone)').matches || window.navigator.standalone === true) } catch { return false }
}

// Apple devices, the iPad included (it says Macintosh): the install tip's Safari wording. Read here
// rather than from lib/api.js, whose test mocks across the Settings suites only carry IS_ANDROID.
const APPLE_UA = typeof navigator !== 'undefined' && /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)

export default function Settings({ page = null, find = null, via = null, entryKey = null }) {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  const coachLocal = useStore(s => s.coachLocal)
  const config = useStore(s => s.config)
  // What the app is showing, which for a profile that never picked a language is worked out on
  // this device rather than stored (#303).
  //// Neoffice — the site's language first (BOOT.lang), as App.jsx does: the two must agree, or the
  //// language row would show another language than the one on screen.
  const lang = S.lang || BOOT.lang || effectiveLang(S, config)
  //// Neoffice — signOut: ours, it ends the Frappe session (store/useStore.js). No passkeys, password
  //// or device link: the member signs in with their Neoffice account.
  const { update, importConflict, importBackup, setUnit, resetEverything: resetAll, resetDemo, signOut } = useStore()
  //// Neoffice — the club decides whether its members touch their own plan (S.perms.editPlan, see
  //// views/Plan.jsx): the plan page below changes neither how they train nor the plan itself then.
  const mayEdit = S.perms ? S.perms.editPlan !== false : true
  const toast = useUI(s => s.toast)
  const fileRef = useRef(null)
  const importRef = useRef(null)
  const body = useRef(null)
  const wakeOK = wakeLockSupported()
  // The gym reminder's switch lives on its own page and on this device only (lib/gym-reminder.js).
  const gymOn = MOBILE && readGymConfig().on

  // A planner's own queue (no rotationId, or one that doesn't match the saved rotation here) is
  // not this app's to switch off or overwrite. The Scheduling row goes read-only for it.
  const liveQ = queueOf(S)
  const externalQ = !!liveQ && (!S.rotation || liveQ.rotationId !== S.rotation.id)

  // Two honest choices on a unit switch (issue #22): convert the numbers, or keep them and only
  // change the label — the old behaviour, still right for someone who logged in lb all along
  // under a kg label. Closing the sheet leaves the unit as it was.
  const switchUnit = v => {
    if (v === S.unit) return
    menuSheet({
      title: t('Convert to {0}?', v),
      subtitle: t('Every stored weight (logged sets, working weights, routine targets, body weight, bar weights) is in {0}. Convert the numbers, or keep them and only change the label?', S.unit),
      items: [
        { icon: 'calculator', label: t('Convert the numbers'), onClick: () => setUnit(v) },
        { icon: 'pencil', label: t('Keep the numbers, change the label'), onClick: () => setUnit(v, { convert: false }) },
      ],
    })
  }

  // Fixed Week or Rotation. A live queue always wins (scheduleModeOf, lib/rotation.js) — a queue
  // written by a planner switches the app to Rotation on its own — but choosing Rotation with
  // nothing built yet has no queue to derive from, so S.scheduleMode is what keeps it selected
  // (and the weekday grid hidden, on both Home and Plan) until the first routine is added.
  // Fixed Week behaves as on Plan (views/Plan.jsx setMode), with the same words: with no loop
  // running there is nothing to lose and it switches at once; a running loop asks first.
  const setScheduleMode = v => {
    if (v === scheduleModeOf(S)) return
    if (v === 'week') {
      // A planner's own queue is never this app's to drop — this control is text-only while one
      // is live (below), but the guard stays here too rather than trust the render alone.
      if (!liveQ) { update(s => { chooseFixedWeek(s) }); return }
      confirmSheet({
        title: t('Back to a fixed week?'),
        message: t('The loop stops. Your weekdays stay as they are, and the loop is saved for later.'),
        confirmText: t('Use Fixed Week'),
        onConfirm: () => update(s => { chooseFixedWeek(s) }),
      })
      return
    }
    // The same switch as Plan's "How you train" (lib/rotation.js). With nothing to start (no
    // saved sequence, or a malformed queue Plan has to sort out) the choice holds and you stay
    // here: the page then offers the way to Plan (below), so picking a value never leaves it.
    update(s => { chooseRotation(s) })
  }

  // --- update check state ---
  const [updateInfo, setUpdateInfo] = useState(null) // { hasUpdate, latestVersion, apkUrl, hashUrl } | null
  const [android, setAndroid] = useState(false)
  const [ios, setIos] = useState(() => MOBILE && platformNow() === 'ios')   // the iPhone app: Settings → Apple Watch
  const [selfUpdate, setSelfUpdate] = useState(false)   // the sideloaded APK, which updates itself
  const [checking, setChecking] = useState(false)
  // Where auto-backup writes on this Android phone, for the Auto-backup row's own subtitle.
  const [backupDir] = useBackupFolder(MOBILE && android && !!S.autoBackup)

  useEffect(() => {
    // The in-app updater installs an .apk, so it only applies to the native Android build.
    // On iOS and the web this check is skipped and the update row never appears. isAndroid()
    // already answers false off the mobile build; the MOBILE check on top keeps the web bundle
    // from even asking (and from calling GitHub on every Settings visit). Only the pages
    // that show it ask: the root (for nothing but `android`) skips the release check.
    // The Google Play build is updated by Play (lib/channel.js): no update row there either.
    if (!MOBILE) return
    isAndroid().then(async ok => {
      setAndroid(ok)
      setIos(!ok)
      const own = ok && await selfUpdates()
      setSelfUpdate(own)
      // Nothing newer: an update APK still in the cache is the one already installed.
      if (own && page === 'about') checkForUpdate().then(info => { setUpdateInfo(info); if (!info?.hasUpdate) forgetDownloadedUpdate() }).catch(() => {})
    })
  }, [page])

  // A search hit: scroll its row (or button) into view and flash it once. A row that shows only
  // once the page has heard back from the server (web push, the passkey list) is waited for a
  // moment; still missing, the hit's `via` row, if it names one, is flashed instead, with a word
  // on why.
  useEffect(() => {
    if (!find || !body.current) return
    const el = body.current
    const named = label => [...el.querySelectorAll('.lrow')].find(r => r.querySelector('.lrow-t')?.textContent === label)
      || [...el.querySelectorAll('.btn')].find(b => b.textContent.trim() === label)
    let tm = null
    const flash = row => {
      row.classList.add('sp-flash')
      if (typeof row.scrollIntoView === 'function') row.scrollIntoView({ block: 'center' })
      tm = setTimeout(() => row.classList.remove('sp-flash'), 1900)
    }
    const row = named(t(find))
    if (row) { flash(row); return () => clearTimeout(tm) }
    let done = false
    const mo = typeof MutationObserver === 'function' ? new MutationObserver(() => {
      const r = named(t(find))
      if (r && !done) { done = true; mo.disconnect(); clearTimeout(wait); flash(r) }
    }) : null
    mo?.observe(el, { childList: true, subtree: true })
    const wait = setTimeout(() => {
      if (done) return
      done = true; mo?.disconnect()
      const r = via && named(t(via))
      if (r) { flash(r); toast(t('Turn on push notifications first.')) }
    }, 1500)
    return () => { done = true; mo?.disconnect(); clearTimeout(wait); clearTimeout(tm) }
  }, [find])

  // The same check, on demand: the automatic one is silent when it finds nothing or cannot
  // reach GitHub, and a person who taps "Check for updates" deserves an answer either way.
  const checkNow = async () => {
    if (checking) return
    setChecking(true)
    try {
      const info = await checkForUpdate()
      setUpdateInfo(info)
      if (!info.hasUpdate) { toast(t('You have the latest version.')); forgetDownloadedUpdate() }
    } catch {
      toast(t('Couldn’t check for updates. Are you online?'))
    }
    setChecking(false)
  }

  const onUpdateRowClick = () => {
    if (!updateInfo?.hasUpdate) return
    if (updateInfo.apkUrl) {
      // Start download & install
      const version = updateInfo.latestVersion
      confirmSheet({
        title: t('Update to {0}?', version),
        message: t('The latest version will be downloaded and the installer will open.'),
        confirmText: t('Download & Install'),
        onConfirm: async () => {
          // Open a progress sheet
          let closeProgress = null
          let setProgress = null
          useUI.getState().openSheet(close => {
            closeProgress = close
            return <DownloadProgress ref={fn => { setProgress = fn }} />
          }, { locked: true })
          try {
            // The release always publishes the checksum next to the APK. Without it the file is
            // not installed — a sideloaded binary is exactly the thing that should be verified.
            let expectedHash = null
            try { expectedHash = await fetchChecksum(updateInfo.hashUrl) } catch (e) { /* reported below */ }
            if (!/^[0-9a-f]{64}$/i.test(expectedHash || '')) throw new Error(t('Checksum not available, so not installing'))
            await downloadAndInstall(updateInfo.apkUrl, expectedHash, (received, total) => {
              if (setProgress) setProgress(received, total)
            })
            if (closeProgress) closeProgress()
          } catch (e) {
            if (closeProgress) closeProgress()
            toast(t('Update failed: {0}', e.message))
          }
        },
      })
    } else {
      // Update available but no APK asset — open the releases page
      window.open(RELEASES_PAGE, '_blank', 'noopener')
    }
  }

  // Reads the store at the moment of the tap: the sheet that asks before a sign-out offers it too,
  // and the copy it exports is the one that has not reached the server.
  const doExport = async () => {
    const json = JSON.stringify(useStore.getState().S, null, 2)
    const name = 'opengym-backup-' + todayISO() + '.json'
    // WKWebView can't download blob URLs — the native build hands the file to the share sheet.
    if (MOBILE) {
      try { await shareExport(json, name); toast(t('Backup exported')) } catch (e) { /* share sheet dismissed */ }
      return
    }
    const blob = new Blob([json], { type: 'application/json' })
    const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; a.click(); URL.revokeObjectURL(a.href)
    toast(t('Backup exported'))
  }
  //// Neoffice — upstream's import, without the zip of photos and videos: they stay on the member's
  //// phone and are never part of what the club's server sees (Jérémy, 06.10). A JSON backup, and the
  //// server asked first: a workout logged since the backup was made, or on another device, would be
  //// deleted by the replace, so the member may merge those in instead.
  const doImport = async ev => {
    const f = ev.target.files[0]; if (!f) return
    ev.target.value = ''
    //// Neoffice — a JSON backup: no zip of photos and videos (see above).
    let data
    try {
      data = JSON.parse(await f.text())
      if (!data.workouts || !data.routines) throw new Error('not an openGym backup')
    } catch (e) { toast(t('Import failed: {0}', e.message)); return }
    const apply = mergeWith => { importBackup(data, { mergeWith }); toast(t('Backup imported')) }
    // Signed in, the server is asked first: a workout logged since the backup was made, or on
    // another device meanwhile, would be deleted from the profile by the replace — said, with the
    // choice to merge those in instead (useStore importConflict / importBackup).
    //// Neoffice — importConflict reads the club's server (useStore.js).
    const conflict = await importConflict(data)
    if (conflict) {
      const n = conflict.workouts
      menuSheet({
        title: t('Import backup?'),
        subtitle: conflict.device
          ? t(n === 1 ? 'This device has 1 workout that is not in this backup. Replacing deletes it.'
            : 'This device has {0} workouts that are not in this backup. Replacing deletes them.', n)
          : t(n === 1
            ? 'The server has 1 workout that is not in this backup, logged since it was made or on another device. Replacing deletes it.'
            : 'The server has {0} workouts that are not in this backup, logged since it was made or on another device. Replacing deletes them.', n),
        items: [
          { icon: 'trash', label: t('Replace anyway'), danger: true, onClick: () => apply(null) },
          { icon: 'merge', label: t('Merge them in'), onClick: () => apply(conflict) },
          { icon: 'xmark', label: t('Cancel'), onClick: () => {} },
        ],
      })
      return
    }
    confirmSheet({
      title: t('Import backup?'), message: t('This replaces all current data with the backup file.'), confirmText: t('Import'), danger: true,
      onConfirm: () => apply(null)
    })
  }
  //// Neoffice — signing in and out belongs to Frappe, so upstream's handlers here (passkey sign-in and
  //// registration, disconnect, « sign out everywhere ») are gone. Ending sessions on every device is a
  //// Frappe feature the member reaches from their own account settings; duplicating it here would mean a
  //// second session store next to Frappe's. Our sign-out is on the account page below.
  // Signed in, the empty state is pushed to the profile like any other change, so the wipe
  // reaches the server and every device that syncs with it — the dialog has to say so. The Coach
  // keeps its data outside S in two homes that can both be in use on one phone: a file per
  // profile on the server, and — when it runs with the phone's own key — a file on the device.
  // Each is cleared on its own; forgetCoach() alone would pick one by mode. A failed call must
  // not stop the reset.
  //// Neoffice — one call instead of upstream's two. Upstream POSTs /api/coach/forget to its Node server
  //// AND calls forgetCoach() for a phone running the Coach with its own key. Here the Coach is the
  //// club's Nora, run the "local" way (lib/coach-api.js routes every call by mode), and there is no
  //// /api/coach/forget on Frappe: forgetCoach() is the one door, and it already picks the right home.
  //// What the server holds of the Coach travels inside the state (`coach`), which the pushed reset wipes.
  const resetEverything = () => confirmSheet({
    title: t('Reset everything?'),
    message: user
      //// Neoffice — no photos or videos to delete: they never reach the club's server.
      ? t('Deletes your plan, workouts and body weight from your profile on this server and on every signed-in device. This cannot be undone.')
      : t('Deletes your plan, workouts and body weight on this device. This cannot be undone.'),
    confirmText: t('Delete everything'), danger: true,
    onConfirm: () => {
      //// Neoffice — resetAll() is upstream's (v1.3.9): it stamps the empty copy with resetAt and
      //// resetIds, so the server and the other devices drop exactly what was wiped.
      if (user || coachLocal?.mode === 'byok') forgetCoach().catch(() => {})
      resetAll()
      nav('/home'); toast(t('All data reset'))
    },
  })
  //// Neoffice — signing out ends the Frappe session. Upstream v1.3.9's sign-out refuses while this
  //// device holds changes the club's server has not seen ({ owed: true }): say so, and let the member
  //// go ahead — the changes are kept aside on this device and come back at their next sign-in here.
  const signOutHere = () => confirmSheet({
    title: t('Sign out?'), message: t('Your journal is saved first, then this device is signed out.'),
    confirmText: t('Sign out'), danger: true,
    onConfirm: async () => {
      const r = await signOut()
      if (r?.owed && r.stashed === undefined) confirmSheet({
        title: t('Sign out?'),
        message: t('Some changes on this device have not reached your server.') + ' ' + t('The changes your server has not seen are kept on this device, and added back when it connects as this account again.'),
        confirmText: t('Sign out anyway'), danger: true,
        onConfirm: () => signOut({ force: true }),
      })
    },
  })

  /* ---------------- what the pages and the search need to know about this device ---------------- */
  const canVibrate = vibrateSupported()
  //// Neoffice — no media rows, no password or passkey (hasMedia, pwOn and webauthn are false); `level`,
  //// `restPause`, `effort`, `equipment` and `classes` are the rows our pages show or hide (level of
  //// detail, the club's classes), so the search offers only what the page draws.
  const ctx = {
    user, mobile: MOBILE, android, ios: MOBILE && ios, appIcons: MOBILE && platformNow() === 'ios', demo: DEMO, wakeOK, hasMedia: false, pwOn: false, webauthn: false,
    restPause: showsRestPauseSetting(S), warmupRest: showsWarmupRestSetting(S), effort: showsEffortSetting(S), equipment: showsEquipmentProfiles(S), oneRmFormula: showsOneRmFormula(S),
    classes: !MOBILE && !DEMO && S.perms?.classes !== false, mayEdit,
    sound: !!S.sound, playOnSilent: playOnSilentSupported(), canVibrate, vibrate: S.vibrate !== false,
    profiles: (S.equipProfiles || []).length > 0, nameLang: EXERCISE_NAME_LANGS.includes(baseLang(lang)),
    pushOK: !MOBILE && pushSupported(), reminderOn: !!S.reminder?.on, nudge: !!S.reminder?.nudge,
    //// Neoffice — the club may switch the relance off (S.perms.nudge); the search offers its rows only when the page draws them.
    nudgeAllowed: nudgeAllowed(S),
    autoBackup: !!S.autoBackup, synced: !!sync, installTip: !MOBILE && !standalone(), androidWeb: IS_ANDROID, desktopWeb: !IS_ANDROID && !APPLE_UA,
  }
  const mode = scheduleModeOf(S)
  const layout = ['list', 'compact', 'focus'].includes(S.workoutView) ? S.workoutView : 'cards'
  const layoutLabel = { cards: t('Cards'), list: t('List'), compact: t('Compact') }[layout]
  const activeProfile = (S.equipProfiles || []).find(p => p.id === S.activeEquipId)
  const themeLabel = { dark: t('Dark'), light: t('Light'), system: t('System') }[S.theme || 'dark'] || t('Dark')
  // The value a root row shows, so most questions are answered without opening the page.
  const preview = {
    workout: () => (S.restSec > 0 ? t('{0} rest', fmtRest(S.restSec)) : t('No rest timer')) + ' · ' + layoutLabel,
    alerts: () => [S.sound ? t('Sound') : null, canVibrate && S.vibrate !== false ? t('Vibrate') : null, S.timerFlash ? t('Flash') : null].filter(Boolean).join(' · ') || t('Silent'),
    reminders: () => (S.reminder?.on ? (S.reminder.time || DEF.reminder?.time || '') : t('Off')),
    plan: () => (mode === 'rotation' ? t('Rotation') : t('Fixed Week')) + ' · ' + shortWeekday(weekStartOf(S) === SUNDAY ? 0 : 1),
    units: () => (S.unit || 'kg') + ' · ' + (LANGS[lang] || lang),
    equipment: () => (S.equipFilterOn && activeProfile ? activeProfile.name : ownsNoDumbbells(S) ? t('Everything but dumbbells') : t('Everything')),
    look: () => themeLabel + ' · ' + accentLabel(S),
    coach: () => (coachLocal?.mode === 'server' ? t('Your server') : coachLocal?.mode === 'byok' ? t('Your API key') : t('Off')),
    data: () => '',
    about: () => 'v' + __APP_VERSION__,
    watch: () => '',
  }

  const open = id => {
    if (id === 'coach') { nav('/coach/setup'); return }
    nav('/settings/' + id)
  }
  // Back the way you came when there is a way (the browser's back, Android's back, this button
  // all do the same); a page opened from a link with nothing behind it goes up to its parent.
  const back = () => {
    const up = PAGES[page]?.parent ? '/settings/' + PAGES[page].parent : '/settings'
    if ((window.history.state?.idx || 0) > 0) nav(-1)
    else nav(up, { replace: true })
  }

  /* ---------------- the pages ---------------- */
  const restRow = <Row icon="timer" iconTint="var(--orange)" title={t('Rest timer')} value={fmtRest(S.restSec)} accessory="chevron"
    onClick={() => durationSheet({
      title: t('Rest timer'), value: S.restSec, max: REST_MAX, off: t('Off'),
      footer: t('Scroll to 0:00 to turn the rest timer off.'),
      onDone: v => update(s => { s.restSec = v }),
    })} />
  // Default for a rest-pause burst added live on a plain set. A planned exercise's own "Rest (s)"
  // (in its drop set / burst config) overrides it, the same way the main rest timer is the
  // fallback for an exercise without a rest of its own. On the wheel too, 5 s to 5 min: the
  // burst's rest is never 0 (lib/history.js keeps it at 5 s at least), so the wheel stops there.
  const restPauseRow = <Row icon="bolt" iconTint="var(--orange)" title={t('Rest-pause rest')} value={fmtDuration(S.restPauseSec || 15)} accessory="chevron"
    onClick={() => durationSheet({
      title: t('Rest-pause rest'), value: S.restPauseSec || 15, min: REST_PAUSE_MIN, max: REST_PAUSE_MAX,
      footer: t('The short break between the bursts of a rest-pause set.'),
      onDone: v => update(s => { s.restPauseSec = v }),
    })} />

  // The rest between warm-up sets for every exercise without its own (Discord: seals' "separate
  // warm-up rest"). Absent is like the work sets, 0 no timer (lib/supersetFlow.js warmupRestSecFor).
  const warmAll = typeof S.warmupRestSec === 'number' ? S.warmupRestSec : null
  const setWarm = v => update(s => { if (v === null) delete s.warmupRestSec; else s.warmupRestSec = v })
  const warmupRestRow = <Row icon="timer" iconTint="var(--yellow)" title={t('Rest between warm-ups')} accessory="chevron"
    subtitle={t('The last warm-up still gets the full rest before your first work set.')}
    value={warmAll === null ? t('Like the work sets') : warmAll > 0 ? fmtRest(warmAll) : t('No timer')}
    onClick={() => menuSheet({
      title: t('Rest between warm-ups'),
      items: [
        { icon: 'timer', label: t('Like the work sets'), on: warmAll === null, onClick: () => setWarm(null) },
        { icon: 'pause', label: t('No timer'), on: warmAll === 0, onClick: () => setWarm(0) },
        { icon: 'clock', label: t('Pick a time'), on: warmAll > 0, onClick: () => durationSheet({
          title: t('Rest between warm-ups'), value: warmAll > 0 ? warmAll : 30, max: REST_MAX, off: t('No timer'),
          onDone: v => setWarm(v > 0 ? v : 0),
        }) },
      ],
    })} />

  const pages = {
    watch: () => <WatchSettingsPage />,
    gym: () => <GymReminderPage />,
    'gym-edit': () => <GymEditPage />,
    workout: () => <>
      <Section title={t('Rest')} footer={t('Each exercise can have its own rest too. Set it in the exercise settings of a routine.')}>
        {restRow}
        {/* //// Neoffice — gated on the level. This row put the words "rest-pause" on a beginner's
            Settings screen for a technique nothing else at their level offers. Found by
            views/jargon.level.test.jsx, which reads the rendered text rather than one rule at a time. */}
        {/* //// Neoffice — upstream v1.4.2's « Rest between warm-ups » follows the same rule: warm-up sets are a technique of the
            full level, so the row is there from the full level up, and for a member who already moved it off « like the work sets »
            (hide the control, never the data). */}
        {showsWarmupRestSetting(S) && warmupRestRow}
        {showsRestPauseSetting(S) && restPauseRow}
      </Section>
      <Section title={t('Logging')}>
        {/* Two names for the same judgement, so the column asks in the scale you already think in.
            The (i) sits before the control: you read it on the way to the choice, not after it. */}
        {/* //// Neoffice — the effort setting at the levels that show it (lib/level-visibility.js) */}
        {showsEffortSetting(S) && <Row icon="gauge" iconTint="var(--purple)" title={t('Effort per set')}>
          <button className="helpbtn" aria-label={t('What are RIR and RPE?')} onClick={effortHelpSheet}><Icon name="info" /></button>
          <Segmented className="seg-inline"
            options={[{ value: 'none', label: t('Off') }, { value: 'rir', label: t('RIR') }, { value: 'rpe', label: t('RPE') }]}
            value={effortOf(S)} onChange={v => update(s => { s.effort = v; delete s.showRir })} />
        {/* //// Neoffice — the effort row is gated on the detail level (lib/level-visibility.js showsEffortSetting). */}
        </Row>}
        {/* The line under each exercise that the rows are held against (#173). Tapping the line in
            a workout switches it too; this is where the choice can be found without knowing that. */}
        <SelectRow icon="history" iconTint="var(--blue)" title={t('Shown under each exercise')}
          value={S.logRef === 'best' ? 'best' : 'last'} onChange={v => update(s => { s.logRef = v })}
          options={[
            { value: 'last', label: t('Last time'), subtitle: t('What you did the last time, in that routine.') },
            { value: 'best', label: t('Best set'), subtitle: t('Your heaviest set of the exercise, from any workout.') },
          ]} />
        {/* One exercise at a time (cards with Prev/Next), the whole session stacked as a
            scrollable list, or that list stripped to just names and set rows (compact). Legacy or
            unknown values read as cards. The workout's ⋯ menu can override it for one session. */}
        <Row icon="layout" iconTint="var(--blue)" title={t('Layout')}>
          <Segmented className="seg-inline"
            options={[{ value: 'cards', label: t('Cards') }, { value: 'list', label: t('List') }, { value: 'compact', label: t('Compact') }, { value: 'focus', label: t('Focus') }]}
            value={layout} onChange={v => update(s => { s.workoutView = v })} />
        </Row>
        {/* The saved side of the Layout menu's "Collapse completed exercises" (#241): on here, every
            session starts with it, and the menu still flips it for one session. Setting it here
            also drops a running session's own choice, so the switch does what it says right away. */}
        <Row icon="minimize" iconTint="var(--teal)" title={t('Collapse completed exercises')}
          subtitle={t('In List and Compact, a finished exercise folds into one line.')}>
          <Switch aria-label={t('Collapse completed exercises')} checked={!!S.collapseCompleted}
            onChange={v => update(s => { s.collapseCompleted = v; if (s.active) delete s.active.collapseCompleted })} />
        </Row>
        {/* Its counterpart for Cards and Focus (#523): Prev, Next and the swipe jump over an
            exercise whose every set is done. */}
        <Row icon="skipForward" iconTint="var(--teal)" title={t('Skip completed exercises')}
          subtitle={t('In Cards and Focus, Prev and Next hop over a finished exercise.')}>
          <Switch aria-label={t('Skip completed exercises')} checked={S.skipCompleted === true}
            onChange={v => update(s => { if (v) s.skipCompleted = true; else delete s.skipCompleted })} />
        </Row>
      </Section>
      <Section title={t('Before and during')}>
        {/* //// Neoffice — asking for a weigh-in is OFF by default (see DEF): body weight is a sensitive
            subject, and being made to look at a number before every session is not a neutral prompt.
            Upstream's "Weigh in before workouts" switch (v1.3.7, issue #137, `S.weighIn`) is not drawn:
            this three-way choice (never / weekly / each session) is the same question with the default
            the club asked for. The key is still honoured by startFlow, so nothing set elsewhere is lost. */}
        <Row icon="scale" iconTint="var(--green)" title={t('Ask me to weigh in')}>
          <Segmented className="seg-inline"
            options={[{ value: 'never', label: t('Never') }, { value: 'week', label: t('Weekly') }, { value: 'workout', label: t('Each session') }]}
            value={S.weighInEvery || 'never'}
            onChange={v => update(s => { s.weighInEvery = v })} />
        </Row>
        {(wakeOK || !MOBILE) && (
          <Row icon="phoneScreen" iconTint="var(--yellow)" title={t('Keep screen awake')}
            subtitle={wakeOK ? t('The screen stays on while a workout is running, so you don’t have to unlock your phone between sets.') : t('Not supported in this browser.')}>
            <Switch checked={wakeOK && S.keepAwake !== false} disabled={!wakeOK}
              onChange={v => update(s => { s.keepAwake = v })} />
          </Row>
        )}
        {/* 'full'/'mini' is also what the tap-toggle on the workout animation writes; 'off' hides
            workout media entirely (library, detail sheet and picker thumbs are unaffected).
            Legacy/unknown values read as 'full'. */}
        <Row icon="image" iconTint="var(--teal)" title={t('Exercise animations')}>
          <Segmented className="seg-inline"
            options={[{ value: 'full', label: t('Full') }, { value: 'mini', label: t('Small') }, { value: 'off', label: t('Hidden') }]}
            value={S.gifSize === 'mini' || S.gifSize === 'off' ? S.gifSize : 'full'}
            onChange={v => update(s => { s.gifSize = v })} />
        </Row>
        {/* Store apps: how sharp the animations are, from packs this device downloads. Per device,
            never synced: the profile is not touched (components/Animations.jsx). */}
        <AnimationQualityRow />
      </Section>
      <Section>
        <Row icon="wrench" iconTint="var(--grey)" title={t('Fine-tuning')} subtitle={t('Buttons, timed sets')} accessory="chevron" onClick={() => open('advanced')} />
      </Section>
    </>,

    advanced: () => {
      // S.wc overlays DEF.wc, so a profile from before these switches existed reads as the lean default.
      const wc = workoutControls(S)
      const setWc = (k, v) => update(s => { s.wc = { ...workoutControls(s), [k]: v } })
      return <>
        <Section title={t('Sessions and timed sets')}>
          {/* Whose reps a planned session opens with (lib/session-start.js). The plan's by default:
              the routine is what you said you would do, and history and progression decide the
              weight. The other choice is the old behaviour, reps carried over from last time, and
              the weight too for an exercise with progression off. Absent (an older profile) reads
              as the plan. */}
          <SelectRow icon="clipboard" iconTint="var(--green)" title={t('Planned sessions start from')}
            value={S.startFrom === 'last' ? 'last' : 'plan'} onChange={v => update(s => { s.startFrom = v })}
            options={[
              { value: 'plan', label: t('Your plan'), subtitle: t('The routine’s sets and reps. Your history decides the weight.') },
              { value: 'last', label: t('Your last session'), subtitle: t('The reps you logged last time in that routine, carried over. With progression off, the weight too.') },
            ]} />
          {/* Where "last time" is read from (lib/history.js lastAcrossRoutines, #770): the routine's
              own last session by default (#216), so a heavy and a light day keep their numbers.
              'any' reads the exercise's newest session wherever it was. Absent reads as the routine. */}
          <SelectRow icon="history" iconTint="var(--indigo)" title={t('Last time means')}
            value={S.lastFrom === 'any' ? 'any' : 'routine'} onChange={v => update(s => { s.lastFrom = v })}
            options={[
              { value: 'routine', label: t('This routine'), subtitle: t('Your last session of the exercise in the same routine. Heavy day and light day stay apart.') },
              { value: 'any', label: t('Any workout'), subtitle: t('The last time you did the exercise, whichever routine it was in.') },
            ]} />
          <Row icon="stopwatch" iconTint="var(--orange)" title={t('Keep timing after target')}
            subtitle={t('Timed sets continue up to 15 extra minutes. Tap Done to log the actual duration.')}>
            <Switch aria-label={t('Keep timing after target')} checked={!!S.timedSetOvertime}
              onChange={v => update(s => { s.timedSetOvertime = v })} />
          </Row>
        </Section>
        {/* The lean workout screen keeps the sets and one "more" button per exercise; each switch
            brings one of the old always-visible button groups back for people who liked them. */}
        <Section title={t('Buttons on the workout screen')} footer={t('Everything hidden here stays one tap away: the ⋯ button of an exercise and the number of a set.')}>
          <Row icon="plusCircle" iconTint="var(--green)" title={t('Weight and reps buttons')} subtitle={t('Off: tap the number and type it')}>
            <Switch checked={wc.steppers} onChange={v => setWc('steppers', v)} />
          </Row>
          <Row icon="bolt" iconTint="var(--orange)" title={t('Drop and burst shortcuts on every set')}>
            <Switch checked={wc.setShortcuts} onChange={v => setWc('setShortcuts', v)} />
          </Row>
          {/* Swipe actions (v1.3.11): not a button, but the same question of what a set row does. The
              one switch covers Plan's lists too; the stored key keeps its old name, swipeSets. */}
          <Row icon="swap" iconTint="var(--indigo)" title={t('Swipe actions')} subtitle={t('Sets, routines and the loop: left removes, right copies')}>
            <Switch aria-label={t('Swipe actions')} checked={wc.swipeSets} onChange={v => setWc('swipeSets', v)} />
          </Row>
          {/* The chip row at the top of a workout (#323): not a button row, but the same question of
              what the workout screen shows. On by default, it is about one line tall. */}
          <Row icon="more" iconTint="var(--mint)" title={t('Exercise chips at the top')} subtitle={t('A numbered dot per exercise, filled as you go. Tap one to jump there.')}>
            <Switch aria-label={t('Exercise chips at the top')} checked={wc.exerciseChips} onChange={v => setWc('exerciseChips', v)} />
          </Row>
          {/* The live session's body (#670): at the end of the chip row, or in the header without it. */}
          <Row icon="figureStrength" iconTint="var(--orange)" title={t('Muscle map at the top')} subtitle={t('A tiny body that lights up as you tick sets. Tap it for the details.')}>
            <Switch aria-label={t('Muscle map at the top')} checked={wc.muscleMap} onChange={v => setWc('muscleMap', v)} />
          </Row>
          <Row icon="link" iconTint="var(--blue)" title={t('Superset buttons in the exercise header')}>
            <Switch checked={wc.pairButtons} onChange={v => setWc('pairButtons', v)} />
          </Row>
          <Row icon="swap" iconTint="var(--teal)" title={t('Move, swap and remove buttons below the exercise')}>
            <Switch checked={wc.exerciseButtons} onChange={v => setWc('exerciseButtons', v)} />
          </Row>
        </Section>
      </>
    },

    alerts: () => {
      const iPhone = appleTouchDevice()
      return <>
        <Section title={t('When a rest ends')}>
          <Row icon="speaker" iconTint="var(--pink)" title={t('Play a sound')}>
            {/* Turning the sound on is a tap: unlock the audio context now so a timer that ends
                before the next set check can already sound (iOS, #152). */}
            <Switch checked={!!S.sound} onChange={v => { if (v) unlock(true); update(s => { s.sound = v }) }} />
          </Row>
          {/* The chime that replaced the original three beeps (Discord: "too quiet under music")
              is not an improvement for everyone: louder is a cost with headphones or in a quiet
              room, and some want a sound that feels like theirs (#306). The chime by default; the
              sheet plays each one as you tap it (restSoundSheet). */}
          {S.sound && <Row icon="speaker" iconTint="var(--pink)" title={t('Sound')} value={t(REST_SOUND_LABEL[restSoundOf(S)])}
            accessory="chevron" onClick={restSoundSheet} />}
          {/* iOS only (WebKit's audio-session API, iOS 17+): with it off the ring/silent switch
              mutes the timer. On, the phone treats the timer like a music player (exclusive, and
              the music app is not told it may resume), so it is a choice, off by default. */}
          {S.sound && playOnSilentSupported() && (
            <Row icon="speaker" iconTint="var(--orange)" title={t('Play even on silent')}
              subtitle={<>{t('Music playing on this phone stops during a workout and does not resume by itself.')}<br />{t('iPhone only')}</>}>
              <Switch checked={!!S.soundOnSilent} onChange={v => update(s => { s.soundOnSilent = v })} />
            </Row>
          )}
        </Section>
        {/* The buzz at the end of a rest or a hold and on a set tick, on its own switch like the
            sound (Discord, asierlama). iOS has no navigator.vibrate: the row stays, greyed out,
            and says so, instead of an iPhone user looking for a setting that is not there. */}
        <Section footer={!canVibrate && iPhone ? t('iPhone doesn’t let openGym vibrate. A sound or a flash does the job.') : null}>
          <Row icon="vibrate" iconTint="var(--indigo)" title={t('Vibrate')} className={canVibrate ? '' : 'dis'}
            subtitle={canVibrate ? null : iPhone ? t('Not on iPhone') : t('Not supported in this browser.')}>
            <Switch checked={canVibrate && S.vibrate !== false} disabled={!canVibrate} onChange={v => update(s => { s.vibrate = v })} />
          </Row>
          {/* Android app only (#375), and only shown there, so it needs no "Android app only" hint: silent mode mutes the ordinary buzz and the notification's,
              so the end of a rest or a hold can buzz as an alarm instead. Opt-in, like the iOS row
              above: an alarm-class buzz is the most insistent thing an app can do on some phones. */}
          {MOBILE && android && canVibrate && S.vibrate !== false && (
            <Row icon="vibrate" iconTint="var(--indigo)" title={t('Vibrate on silent too')}
              subtitle={t('The end of a rest or a hold buzzes like an alarm, even in silent mode.')}>
              <Switch checked={!!S.vibrateOnSilent} onChange={v => update(s => { s.vibrateOnSilent = v })} />
            </Row>
          )}
          <Row icon="sun" iconTint="var(--yellow)" title={t('Flash the screen')}>
            <Switch checked={!!S.timerFlash} onChange={v => update(s => { s.timerFlash = v })} />
          </Row>
        </Section>
      </>
    },

    reminders: () => <>
      <NotificationsCard S={S} update={update} toast={toast} />
      {MOBILE && <Section footer={t('A nudge when you walk into your gym.')}>
        <Row icon="mapPin" iconTint="var(--green)" title={t('Gym reminder')} value={gymOn ? t('On') : t('Off')} accessory="chevron" onClick={() => nav('/settings/gym')} />
      </Section>}
    </>,

    plan: () => <>
      <Section>
        {/* Fixed Week (S.week) or Rotation (the live queue, lib/queue.js + lib/rotation.js).
            Derived from the queue, never stored. */}
        <Row icon="repeat" iconTint="var(--orange)" title={t('How you train')}>
          {/* //// Neoffice — read-only where the club writes the plan (mayEdit, see views/Plan.jsx). */}
          {externalQ || !mayEdit
            ? <span className="small dim">{mode === 'rotation' ? t('Rotation') : t('Fixed Week')}{externalQ ? ' · ' + t('Externally managed') : ''}</span>
            : <Segmented className="seg-inline"
                options={[{ value: 'week', label: t('Fixed Week') }, { value: 'rotation', label: t('Rotation') }]}
                value={mode} onChange={setScheduleMode} />}
        </Row>
        {/* Rotation chosen with no loop running yet: the loop is built on Plan. */}
        {/* //// Neoffice — where the club writes the plan, nothing to build here (S.perms.editPlan). */}
        {mode === 'rotation' && !liveQ && mayEdit && <Row icon="calendar" iconTint="var(--orange)" title={t('Build your loop in Plan')}
          accessory="chevron" onClick={() => nav('/plan')} />}
        {/* Monday or Sunday: the Plan list, the Home strip, the calendar grid and every "this
            week" total follow it. Stored as a getDay() index (see lib/format.js). */}
        <Row icon="calendar" iconTint="var(--orange)" title={t('Week starts on')}>
          <Segmented className="seg-inline"
            options={[{ value: MONDAY, label: t('Monday') }, { value: SUNDAY, label: t('Sunday') }]}
            value={weekStartOf(S)} onChange={v => update(s => { s.weekStart = v })} />
        </Row>
      </Section>
      {/* //// Neoffice — no starter plan where the club writes the member's plan (S.perms.editPlan). */}
      {mayEdit && <Section>
        <Row icon="clipboard" iconTint="var(--green)" title={t('Load starter plan')} accessory="chevron" onClick={starterPlanSheet} />
      </Section>}
    </>,

    units: () => <>
      <Section>
        <SelectRow
          icon="globe" iconTint="var(--blue)" title={t('Language')}
          value={lang} onChange={v => update(s => { s.lang = v; s.langAuto = false })}
          options={Object.entries(LANGS).map(([k, name]) => ({
            value: k, label: name,
            subtitle: INSTR_LANGS.includes(k) ? null : t("Exercise instructions aren't translated into this language yet, so they stay in English."),
          }))}
        />
        {ctx.nameLang && <>
          <Row icon="globe" iconTint="var(--purple)" title={t('English exercise names')}
            subtitle={t('Show the English name in parentheses next to the translated one.')}>
            {/* //// Neoffice — the same default as setLang: names alone in French, the English beside them elsewhere. */}
            <Switch checked={S.enParens?.[baseLang(lang)] ?? baseLang(lang) !== 'fr'}
              disabled={S.enOnly?.[baseLang(lang)] === true}
              onChange={v => update(s => { s.enParens = { ...(s.enParens || {}), [baseLang(lang)]: v } })} />
          </Row>
          <Row icon="globe" iconTint="var(--purple)" title={t('English names only')}
            subtitle={t('Replace the translated names with the original English ones.')}>
            <Switch checked={S.enOnly?.[baseLang(lang)] === true}
              onChange={v => update(s => { s.enOnly = { ...(s.enOnly || {}), [baseLang(lang)]: v } })} />
          </Row>
        </>}
      </Section>
      <Section footer={t('Switching the unit offers to convert every stored weight.')}>
        <Row icon="scale" iconTint="var(--teal)" title={t('Weight unit')}>
          <Segmented className="seg-inline"
            options={[{ value: 'kg', label: 'kg' }, { value: 'lb', label: 'lb' }]}
            value={S.unit} onChange={v => switchUnit(v)} />
        </Row>
        {/* Display only: one decimal reads fine for plate-loadable numbers, two for anyone whose
            per-side figure lands on .25 or .75, or who loads microplates (issue #139). Nothing is
            stored or rounded differently; lib/format.js fmtNum just prints what is already there. */}
        <Row icon="ruler" iconTint="var(--teal)" title={t('Weight decimals')} subtitle={t('How precisely weights are shown.')}>
          <Segmented className="seg-inline"
            options={[{ value: 1, label: t('0.5') }, { value: 2, label: t('0.25') }]}
            value={S.wdec === 2 ? 2 : 1} onChange={v => update(s => { s.wdec = v })} />
        </Row>
        {/* Cardio speed (Discord "miles per hour"). Unlike the weight unit this converts nothing:
            speeds stay stored in km/h and only what is shown and typed follows it (lib/speed.js).
            Until chosen it follows the weight unit, so a profile in pounds already reads mph. */}
        <Row icon="figureRun" iconTint="var(--teal)" title={t('Speed unit')}>
          <Segmented className="seg-inline"
            options={[{ value: 'kmh', label: 'km/h' }, { value: 'mph', label: 'mph' }]}
            value={speedUnitOf(S)} onChange={v => update(s => { s.speedUnit = v })} />
        </Row>
        {/* Which formula turns a set into an estimated 1RM (Discord, #155): the exercise page,
            the 1RM chart and records all follow it. Formula names are people, not words. */}
        {/* //// Neoffice — from the Normal level, like the estimate it feeds (lib/level-visibility.js). */}
        {showsOneRmFormula(S) && <SelectRow icon="chart" iconTint="var(--teal)" title={t('1RM formula')}
          value={formulaOf(S)} onChange={v => update(s => { s.oneRmFormula = v })}
          options={[
            { value: 'epley', label: 'Epley', subtitle: t('The common one. A bit generous at higher reps.') },
            { value: 'brzycki', label: 'Brzycki', subtitle: t('More conservative above five reps.') },
            { value: 'lombardi', label: 'Lombardi', subtitle: t('Generous, especially at high reps.') },
            { value: 'oconner', label: FORMULA_NAMES.oconner, subtitle: t('The most conservative of the classics.') },
            { value: 'mayhew', label: 'Mayhew' },
            { value: 'wathan', label: 'Wathan' },
            { value: 'lander', label: 'Lander' },
            { value: 'weighted', label: t('Blend of all'), subtitle: t('Averages seven formulas and reads your RIR when you log it.') },
          ]} />}
        {/* Gross volume for people comparing with other apps (#719). Off is the app's own rule,
            work sets only; on, every screen that shows a volume counts done warm-ups too
            (lib/history.js sessionVolume). Records and progression never read warm-ups. */}
        <Row icon="sunrise" iconTint="var(--teal)" title={t('Count warm-ups in volume')}
          subtitle={t('Handy when you compare with another app. Records ignore warm-ups either way.')}>
          <Switch aria-label={t('Count warm-ups in volume')} checked={S.volumeWarmups === true}
            onChange={v => update(s => { s.volumeWarmups = v })} />
        </Row>
      </Section>
    </>,

    equipment: () => <EquipmentCard S={S} update={update} />,

    look: () => <>
      {/* //// Neoffice — how much of the journal to show. The client's most structural request (31.08):
          the data is "trop technique" for someone starting out, to the point of putting them off. A
          DENSITY control, not a permission and not a skill grade: Simple hides the body map and the
          effort histogram, Complete brings them back with all their history. Nothing is deleted,
          nothing is locked. First on this page: it decides what every screen even shows. */}
      <Section>
        <Row icon="lightbulb" iconTint="var(--accent)" title={t('Level of detail')}>
          <Segmented className="seg-inline"
            options={[{ value: 'simple', label: t('Simple') }, { value: 'normal', label: t('Normal') }, { value: 'full', label: t('Advanced') }]}
            value={levelOf(S)}
            onChange={v => update(s => { s.level = v })} />
        </Row>
      </Section>
      <Section footer={DEMO || MOBILE || !user ? undefined : t('synced with your profile')}>
        <Row icon="moon" iconTint="var(--indigo)" title={t('Theme')}>
          <Segmented
            className="seg-inline"
            options={[
              { value: 'dark', icon: 'moon', label: t('Dark') },
              { value: 'light', icon: 'sun', label: t('Light') },
              { value: 'system', icon: 'gear', label: t('System') },
            ]}
            value={S.theme || 'dark'}
            onChange={v => update(s => { s.theme = v })}
          />
        </Row>
        <div className="lrow" style={{ flexWrap: 'wrap', rowGap: 12, paddingBottom: 14 }}>
          <span className="lrow-i" style={{ '--tint': 'var(--purple)' }}><Icon name="palette" /></span>
          <span className="lrow-m"><span className="lrow-t">{t('Accent color')}</span></span>
          <span className="lrow-v">{accentLabel(S)}</span>
          <AccentSwatches S={S} update={update} />
        </div>
        {/* The home-screen icon: the phone's own, not synced. iPhone only in 1.4.3 (Android follows). */}
        {MOBILE && platformNow() === 'ios' && <AppIconRow />}
        {/* How the muscle map is drawn. The exercise drawings follow it until they are set below. */}
        <Row icon="figureStrength" iconTint="var(--teal)" title={t('Body diagram')}>
          <Segmented
            className="seg-inline"
            options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
            value={S.body === 'female' ? 'female' : 'male'}
            onChange={v => update(s => { s.body = v })}
          />
        </Row>
        {/* Which figure the exercise animations show where both exist (about 940 exercises; the
            rest are drawn once). Only the picture changes: the exercise and its id stay the same,
            so nothing logged is touched, on this device or any other. */}
        <Row icon="figureStrength" iconTint="var(--teal)" title={t('Exercise drawings')}
          subtitle={t('Where an exercise is drawn on both figures. Your workouts stay exactly as they are.')}>
          <Segmented
            className="seg-inline"
            options={[{ value: 'male', label: t('Male') }, { value: 'female', label: t('Female') }]}
            value={figureOf(S)}
            onChange={v => update(s => { s.exFigure = v })}
          />
        </Row>
      </Section>
      {/* Halloween and whatever comes after it (lib/seasonal.js), on a page of their own. */}
      {/* //// Neoffice — from the Normal level (lib/level-visibility.js showsSeasonalThemes): no seasons for a beginner. */}
      {showsSeasonalThemes(S, 'halloween') && <Section>
        <Row icon="pumpkin" iconTint="var(--orange)" title={t('Seasonal themes')} subtitle={t('Little extras for the time of year.')}
          value={activeSeasonTitle(S)} accessory="chevron" onClick={() => open('themes')} />
      </Section>}
      <Section title={t('On Home')}>
        {/* Membership QR codes on Home (views/CheckIn.jsx); off = no Home card, no route. */}
        <Row icon="qr" iconTint="var(--blue)" title={t('Gym check-in')}
          subtitle={t('Show a card on Home with your membership QR codes.')}>
          <Switch checked={S.checkIn !== false} onChange={v => update(s => { s.checkIn = v })} />
        </Row>
        {/* The Home summary is optional; hiding it leaves weight logging, history and Stats intact. */}
        <Row icon="scale" iconTint="var(--green)" title={t('Body weight')}
          subtitle={t('Show the body weight card on Home.')}>
          <Switch checked={S.showWeightCard !== false} onChange={v => update(s => { s.showWeightCard = v })} />
        </Row>
        {/* The bar at the top that says the app is offline, kept local, or not synced (#369, #330).
            Here and not under Server & sync, which a phone kept local never shows. Switching it on
            also brings back the no-server line its × hid (#454). */}
        {/* //// Neoffice — the dot is on the Account tab here, where Settings live (components/TabBar.jsx). */}
        {!DEMO && <Row icon="cloud" iconTint="var(--blue)" title={t('Show connection status')}
          subtitle={t('Off: the bar at the top is hidden. A dot on the Account tab still warns when syncing is stuck.')}>
          <Switch checked={S.connStatus !== false} onChange={v => update(s => { s.connStatus = v; if (v) s.connLocal = true })} />
        </Row>}
        {/* //// Neoffice — the Classes tab in the bottom bar. Only shows up if the club actually RUNS
            classes: offering to hide something that does not exist makes people think they lost it. */}
        {ctx.classes && <Row icon="calendar" iconTint="var(--acc)" title={t('Classes tab')}
          subtitle={t('Shows your club’s classes in the bottom bar.')}>
          <Switch checked={S.classesTab !== false} onChange={v => update(s => { s.classesTab = v })} />
        </Row>}
      </Section>
    </>,

    // One section per seasonal theme (lib/seasonal.js). Auto shows it in its weeks; On keeps it
    // all year, Off never. Synced like the rest of Look; once-a-day surprises stay per device.
    themes: () => <>
      {THEMES.map(th => {
        const choice = seasonChoice(S, th.id)
        const set = (k, v) => update(s => { s.seasonal = { ...(s.seasonal || {}), [k]: v } })
        const note = choice === 'on' ? t('On all year round. Bold choice.')
          : choice === 'off' ? t('Off, even in season. Fair enough.')
          : inSeason(th) ? t(th.during) : t(th.back)
        return <Section key={th.id} footer={note}>
          <Row icon={th.icon} iconTint={th.tint} title={t(th.title)}>
            <Segmented className="seg-inline"
              options={[{ value: 'auto', label: t('Auto') }, { value: 'on', label: t('On') }, { value: 'off', label: t('Off') }]}
              value={choice} onChange={v => set(th.id, v)} />
          </Row>
          {th.colors && <Row icon="palette" iconTint="var(--purple)" title={t(th.colorsTitle)} subtitle={t(th.colorsNote)}>
            <Switch aria-label={t(th.colorsTitle)} checked={S.seasonal?.[th.id + 'Colors'] === true}
              onChange={v => set(th.id + 'Colors', v)} />
          </Row>}
          {/* On by default while the theme shows; nothing there is ever in the way of a set. */}
          {th.workoutTitle && <Row icon="play" iconTint="var(--green)" title={t(th.workoutTitle)} subtitle={t(th.workoutNote)}>
            <Switch aria-label={t(th.workoutTitle)} checked={S.seasonal?.[th.id + 'Workout'] !== false}
              onChange={v => set(th.id + 'Workout', v)} />
          </Row>}
        </Section>
      })}
      {/* While Halloween shows, a way to the matching icon in Look & Home (it is there all year). */}
      {MOBILE && platformNow() === 'ios' && activeSeason(S) === 'halloween' && <Section>
        <Row icon="pumpkin" iconTint="var(--orange)" title={t('Try the Halloween app icon')} accessory="chevron"
          onClick={() => nav('/settings/look', { state: { find: 'App icon' } })} />
      </Section>}
    </>,

    data: () => <>
      <Section title={t('Back up')}>
        {/* //// Neoffice — the JSON backup only: no photos or videos on the club's server, so no zip. */}
        <Row icon="share" iconTint="var(--blue)" title={t('Export backup (JSON)')} accessory="chevron" onClick={doExport} />
        {/* //// Neoffice — the report and the spreadsheet export: from the Normal level (showsReports). The JSON backup stays. */}
        {showsReports(S) && <Row icon="note" iconTint="var(--green)" title={t('Performance report (PDF)')} subtitle={t('Charts, totals and every workout of the last days or weeks.')} accessory="chevron" onClick={reportSheet} />}
        {/* One row per set for spreadsheets and other apps (#647); our own importer reads it back. */}
        {showsReports(S) && <Row icon="share" iconTint="var(--green)" title={t('Export as spreadsheet (CSV)')} subtitle={t('Workouts, body weight and measurements')} accessory="chevron" onClick={csvExportSheet} />}
        {/* 14 is AUTO_BACKUP_KEEP in lib/mobile.js, written out because the Settings tests mock
            that module wholesale; mobile.autobackup.test.js pins the two together. */}
        {MOBILE && <Row icon="folder" iconTint="var(--blue)" title={t('Auto-backup on changes')}
          subtitle={autoBackupSubtitle(android && S.autoBackup ? backupDir : null, 14)}>
          <Switch checked={!!S.autoBackup} onChange={v => update(s => { s.autoBackup = v })} />
        </Row>}
        {/* Android only: the system folder picker (#161). iOS shows Documents in Files already. */}
        {MOBILE && android && S.autoBackup && <BackupFolderRow />}
      </Section>
      {MOBILE && <HealthConnectCard S={S} toast={toast} android={android} />}
      <Section title={t('Bring data in')}>
        <Row icon="download" iconTint="var(--teal)" title={t('Import backup')} accessory="chevron" onClick={() => fileRef.current.click()} />
        <Row icon="download" iconTint="var(--teal)" title={t('Import from another app')}
          subtitle={t('FitNotes, Strong, Hevy, GymMane, openGym CSV, or body weight from Apple Health')}
          accessory="chevron" onClick={() => importRef.current.click()} />
        <Row icon="key" iconTint="var(--teal)" title={t('Import from Hevy')}
          subtitle={t('Pull your history with a Hevy Pro API key')}
          accessory="chevron" onClick={importFromHevy} />
      {/* //// Neoffice — no media rows: photos and videos stay on the member's phone. */}
      </Section>
      <Section>
        <Row icon="trash" iconTint="var(--red)" title={t('Reset everything')} danger onClick={resetEverything} />
      </Section>
      {/* //// Neoffice — a JSON backup, no zip (see doImport) */}
      <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: 'none' }} onChange={doImport} />
      {/* Reset after reading so picking the same file twice still fires onChange. */}
      <input ref={importRef} type="file" accept=".csv,.xml,text/csv,text/xml" style={{ display: 'none' }}
        onChange={ev => { const f = ev.target.files[0]; if (f) importFromApp(f); ev.target.value = '' }} />
    </>,

    about: () => <>
      {/* //// Neoffice — upstream's update rows (the APK download for the web, the release check on
          gitlab.com for its Android app) are left out: the club's journal is a web app served by the
          instance and updates with it; a row sending members to an APK on the author's site would be
          a wrong door. The version stays. */}
      <Section>
        {/* //// Neoffice — the update rows are left out (see above): the instance updates the journal. */}
        <Row icon="info" iconTint="var(--grey)" title={t('Version')} value={'v' + __APP_VERSION__} />
      </Section>
      {/* Support: the project's own donation pages, and on the iPhone a straight line to writing a
          review. Plain links, no pop-up asking for anything (App Store 5.6.1). */}
      <Section title={t('Support openGym')} footer={t('openGym is free: no ads, no subscriptions, no tracking. A coffee keeps it that way.')}>
        {MOBILE && ios && <Row icon="star" iconTint="var(--orange)" title={t('Rate openGym on the App Store')} accessory="chevron"
          onClick={() => window.open('https://apps.apple.com/app/id6822275400?action=write-review', '_blank', 'noopener')} />}
        <Row icon="heart" iconTint="var(--pink)" title={t('Buy me a coffee')} subtitle="Buy Me a Coffee" accessory="chevron"
          onClick={() => window.open('https://buymeacoffee.com/duartesantos', '_blank', 'noopener')} />
        <Row icon="heart" iconTint="var(--blue)" title="Ko-fi" accessory="chevron"
          onClick={() => window.open('https://ko-fi.com/opengym', '_blank', 'noopener')} />
        <Row icon="heart" iconTint="var(--purple)" title="GitHub Sponsors" accessory="chevron"
          onClick={() => window.open('https://github.com/sponsors/DuarteSantos8', '_blank', 'noopener')} />
      </Section>
      {/* "Add to Home screen": not inside the phone app, and not once it is installed. Safari's
          Share menu only on Apple (an iPad says Macintosh too); Windows and Linux get Chrome's
          install icon instead of an iPhone tip. */}
      {!MOBILE && !standalone() && <Section title={t('Tip')}>
        <Row icon="share" iconTint="var(--blue)"
          title={IS_ANDROID ? t('In Chrome: ⋮ menu → Add to Home screen') : APPLE_UA ? t('In Safari: Share → Add to Home Screen') : t('In Chrome or Edge: the install icon in the address bar')}
          subtitle={t('to install openGym as a full-screen app.') + ' ' + (user ? t('Your data syncs with your profile. Sign in anywhere and it’s there.') : t('Guest data stays on this device, so export a backup now and then!'))} />
      </Section>}
      {/* The version, where the support template tells people to look for it. On the phone
          build there is no address bar and no about box, so without this there is no way to tell
          which build you are running, or whether an update actually installed. */}
      <div className="dim small sp-version">
        openGym v{__APP_VERSION__} · {t('free & open source (AGPL v3)')}<br />
        {/* //// Neoffice — our fork's source: AGPL §13 asks for the source of THE version that runs, and
            what runs here is the fork. */}
        <a href="https://github.com/bvisible/openGym" target="_blank" rel="noopener">{t('Source code')}</a> · exercise data: hasaneyldrm/exercises-dataset (MIT)<br />
        {/* Attribution the media licence asks for word for word (agreement §8c), so it is not translated */}
        Exercise media © Aliaksandr Makatserchyk, <a href="https://gymvisual.com/" target="_blank" rel="noopener">Gym visual</a>, gymvisual.com.
        Media licensed for use in openGym only; see <a href="https://github.com/DuarteSantos8/openGym/blob/main/NOTICE.md" target="_blank" rel="noopener">NOTICE.md</a>
      </div>
    </>,

    account: () => <>
      {/* //// Neoffice — the member is signed in with their Neoffice account: no server address, no
          passkey, password or device link, no pairing, no account id, no Disconnect. How things stand
          and « Sync now » (upstream's Server & sync block) are rows of this one block (SyncRows), and
          signing out ends the Frappe session. */}
      {!(MOBILE && user) && <Section title={MOBILE ? t('Your data') : DEMO ? t('Demo') : t('Account')}>
        {MOBILE ? <>
          {/* //// Neoffice — no « Connect to my server »: the journal is a page of the club's instance. */}
          <Row icon="lock" iconTint="var(--acc)" title={t('All data stays on this phone')} subtitle={t('No account, no cloud. Back it up anytime in Data & backup.')} />
        </> : DEMO ? <>
          <Row icon="info" iconTint="var(--acc)" title={t('You’re in the demo')} subtitle={t('Example data, stored only in this browser. Go wild and change anything you like.')} />
          <Row icon="reset" iconTint="var(--blue)" title={t('Reset demo data')} accessory="chevron"
            onClick={() => confirmSheet({ title: t('Reset demo data?'), message: t('Puts the example plan, workouts and weigh-ins back the way they started.'), confirmText: t('Reset'), onConfirm: () => { resetDemo(); nav('/home'); toast(t('Demo data reset')) } })} />
          <Row icon="rocket" iconTint="var(--indigo)" title={t('Self-host openGym')} subtitle={t('Passkey sign-in, sync across your devices, your own data.')} accessory="chevron"
            onClick={() => window.open(REPO, '_blank', 'noopener')} />
        </> : user ? <>
          {/* //// Neoffice — the account is the member's Neoffice account; sync and sign-out are ours (SyncRows, signOutHere). */}
          <Row icon="personCircle" iconTint="var(--grey)" title={user.name} subtitle={t('Signed in with your Neoffice account.')} />
          <SyncRows />
          <Row icon="signOut" iconTint="var(--red)" title={t('Sign out')} danger onClick={signOutHere} />
        {/* //// Neoffice — while the page boot's session is read, before the member's name is known. */}
        </> : (
          <Row icon="lock" iconTint="var(--grey)" title={t('Signing in…')} />
        )}
      </Section>}
      {/* //// Neoffice — upstream v1.4.2's « Delete my account » (App Store rule 5.1.1(v)) is not here: a member's account is a Neoffice
          account of the club's instance, kept or closed by the club in the Frappe desk, and the journal has no route that deletes one. */}
      {/* The connection banner already says this to a guest; the line is for when it is switched
          off, or its × hid it (#454). */}
      {!user && !DEMO && !MOBILE && !(showsConnection(S) && showsLocalLine(S)) && <p className="sect-f" style={{ marginTop: -18, marginBottom: 22 }}>{t('Guest mode: your data lives only in this browser.')}</p>}
    </>,
  }

  /* ---------------- a page ---------------- */
  if (page && pages[page]) {
    const parent = PAGES[page].parent
    return <div className="narrow" ref={body}>
      <div className="sp-nav">
        {/* Named by what it says ("Settings", "Workout"), so a voice command for the visible
            word finds it; the chevron is hidden from assistive tech. */}
        <button className="sp-back" data-back={((window.history.state?.idx || 0) > 0 ? pathBefore() : null) || (parent ? '/settings/' + parent : '/settings')} onClick={back}>
          <Icon name="chevronLeft" /><span>{parent ? t(PAGES[parent].title) : t('Settings')}</span>
        </button>
        <h1 className="sp-title">{t(PAGES[page].title)}</h1>
      </div>
      {pages[page]()}
    </div>
  }

  /* ---------------- the root ---------------- */
  return <SettingsRoot ctx={ctx} preview={preview} open={open} user={user} sync={sync} entryKey={entryKey}
    home={() => nav('/home')} go={(hit) => {
      if (hit.page === 'coach') { nav('/coach/setup'); return }
      nav('/settings/' + hit.page, hit.isPage ? undefined : { state: hit.via ? { find: hit.title, via: hit.via } : { find: hit.title } })
    }} />
}

function SettingsRoot({ ctx, preview, open, user, sync, home, go, entryKey }) {
  // The router's key for this history entry, taken once. From the router rather than
  // window.history: drawn under an edge swipe back the page is the entry before the current one.
  const [key] = useState(() => (entryKey && entryKey !== 'default' && entryKey !== 'back-preview' ? entryKey : window.history.state?.key || null))
  const [q, setQ] = useState(() => (key && lastQuery.key === key ? lastQuery.q : ''))
  const set = v => { lastQuery = { q: v, key }; setQ(v) }
  const hits = q.trim() ? searchSettings(q, ctx) : null
  // The account card: who this is, and the one line that matters about it.
  const acct = DEMO ? { title: t('Demo'), sub: t('Example data, only in this browser.') }
    : user ? {
      title: user.name || t('Account'),
      //// Neoffice — no devices to manage here: the account and its sync.
      sub: sync && sync.status && sync.status !== 'ok' ? t('Sync needs a look') : MOBILE ? t('Synced with your server') : t('Account and sync'),
    }
    : MOBILE ? { title: t('This phone'), sub: t('All data stays on this phone') }
    : { title: t('Guest'), sub: t('Your data lives on this device. Sign in to sync.') }
  const initial = user && !DEMO ? String(user.name || '?').trim().charAt(0).toUpperCase() : null
  const nav = useNavigate()
  // Only while the server offers the Coach (the flag every Coach screen reads): on a box without
  // it the admin dashboard has no Coach card to land on.
  const config = useStore(s => s.config)
  const adminCoach = !MOBILE && !DEMO && !!user?.admin && coachAvailable(config, user)
  return <div className="narrow">
    <div className="sp-nav">
      <button className="sp-back" data-back="/home" onClick={home} aria-label={t('Home')}><Icon name="chevronLeft" /><span>{t('Home')}</span></button>
    </div>
    <h1 className="sp-root-title">{t('Settings')}</h1>
    <div className="sp-search">
      <SearchField value={q} onChange={e => set(e.target.value)} onClear={() => set('')}
        placeholder={t('Search…')} aria-label={t('Search settings')} inputMode="search" enterKeyHint="search" autoComplete="off" />
    </div>
    {hits ? (hits.length ? <Section title={tn('{0} result', '{0} results', hits.length)}>
      {hits.slice(0, 40).map(h => (
        <Row key={h.page + ':' + h.title} icon={h.icon} iconTint={h.tint} title={h.label} subtitle={h.trail} accessory="chevron" onClick={() => go(h)} />
      ))}
    </Section> : <div className="sp-empty">{t('No setting matches “{0}”.', q.trim())}</div>) : <>
      <Section>
        <button className="lrow tap sp-acct" onClick={() => open('account')}>
          <span className={'sp-avatar' + (initial ? ' on' : '')} aria-hidden="true">{initial || <Icon name="personCircle" />}</span>
          <span className="lrow-m"><span className="lrow-t">{acct.title}</span><span className="lrow-s">{acct.sub}</span></span>
          <Icon name="chevronRight" className="lrow-c" />
        </button>
      </Section>
      {/* //// Neoffice — what the member bought from their club, and who follows them: they come here for
          that as much as for their settings ("how much do I have left", "when is my next class"). Each
          block shows only when there is something in it. */}
      <MyClub />
      <MyCoach />
      {ROOT_GROUPS.map(g => g.filter(id => pageVisible(id, ctx))).filter(g => g.length).map(g => (
        <Section key={g[0]}>
          {g.map(id => <Row key={id} icon={PAGES[id].icon} iconTint={PAGES[id].tint} title={t(PAGES[id].title)}
            value={preview[id]?.() || null} accessory="chevron" onClick={() => open(id)} className="sp-root-row" />)}
          {/* The phone app sets up its own Coach on the Coach page beside Look; in a hosted app the
              Coach is the server's, set up by an admin on the admin dashboard. Its admins get the
              same row, in the same place, straight to that card; nobody else has anything to set. */}
          {g[0] === 'look' && adminCoach && <Row icon={PAGES.coach.icon} iconTint={PAGES.coach.tint} title={t(PAGES.coach.title)}
            value={t('Admin')} accessory="chevron" onClick={() => nav('/admin', { state: { section: 'coach' } })} className="sp-root-row" />}
        </Section>
      ))}
      <div className="dim small sp-version">openGym v{__APP_VERSION__}</div>
    </>}
  </div>
}

// The whole point is that the two scales are one judgement counted from opposite ends, and a
// paragraph is a bad way to say that — the conversion table shows it in one look. Reading down
// a column is the answer to "what do I put here", so the numbers get their own aligned columns.
const EFFORT_ROWS = [
  ['0', '10', 'Nothing left, went to failure'],
  ['1', '9', 'One more rep in the tank'],
  ['2', '8', 'Two more reps'],
  ['3', '7', 'Three more reps'],
  ['4+', '≤6', 'Easy, warm-up territory'],
]
// RIR 2 / RPE 8: the row a working set usually lands on — the anchor the others are read
// against. Not where the stepper starts; + walks up from the bottom of the scale.
const EFFORT_TYPICAL = 2


// Download progress sheet — receives a ref callback that exposes a (received, total) setter.
// Uses forwardRef so the caller can push byte counts in without re-rendering the whole Settings tree.
const DownloadProgress = forwardRef(function DownloadProgress(_, ref) {
  const [pct, setPct] = useState(0)
  const [text, setText] = useState(t('Starting download…'))
  // Expose a setter the caller can invoke directly
  if (ref) ref(function update(received, total) {
    if (total > 0) {
      const p = Math.min(100, Math.round((received / total) * 100))
      setPct(p)
      setText(t('{0} %', p))
    } else {
      setText(t('{0} MB', (received / 1_000_000).toFixed(1)))
    }
  })
  return (
    <div style={{ textAlign: 'center', padding: '8px 0' }}>
      <h3>{t('Downloading update…')}</h3>
      <div style={{ margin: '16px 0', height: 6, borderRadius: 3, background: 'var(--fill-3)', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: pct + '%', background: 'var(--acc)', borderRadius: 3, transition: 'width .2s' }} />
      </div>
      <div className="muted small">{text}</div>
    </div>
  )
})

// Settings → Sound (#306): every end-of-rest sound, each played as it is picked so you hear it
// before the next rest does. The sheet stays open for the next one; Done closes it. Stored as
// S.restSound, with S.classicChime kept for an app from before (lib/rest-sounds.js restSoundOf).
const REST_SOUND_LABEL = { chime: 'Chime (louder)', classic: 'Classic beeps', bell: 'Bell', beep: 'Beep-beep', whistle: 'Whistle', soft: 'Soft' }
const REST_SOUND_HINT = {
  classic: 'The quieter three-beep sound from before 1.3.9, instead of the louder chime.',
  bell: 'Ding-dong. Rest is over, class is in.',
  beep: 'Your sports watch, calling you back.',
  whistle: 'Coach wants you back on the bar.',
  soft: 'Gentle, for headphones or a quiet room.',
}
export function pickRestSound(id) {
  unlock(true)
  useStore.getState().update(s => { s.restSound = id; s.classicChime = id === 'classic' })
  chime(true, id)
}
export function RestSoundSheet({ close }) {
  const S = useStore(s => s.S)
  const cur = restSoundOf(S)
  return <>
    <h3>{t('Sound')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>{t('Tap one to hear it.')}</div>
    <Section>
      {REST_SOUND_IDS.map(id => <Row key={id} icon={id === cur ? 'speaker' : 'play'} iconTint="var(--pink)" title={t(REST_SOUND_LABEL[id])}
        subtitle={REST_SOUND_HINT[id] ? t(REST_SOUND_HINT[id]) : null} accessory={id === cur ? 'check' : 'none'}
        onClick={() => pickRestSound(id)} />)}
    </Section>
    <div style={{ height: 14 }} />
    <Button variant="primary" onClick={close}>{t('Done')}</Button>
  </>
}
const restSoundSheet = () => useUI.getState().openSheet(close => <RestSoundSheet close={close} />)

function effortHelpSheet() {
  useUI.getState().openSheet(close => <>
    <h3>{t('Effort per set')}</h3>
    <div className="muted small" style={{ lineHeight: 1.5 }}>
      {t('How hard a set was, logged next to weight and reps. Two scales for the same judgement, counted from opposite ends.')}
    </div>
    <div className="efftbl">
      <div className="r hd"><span className="n">{t('RIR')}</span><span className="n">{t('RPE')}</span><span className="f">{t('How it felt')}</span></div>
      {EFFORT_ROWS.map(([rir, rpe, feel], i) => (
        <div key={rir} className={'r' + (i === EFFORT_TYPICAL ? ' on' : '')}>
          <span className="n">{rir}</span><span className="n">{rpe}</span><span className="f">{t(feel)}</span>
        </div>
      ))}
    </div>
    <div className="dim small" style={{ lineHeight: 1.5, display: 'grid', gap: 8 }}>
      <div>{t('RIR counts the reps you left in the tank; RPE reads the same effort off a 10-point scale, so RPE ≈ 10 − RIR. Pick whichever you already think in.')}</div>
      <div>{t('The highlighted row is where most working sets land. Sets you have already logged keep their own scale, and nothing else reads the value, so progression and estimated 1RM are unaffected.')}</div>
    </div>
    <div style={{ height: 8 }} />
  </>)
}

function NotificationsCard({ S, update, toast }) {
  if (MOBILE) return <MobileReminderCard S={S} update={update} toast={toast} />
  return <PushCard S={S} update={update} toast={toast} />
}

// Mobile build: the reminder is a native local notification scheduled on planned weekdays —
// no push server involved. The schedule itself is (re)synced by the store on every persist;
// this card only owns the OS permission prompt when the switch turns on.
function MobileReminderCard({ S, update, toast }) {
  // A paired phone checks with the server before a nudge (lib/nudge-check.js); the footer says
  // so, and that the phone decides when.
  const paired = useStore(s => !!s.user)
  const setReminder = patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })
  const toggle = async () => {
    const on = !S.reminder?.on
    if (on) {
      const ok = await syncReminder({ ...S, reminder: { ...(S.reminder || DEF.reminder), on: true } }, true)
      if (!ok) { toast(t('Could not change notification settings')); return }
    }
    setReminder({ on })
  }
  return (
    <Section title={t('Notifications')}
      footer={S.reminder?.on ? t('Reminds you at this time on days that have a routine planned.') + nudgeNote(S) + (paired && S.reminder?.nudge ? ' ' + t('Logged a workout on another device? Before the nudge goes out, the phone checks with your server whenever it lets the app run in the background. Opening the app always catches up.') : '') : null}>
      <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
        <Switch checked={!!S.reminder?.on} onChange={toggle} aria-label={t('Workout day reminder')} />
      </Row>
      {S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => setReminder({ time: e.target.value })} />
        </Row>
      )}
      {S.reminder?.on && <NudgeRows S={S} setReminder={setReminder} />}
    </Section>
  )
}

// The missed-workout nudge (lib/nudge.js): a switch and its tone, under the reminder they ride
// on — the server sends it with the same push (or the phone schedules it beside the reminder).
function NudgeRows({ S, setReminder }) {
  const r = S.reminder || {}
  //// Neoffice — a club that switched the relance off offers no switch and no tone (S.perms.nudge.enabled === false; lib/nudge.js).
  if (!nudgeAllowed(S)) return null
  return <>
    <Row icon="bell" iconTint="var(--red)" title={t('Nudge me when I skip a planned workout')}>
      <Switch checked={!!r.nudge} onChange={() => setReminder({ nudge: !r.nudge })} aria-label={t('Nudge me when I skip a planned workout')} />
    </Row>
    {r.nudge && (
      <SelectRow icon="chat" iconTint="var(--blue)" title={t('Nudge tone')}
        value={toneOf(r)} onChange={v => setReminder({ tone: v })}
        options={NUDGE_TONES.map(k => ({ value: k, label: toneLabel(k), subtitle: t(NUDGE_COPY[k].title) }))} />
    )}
  </>
}
const toneLabel = k => k === 'guilt' ? t('Guilt trip') : k === 'drill' ? t('Drill sergeant') : t('Friendly')
//// Neoffice — upstream's sentence is only true of upstream's rule (3 missed days, then quiet): a club that set its own count (S.perms.nudge) says its
//// own thing at the desk, and the sentence is left out rather than untrue.
const nudgeNote = S => S.reminder?.nudge && !S.perms?.nudge
  ? ' ' + t('One nudge in the evening of a planned day with nothing logged, between 20:00 and 21:30. After 3 missed days in a row it goes quiet until your next workout.')
  : ''

function PushCard({ S, update, toast }) {
  const [on, setOn] = useState(false)
  const [busy, setBusy] = useState(false)
  const supported = pushSupported()

  // "On" means the server holds this browser's subscription, not merely that the browser has
  // one: a row the instance dropped (dead send, rebuilt db.json) left the switch on with nothing
  // ever arriving. syncPushSubscription re-registers on the way; if the server cannot be asked
  // (offline), the browser's side is the best answer available. A server that refused this
  // browser's subscription, even a fresh one, has answered: the switch is off, with its reason.
  useEffect(() => {
    if (!supported) return
    let gone = false
    syncPushSubscription()
      .then(ok => { if (!gone) setOn(ok) })
      .catch(e => {
        if (e?.refused) { if (!gone) { setOn(false); toast(e.message) } return }
        return navigator.serviceWorker.ready.then(reg => reg.pushManager.getSubscription()).then(sub => { if (!gone) setOn(!!sub) }).catch(() => {})
      })
    return () => { gone = true }
  }, [supported])

  const toggle = async v => {
    setBusy(true)
    try {
      if (!v) { await disablePush(); setOn(false); toast(t('Notifications off')) }
      else { await enablePush(); setOn(true); toast(t('Notifications on')) }
    } catch (e) { toast(e.message || t('Could not change notification settings')) }
    setBusy(false)
  }
  const test = async () => {
    try { await sendTestPush(); toast(t('Test sent! Should pop up any second')) }
    catch (e) { toast(e.message || t('Test failed')) }
  }

  if (!supported) return (
    <Section title={t('Notifications')}>
      <Row icon="bellSlash" iconTint="var(--grey)" title={t('Not supported in this browser.')} />
    </Section>
  )

  return <>
    <Section
      title={t('Notifications')}
      footer={on && S.reminder?.on
        ? t("Only sent on days you have a routine planned and haven't logged a workout yet.") +
          (S.reminder?.tz ? ' ' + t('Timezone: {0} (auto-detected, updates if you travel).', S.reminder.tz) : '') +
          nudgeNote(S)
        : null}
    >
      {/* //// Neoffice — the club's server sends the reminders below (neoffice_gym api/push.py), not the
          rest timer's alert: the journal keeps the screen awake for a workout instead. */}
      <Row icon="bell" iconTint="var(--red)" title={t('Push notifications')} subtitle={t('Your workout reminders, even when the journal is closed.')}>
        <Switch checked={on} disabled={busy} onChange={toggle} />
      </Row>
      {on && (
        <Row icon="calendar" iconTint="var(--orange)" title={t('Workout day reminder')}>
          <Switch checked={!!S.reminder?.on} onChange={() => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), on: !s.reminder?.on, tz: localTZ() } })} />
        </Row>
      )}
      {on && S.reminder?.on && (
        <Row icon="clock" iconTint="var(--purple)" title={t('Reminder time')}>
          <input type="time" className="timef" value={S.reminder?.time || DEF.reminder.time}
            onChange={e => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), time: e.target.value, tz: localTZ() } })} />
        </Row>
      )}
      {on && S.reminder?.on && (
        <NudgeRows S={S} setReminder={patch => update(s => { s.reminder = { ...(s.reminder || DEF.reminder), ...patch, tz: localTZ() } })} />
      )}
    </Section>
    {on && <div style={{ marginTop: -12, marginBottom: 22 }}><Button size="sm" icon="bell" onClick={test}>{t('Send test notification')}</Button></div>}
  </>
}

// Equipment profiles ("Home", "Gym", ...) — each an id/name/eq-list; the active one filters
// the Library, exercise picker, and flags routine entries that need something outside it
// (see lib/equipment.js). Purely local/synced state — no server changes needed.
// What the chosen accent is called: a preset's colour name, or the user's own.
// The theme showing right now, by name, for the row that opens them.
function activeSeasonTitle(S) {
  const id = activeSeason(S)
  const th = id && THEMES.find(x => x.id === id)
  return th ? t(th.title) : null
}

function accentLabel(S) {
  const k = accentKey(S)
  if (k === CLUB) return clubSwatchLabel(S)
  return k === CUSTOM ? t('Your own color') : t(ACCENT_NAMES[k] || 'Green')
}
//// Neoffice — what the club's swatch is called: the club's name, as the server gives it.
const clubSwatchLabel = S => t('Colour of {0}', S?.club?.name || (typeof window !== 'undefined' && window.gym_boot?.app_title) || '')

/**
 * The presets, then one swatch for a colour of the user's own (lib/accent.js). With no colour
 * of their own yet it is a rainbow ring, and a tap opens the system colour picker straight away.
 * Once there is one it is filled with it: a tap picks it again (it is kept while a preset is
 * chosen), and a tap on it while it is the accent opens the picker to change it. The picker is
 * the native <input type="color"> laid over the swatch, so the tap that opens it is the user's
 * own, which iOS Safari and the Android WebView both want.
 */
// How long the colour picker has to rest before a colour is saved, when the browser sends no
// `change` at the end (it should, once the picker closes).
const OWN_COLOR_SETTLE_MS = 400

function AccentSwatches({ S, update }) {
  const key = accentKey(S)
  const own = cleanHex(S.accentCustom)
  const onCustom = key === CUSTOM
  const pickPreset = k => { update(s => { s.accent = k }); setRestAccent(k) }
  //// Neoffice — the club's own swatch (lib/accent.js CLUB): it follows the club, so what is stored is the choice, not the colour.
  const club = clubAccent(S)
  const pickClub = () => { update(s => { s.accent = CLUB }); setRestAccent(club) }
  const pickOwn = hex => {
    const c = cleanHex(hex)
    if (!c || (onCustom && c === own)) return
    update(s => { s.accent = CUSTOM; s.accentCustom = c })
    setRestAccent(c)
  }
  // The picker sends a colour for every step of a drag (React's onChange is the `input` event).
  // Those only repaint the page; the colour is saved, synced and sent to the native countdown
  // once: on the picker's `change`, after it has rested a moment, or when Settings closes.
  const inputRef = useRef(null)
  const pending = useRef(null)
  const timer = useRef(0)
  const pickOwnRef = useRef(pickOwn)
  pickOwnRef.current = pickOwn
  const commit = () => {
    clearTimeout(timer.current)
    const c = pending.current
    pending.current = null
    if (c) pickOwnRef.current(c)
  }
  const preview = hex => {
    const c = cleanHex(hex)
    if (!c) return
    const de = document.documentElement
    applyAccent(de, c, de.dataset.theme)
    pending.current = c
    clearTimeout(timer.current)
    timer.current = setTimeout(commit, OWN_COLOR_SETTLE_MS)
  }
  const hasInput = !(own && !onCustom)
  useEffect(() => {
    const el = inputRef.current
    if (!el) return
    const onChange = () => { pending.current = cleanHex(el.value) || pending.current; commit() }
    el.addEventListener('change', onChange)
    return () => el.removeEventListener('change', onChange)
  }, [hasInput]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => commit, []) // eslint-disable-line react-hooks/exhaustive-deps
  // The input is not controlled (React would put the saved colour back after every drag step);
  // a colour changed elsewhere (sync, another tab) is put in by hand.
  useEffect(() => {
    if (!pending.current && inputRef.current) inputRef.current.value = own || '#30d158'
  }, [own])
  const ownLabel = t('Your own color')
  const grey = own && isGrey(own)
  const notes = own && onCustom ? [
    adjustedIn(own, 'dark') && (grey ? t('Greys show lighter in dark mode, so buttons don’t look switched off.') : t('A touch lighter in dark mode, so you can still read it.')),
    adjustedIn(own, 'light') && (grey ? t('Greys show darker in light mode, so buttons don’t look switched off.') : t('A touch darker in light mode, so you can still read it.')),
  ].filter(Boolean) : []
  return <>
    <div className="swatches" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>
      {club && <button className={'swatch' + (key === CLUB ? ' on' : '')}
        style={{ background: club }} onClick={pickClub} aria-label={clubSwatchLabel(S)} title={clubSwatchLabel(S)} />}
      {Object.entries(ACCENTS).map(([k, c]) => (
        <button key={k} className={'swatch' + (key === k ? ' on' : '')}
          style={{ background: c }} onClick={() => pickPreset(k)} aria-label={t(ACCENT_NAMES[k] || k)} />
      ))}
      {!hasInput
        ? <button className="swatch swatch-own" style={{ background: own }} onClick={() => pickOwn(own)} aria-label={ownLabel} />
        : <span className={'swatch swatch-own' + (own ? ' on' : ' unset')} style={own ? { background: own, color: inkOn(own) } : undefined}>
          {own ? <Icon name="pencil" /> : <Icon name="plus" />}
          <input ref={inputRef} type="color" className="swatch-input" defaultValue={own || '#30d158'}
            onChange={e => preview(e.target.value)}
            aria-label={own ? t('Change your own color') : t('Pick your own color')} />
        </span>}
    </div>
    {notes.map(n => <span key={n} className="lrow-s swatch-note" style={{ flexBasis: '100%', paddingInlineStart: 41 }}>{n}</span>)}
  </>
}

function EquipmentCard({ S, update }) {
  const profiles = S.equipProfiles || []
  //// Neoffice — hidden at the simple level, unless this member already has a profile: the whole
  //// section only makes sense once you own equipment you want to filter by, and a beginner training at
  //// the club owns the club's. A member who HAS profiles keeps it — hiding it would silently leave a
  //// filter active with no way to turn it off. (pageVisible hides the page with it.)
  if (!showsEquipmentProfiles(S)) return null
  const remove = p => confirmSheet({
    title: t('Delete profile?'), message: t('"{0}" and its equipment list will be removed.', p.name),
    confirmText: t('Delete'), danger: true,
    onConfirm: () => update(s => {
      s.equipProfiles = (s.equipProfiles || []).filter(x => x.id !== p.id)
      if (s.activeEquipId === p.id) s.activeEquipId = (s.equipProfiles[0] && s.equipProfiles[0].id) || null
    }),
  })
  // The plates you own, per unit (lib/plates.js) — what the set rows' plate lines load from.
  const plateSummary = ownsPlates(S)
    ? inventoryFor(S).map(p => fmtPlate(p.w) + '×' + p.n).join(' · ') || t('None')
    : t('Standard set. Tap to count the pairs you own.')
  // The dumbbells you own, per unit (lib/dumbbells.js): what dumbbell lifts step and progress over.
  const bells = dumbbellsOf(S)
  const dumbbellSummary = ownsNoDumbbells(S) ? t('None, so dumbbell lifts stay hidden.')
    : bells.length ? bells.map(fmtPlate).join(' · ')
      : t('Any weight. Tap to list the ones you own.')
  // Your bars (lib/bar.js ownBarDefault): the types you set a weight for, in the profile unit.
  const unit = S.unit === 'lb' ? 'lb' : 'kg'
  const ownBars = BAR_TYPES.filter(eq => ownBarDefault(S, eq) !== null)
  const barSummary = ownBars.length
    ? ownBars.map(eq => { const n = t(eq); return n.charAt(0).toLocaleUpperCase() + n.slice(1) + ' ' + fmtPlate(ownBarDefault(S, eq)) + ' ' + unit }).join(' · ')
    : t('Standard bars. Tap if yours are lighter.')
  return <Section title={t('Equipment')} footer={t('Filters the exercise library and picker, and flags routine exercises that need something you don’t have in the active profile.')}>
    <Row icon="plate" iconTint="var(--orange)" title={t('Plates')} subtitle={plateSummary} accessory="chevron" onClick={() => plateInventorySheet()} />
    <Row icon="dumbbell" iconTint="var(--teal)" title={t('Dumbbells')} subtitle={dumbbellSummary} accessory="chevron" onClick={() => dumbbellInventorySheet()} />
    <Row icon="barbell" iconTint="var(--blue)" title={t('Your bars')} subtitle={barSummary} accessory="chevron" onClick={() => barDefaultsSheet()} />
    {profiles.length > 0 && <Row icon="kettlebell" iconTint="var(--acc)" title={t('Filter by equipment')}>
      <Switch checked={!!S.equipFilterOn} onChange={v => update(s => { s.equipFilterOn = v })} />
    </Row>}
    {profiles.length > 0 && <SelectRow icon="house" iconTint="var(--blue)" title={t('Active profile')}
      value={S.activeEquipId || ''} onChange={v => update(s => { s.activeEquipId = v })}
      options={profiles.map(p => ({ value: p.id, label: p.name }))} />}
    {profiles.map(p => (
      <Row key={p.id} icon="house" iconTint="var(--teal)" title={p.name}
        subtitle={t('{0} equipment types', p.equipment.length)} accessory="chevron"
        onClick={() => equipmentProfileSheet(p)}>
        <button className="iconbtn" aria-label={t('Delete')} onClick={ev => { ev.stopPropagation(); remove(p) }}><Icon name="trash" /></button>
      </Row>
    ))}
    <Row icon="plus" iconTint="var(--acc)" title={t('Add equipment profile')} accessory="chevron" onClick={() => equipmentProfileSheet(null)} />
  </Section>
}

//// Neoffice — upstream's MediaRow, AccountIdRow, PairSheet and RegisterInline are not here: no photos
//// or videos on the club's server, no account id to hand an admin (the club manages its members), no
//// mobile app to pair with a second server, no profile to register (a member exists because the club
//// created them).

//// Neoffice — added: who follows this member, and how to write to them. The conversation lives in
//// the journal (views/CoachThread.jsx). It used to send the member OUT, into the team messenger —
//// which let them list every person on the instance, and showed them the club's desk menu.
function MyCoach() {
  const nav = useNavigate()
  const [coach, setCoach] = useState(null)
  useEffect(() => {
    let alive = true
    myCoach()
      .then(r => { if (alive) setCoach(r.coach) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  if (!coach) return null

  return <Section title={t('Your coach')}>
    <Row icon="personCircle" iconTint="var(--acc)" title={coach.name}
      subtitle={coach.reachable ? t('Follows your training') : t('Follows your training — no account for messages')} />
    {coach.reachable && <Row icon="bell" iconTint="var(--acc)" title={t('Write to your coach')}
      subtitle={t('Ask a question without leaving the logbook')} accessory="chevron"
      onClick={() => nav('/coach-thread')} />}
  </Section>
}

//// Neoffice — added: the "club" half of the account. The balance first, the coming classes after:
//// the first answers "can I still book", the second "what have I got planned". The whole block
//// disappears when there is neither a pass nor a class — a member whose club runs no classes should
//// not have to read an empty section.
function MyClub() {
  const [bal, setBal] = useState(null)
  const [next, setNext] = useState([])
  const [money, setMoney] = useState(null)
  const S = useStore(s => s.S)
  //// Neoffice — MyClub is ours: the classes pack, the next classes and the membership from the club's server.
  const nav = useNavigate()

  useEffect(() => {
    if (MOBILE || DEMO) return
    let alive = true
    wallet().then(r => { if (alive) setBal(r) }).catch(() => {})
    if (S.perms?.classes !== false) {
      classesMine().then(l => { if (alive) setNext(Array.isArray(l) ? l.slice(0, 3) : []) }).catch(() => {})
    }
    // The cached rights say whether to DRAW the row (they work offline); the server says whether the
    // club still shows the screen at all, and what is owed. The rights ride on the member's own state,
    // whose revision only moves when THEIR records change — a club that unticks the setting would
    // otherwise keep the door open on every phone until the member trains.
    if (S.perms?.membership !== false) {
      myMembership().then(r => { if (alive) setMoney(r || {}) }).catch(() => {})
    }
    return () => { alive = false }
  }, [S.perms && S.perms.classes, S.perms && S.perms.membership])

  //// Neoffice — the rows the club answers for (classes pack, membership) or none.
  const hasPack = bal && bal.available && bal.sessionsLeft > 0
  // What the club answers in the app about money. Off means the club bills at the desk: no door
  // rather than a screen that says so.
  const showMembership = !MOBILE && !DEMO && S.perms?.membership !== false && money?.shown !== false
  if (!hasPack && !next.length && !showMembership) return null

  //// Neoffice — the club's section, after upstream's Account.
  return <Section title={t('Your club')}>
    {showMembership && <Row icon="key" iconTint="var(--acc)" title={t('My membership')}
      subtitle={money && money.due > 0
        ? (money.overdue > 0
          ? t('{0} overdue', money.overdue.toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (money.currency ? ' ' + money.currency : ''))
          : t('{0} to pay', money.due.toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + (money.currency ? ' ' + money.currency : '')))
        : t('Your plan, your invoices and what is owed')}
      accessory="chevron" onClick={() => nav('/membership')} />}
    {hasPack && <Row icon="trophy" iconTint="var(--acc)"
      title={tn('{0} class left', '{0} classes left', bal.sessionsLeft)}
      subtitle={bal.expiresOn ? t('valid until {0}', bal.expiresOn) : null} />}
    {next.map(c => <Row key={c.id} icon="calendar" iconTint="var(--blue)"
      title={c.title}
      subtitle={c.start ? new Date(c.start).toLocaleString(dateLocale(), {
        weekday: 'long', day: 'numeric', month: 'long', hour: '2-digit', minute: '2-digit',
      }) : null}
      accessory="chevron" onClick={() => nav('/classes')} />)}
  </Section>
}

// Android app: writing finished workouts and weigh-ins to Health Connect (#200), the phone's
// own store for health data, where other apps can read them. A fact about this phone, kept in
// its own file (lib/health-sync.js) and not in S, so it never switches on anywhere else. The card
// stays out of the way on a phone without Health Connect, and only points to installing it on
// Android 13 and lower, where it is an app of its own. The iPhone app's card is the same switch for
// Apple Health, which the Apple Watch app also goes by (heart rate per set).
const HEALTH_COPY = {
  android: () => ({
    section: t('Health Connect'), write: t('Write to Health Connect'), open: t('Open Health Connect'),
    footer: t('Workouts and weigh-ins go to Health Connect when you finish or change them.'),
    on: t('Writing to Health Connect'), denied: t('Health Connect permission not granted'), failed: t('Could not write to Health Connect'),
    removeFailed: t('Could not remove it from Health Connect'), stop: t('Stop writing to Health Connect?'),
    stopSub: t('What openGym already wrote can stay in Health Connect as your data, or be removed from it.'),
  }),
  ios: () => ({
    section: t('Apple Health'), write: t('Write to Apple Health'), open: t('Open Apple Health'),
    footer: t('Workouts and weigh-ins go to Apple Health when you finish or change them.'),
    on: t('Writing to Apple Health'), denied: t('Apple Health permission not granted'), failed: t('Could not write to Apple Health'),
    removeFailed: t('Could not remove it from Apple Health'), stop: t('Stop writing to Apple Health?'),
    stopSub: t('What openGym already wrote can stay in Apple Health as your data, or be removed from it.'),
  }),
}

function HealthConnectCard({ S, toast, android }) {
  const getState = () => useStore.getState().S
  const [st, setSt] = useState(null)
  const [h, setH] = useState(null)
  const [busy, setBusy] = useState(false)
  useEffect(() => {
    let gone = false
    Promise.all([healthStatus(), loadHealth()]).then(([s, f]) => { if (!gone) { setSt(s); setH(f) } }).catch(() => {})
    const off = onHealthChange(f => { if (!gone) setH(f) })
    return () => { gone = true; off() }
  }, [])
  const ios = st?.platform === 'ios'
  if (!st || !h || st.status === 'unsupported' || (!android && !ios)) return null
  const c = HEALTH_COPY[ios ? 'ios' : 'android']()

  if (st.status !== 'available') return (
    <Section title={t('Health Connect')}>
      <Row icon="heart" iconTint="var(--red)" title={t('Health Connect')}
        subtitle={st.status === 'update'
          ? t('Update Health Connect to share workouts and weigh-ins with other apps.')
          : t('Install Health Connect to share workouts and weigh-ins with other apps.')}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />
    </Section>
  )

  const turnOn = async () => {
    setBusy(true)
    try {
      const r = await enableHealth(S)
      if (r.health) setH(r.health)
      else setH(await loadHealth())
      if (r.ok) toast(c.on)
      else toast(r.reason === 'denied' ? c.denied : c.failed)
    } catch { toast(c.failed) }
    setBusy(false)
  }
  const turnOff = removeWritten => async () => {
    setBusy(true)
    try { setH(await disableHealth({ removeWritten })) }
    catch { toast(c.removeFailed) }
    setBusy(false)
  }
  // Reading back (v1.4.3): heart rate during workouts and weigh-ins from other apps, each its own
  // switch and its own permission. Turning one off keeps what it already brought in.
  const toggleRead = kind => async v => {
    setBusy(true)
    try {
      if (v) {
        const r = await enableRead(kind, getState)
        setH(r.health || await loadHealth())
        if (!r.ok) toast(r.reason === 'denied' ? c.denied : c.failed)
      } else setH(await disableRead(kind))
    } catch { toast(c.failed) }
    setBusy(false)
  }
  const reading = h.readHr || h.readWeight

  // Off can mean two things for what is already there, so it asks; closing the sheet keeps it on.
  const askOff = () => menuSheet({
    title: c.stop,
    subtitle: c.stopSub,
    items: [
      { icon: 'check', label: t('Stop, keep what it wrote'), onClick: turnOff(false) },
      { icon: 'trash', label: t('Stop and remove what it wrote'), danger: true, onClick: turnOff(true) },
    ],
  })

  return (
    <Section title={c.section}
      footer={[h.on && c.footer, reading && (h.readWeight && h.wHistory ? t('openGym reads only while it is open: heart rate for workouts of the last day, weigh-ins of the last year. Older workouts stay as they are.') : t('openGym reads only while it is open: heart rate for workouts of the last day, weigh-ins of the last 30 days. Older workouts stay as they are.'))].filter(Boolean).join(' ') || null}>
      <Row icon="heart" iconTint="var(--red)" title={c.write}
        subtitle={t('Finished workouts and weigh-ins, from this phone only.')}>
        <Switch checked={!!h.on} disabled={busy} onChange={v => (v ? turnOn() : askOff())} />
      </Row>
      {h.on && h.error === 'permission' && <Row icon="warning" iconTint="var(--orange)"
        title={t('Permission withdrawn. Tap to allow again')} accessory="chevron" onClick={turnOn} />}
      <Row icon="heart" iconTint="var(--red)" title={t('Heart rate from your watch')}
        subtitle={t('After a workout, each set gets the heart rate your watch saved. Garmin, Fitbit, Galaxy Watch and friends welcome.')}>
        <Switch checked={!!h.readHr} disabled={busy} onChange={toggleRead('hr')} />
      </Row>
      <Row icon="scale" iconTint="var(--teal)" title={t('Weigh-ins from other apps')}
        subtitle={t('Your smart scale’s weigh-ins land here. One you type in yourself always wins.')}>
        <Switch checked={!!h.readWeight} disabled={busy} onChange={toggleRead('weight')} />
      </Row>
      {reading && h.readError === 'permission' && <Row icon="warning" iconTint="var(--orange)"
        title={t('Permission withdrawn. Tap to allow again')} accessory="chevron"
        onClick={() => toggleRead(h.readHr ? 'hr' : 'weight')(true)} />}
      {(h.on || reading) && <Row icon="list" iconTint="var(--blue)" title={c.open}
        accessory="chevron" onClick={() => openHealthConnect().catch(() => {})} />}
    </Section>
  )
}
