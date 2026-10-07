import { useEffect, useLayoutEffect, useRef } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation, useNavigationType } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { setWeightDecimals } from './lib/format.js'
import { accentValue, applyAccent } from './lib/accent.js'
import { setLang, useLang, baseLang } from './lib/i18n.js'
import { effectiveLang } from './lib/default-lang.js'
import { setPlayOnSilent, setVibrate, setAlarmBuzzer } from './lib/sound.js'
import { buzzAsAlarm } from './lib/rest-alert.js'
import { setNav } from './lib/nav.js'
import { setSystemBarsLight } from './lib/system-bars.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { installViewportGuard } from './lib/viewport-guard.js'
import { installChipDrag } from './lib/hchips.js'
import { syncPushSubscription } from './lib/push.js'
import { MOBILE } from './lib/mobile.js'
import { exitWorkoutEdit, startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import SignIn from './views/SignIn.jsx'
import MembershipGate from './views/MembershipGate.jsx'
import { BOOT } from './lib/api.js'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import SyncBanner from './components/SyncBanner.jsx'
import RestTimer from './components/RestTimer.jsx'
import TimerFlash from './components/TimerFlash.jsx'
import PrepCountdown from './components/PrepCountdown.jsx'
//// Neoffice — upstream's Login.jsx (passkeys) is not shipped here: the
//// journal is served from Frappe and the Frappe session IS the login
//// (see views/SignIn.jsx and commit 2a97a09b). Upstream's import came
//// back with the merge and points at a file we do not have.
import MobileOnboarding from './views/MobileOnboarding.jsx'
import Home from './views/Home.jsx'
import CheckIn from './views/CheckIn.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
//// Neoffice — group classes, when the club offers them.
import Classes from './views/Classes.jsx'
import Challenges from './views/Challenges.jsx'
//// Neoffice — the coach's physical assessments.
import Assessments from './views/Assessments.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Muscles from './views/Muscles.jsx'
import StructuralBalance from './views/StructuralBalance.jsx'
//// Neoffice — Settings through upstream's route (/settings and /settings/:page, v1.3.10).
import { SettingsRoute } from './views/Settings.jsx'
//// Neoffice — added screen: the member's own membership and invoices.
import Membership from './views/Membership.jsx'
//// Neoffice — the conversation with the coach, in the journal itself.
import CoachThread from './views/CoachThread.jsx'
//// Neoffice — no Admin.jsx: the club manages members in the Frappe desk (see the /admin note below).
//// No ProgressPhotos (upstream v1.3.10): progress photos are not part of the club's journal (Jérémy, 07.10).
import CoachChat from './views/CoachChat.jsx'
import CoachIntake from './views/CoachIntake.jsx'
import CoachSetup from './views/CoachSetup.jsx'

// last known scrollY per route, so back-navigation can put the page where it was
const scrollPositions = new Map()

//// Neoffice — the screens that are a conversation: full height, their own
//// title bar with a way back, and a composer fixed to the bottom. They hide
//// the tab bar rather than share the bottom of the screen with it.
const CONVERSATIONS = new Set(['/coach', '/coach-thread'])

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

// theme === 'system' follows the OS/browser preference instead of a fixed choice.
const resolveTheme = theme => theme === 'light' || theme === 'dark'
  ? theme
  : (window.matchMedia?.('(prefers-color-scheme: dark)').matches ? 'dark' : 'light')

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = resolveTheme(theme)
  applyAccent(de, accent, de.dataset.theme)
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
  if (MOBILE) setSystemBarsLight(de.dataset.theme === 'light')
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const navType = useNavigationType()
  const { S, user, ready } = useStore()
  // iOS: whether timer sounds get past the ring/silent switch (Settings → Sounds). Page-level,
  // so it is applied here on load and on change rather than at each beep.
  useEffect(() => { setPlayOnSilent(!!S.soundOnSilent) }, [S.soundOnSilent])
  // Settings → Vibrate, the same way: one page-level switch rather than a check at each buzz.
  useEffect(() => { setVibrate(S.vibrate !== false) }, [S.vibrate])
  // Android app: "Vibrate when the phone is on silent" sends the end-of-rest buzz through the
  // native side as an alarm (#375). buzzAsAlarm answers false off Android, so iOS buzzes as before.
  useEffect(() => { setAlarmBuzzer(MOBILE && S.vibrate !== false && S.vibrateOnSilent ? buzzAsAlarm : null) }, [S.vibrate, S.vibrateOnSilent])
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  const lastEditPath = useRef(loc.pathname)
  // Any in-app route exit, browser back included, returns to the persisted draft and asks for a
  // save decision. Reload needs no prompt because the draft itself is already in local storage.
  useEffect(() => {
    const previous = lastEditPath.current
    lastEditPath.current = loc.pathname
    // The live store, not this render's S: a save that just closed the editor may not have
    // reached this render yet, and asking again would offer to delete the workout it saved.
    if (previous !== '/workout' || !useStore.getState().S.active?.editingWorkoutId || loc.pathname === '/workout') return
    const destination = loc.pathname + loc.search
    navigate('/workout', { replace: true })
    exitWorkoutEdit(() => navigate(destination, { replace: true }))
  }, [loc.pathname, loc.search, S.active?.editingWorkoutId, navigate])
  // A preset key, or the user's own colour as '#rrggbb' (lib/accent.js), already checked.
  const accent = accentValue(S)
  useEffect(() => { applyPrefs(S.theme, accent) }, [S.theme, accent])
  // 'system' needs to react live if the OS theme flips while the app is open, not just on
  // the next mount — a fixed 'dark'/'light' choice never re-fires this since matchMedia
  // isn't consulted for those.
  useEffect(() => {
    if (S.theme !== 'system' || !window.matchMedia) return
    const mql = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyPrefs(S.theme, accent)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [S.theme, accent])
  //// Neoffice — `BOOT.lang` before upstream's own fallback (#303: the instance
  //// default, then the browser): before signing in there is NO synced state at
  //// all, and a French-speaking club's sign-in screen used to show up in English.
  //// The server knows the site's language and passes it along in the guest boot.
  //// No `?? true` on the English-names switch: setLang picks the default
  //// (French: names alone, see lib/i18n.js).
  const config = useStore(s => s.config)
  const lang = S.lang || BOOT.lang || effectiveLang(S, config)
  useEffect(() => { setLang(lang, S.enParens?.[baseLang(lang)], S.enOnly?.[baseLang(lang)] === true) }, [lang, S.enParens, S.enOnly])
  // Same shape as the language: a module-level display setting, pushed when it changes (#139).
  useEffect(() => { setWeightDecimals(S.wdec) }, [S.wdec])
  useEffect(() => { document.documentElement.lang = lang }, [langV, lang])
  // Forward navigation starts at the top; going back lands where you left off.
  // The position is recorded from scroll events rather than read at route
  // change, because by then a shorter page may already have clamped it.
  const pathRef = useRef(null)
  // iOS leaves the page displaced after the keyboard goes away (see lib/viewport-guard.js).
  useEffect(() => installViewportGuard(), [])
  // Click-drag a horizontal chip strip to scroll it sideways (lib/hchips.js) — on a desktop
  // browser there's otherwise no way to reach the filters past the edge.
  useEffect(() => installChipDrag(), [])
  // Once per signed-in boot, hand the server this browser's push subscription again (see
  // lib/push.js): a subscription the instance lost is back before the next reminder is due,
  // with nobody having to visit Settings. Web only — the APK has no service worker.
  useEffect(() => {
    if (MOBILE || !user || !ready) return
    syncPushSubscription().catch(() => {})
  }, [user?.id, ready])
  //// Neoffice — upstream's device-link QR code (#95, v1.3.9) is not shipped: on
  //// Neoffice a phone signs in through Frappe (views/SignIn.jsx), there is no
  //// pairing of our own to redeem.
  useEffect(() => {
    const onScroll = () => {
      // Modals pins the body while a sheet is open; scrollY is 0 then, not a position.
      if (document.body.style.position === 'fixed') return
      scrollPositions.set(pathRef.current, window.scrollY)
    }
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])
  useLayoutEffect(() => {
    const samePath = pathRef.current === loc.pathname
    pathRef.current = loc.pathname
    if (navType !== 'POP') { window.scrollTo(0, 0); return }
    // A POP that stays on the route we are on is not a back-navigation: it is the history
    // entry a sheet pushed (Modals.jsx, #63) being unwound as the sheet closes. Nothing new
    // mounted, Modals puts the page back where it was itself, and a view that scrolled on
    // purpose because the sheet closed — the workout list going to the current exercise after
    // ⋯ → Layout → List (#224) — must not be dragged back to a position recorded before that
    // scroll's event had even been dispatched.
    if (samePath) return
    const y = scrollPositions.get(loc.pathname) || 0
    // the restored view needs a layout pass before it is tall enough to scroll to y
    const frame = window.requestAnimationFrame(() => window.scrollTo(0, y))
    return () => window.cancelAnimationFrame(frame)
  }, [loc.pathname, navType])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && !S.active.editingWorkoutId && S.keepAwake !== false)
  // A running workout has the whole screen (v1.3.11): no tab bar, and the rest bar docks to the
  // bottom edge in its place. Its header's ⌄ goes back to the app, where the tab bar's Resume
  // brings it back.
  const inWorkout = loc.pathname === '/workout' && !!S.active
  useEffect(() => {
    document.body.classList.toggle('no-tabbar', inWorkout)
    return () => document.body.classList.remove('no-tabbar')
  }, [inWorkout])
  // The chat owns the bottom of the screen as well: its composer sits where the tabs would be.
  // The first-launch card has no tabs either: they changed the route behind it.
  const noTabs = inWorkout || loc.pathname === '/coach' || needsMobileOnboarding

  //// Neoffice — there IS now an unauthenticated state to render. `/gym` no
  //// longer sends the anonymous visitor to the desk's login page: it serves
  //// them the app, which shows its own login screen. What this changes is
  //// the appearance, not the authentication — the form posts to
  //// `/api/method/login`. See `views/SignIn.jsx`.
  //// Neoffice — and the sign-in screen too once the store has nobody, where upstream draws its
  //// <Login/>: a sign-out still owed that the server could not answer (store boot), another
  //// tab of this browser signing in or out. The page's boot named a member, the store does not.
  //// Neoffice — the connection line above the sign-in screen too: after a session that ended, it says
  //// the changes this device still owes are kept here (components/SyncBanner.jsx, status 'auth').
  if (BOOT.signed_in === false || (ready && !user && !isGuest)) return <div id="app"><SyncBanner /><SignIn /></div>
  //// Neoffice — signed in, but no valid membership: the club's message (and
  //// its renewal, when allowed) instead of the journal. See views/MembershipGate.jsx.
  if (BOOT.membership && BOOT.membership.blocked) return <div id="app"><MembershipGate /></div>

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {/* //// Neoffice — upstream draws <Login/> here for a signed-out visitor
              //// and its mobile onboarding; on Neoffice the sign-in screen is
              //// decided above from BOOT.signed_in (views/SignIn.jsx) and there is
              //// no paired-server onboarding. The banner moved out of #app with
              //// upstream v1.3.10 (below). */}
          {(
            <Routes>
              <Route path="/home" element={<Home />} />
              {/* Gym check-in — switched off in Settings, the route falls through to the
                  catch-all redirect below. */}
              {S.checkIn !== false && <Route path="/checkin" element={<CheckIn />} />}
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
          {/* //// Neoffice — see views/Classes.jsx */}
          <Route path="/classes" element={<Classes />} />
        {/* //// Neoffice — the club's challenges. Same door as classes:
            reached from the home screen, not through a sixth tab. */}
        <Route path="/challenges" element={<Challenges />} />
          {/* //// Neoffice — see views/Assessments.jsx */}
          <Route path="/assessments" element={<Assessments />} />
              <Route path="/muscles" element={<Muscles />} />
              <Route path="/structural-balance" element={<StructuralBalance />} />
              <Route path="/settings" element={<SettingsRoute />} />
              <Route path="/settings/:page" element={<SettingsRoute />} />
              {/* //// Neoffice — "My membership". The screen gates itself on the
                  club's setting, so the route exists unconditionally: a member
                  who bookmarked it lands on a real answer, not on the home
                  screen with no explanation. */}
              <Route path="/membership" element={<Membership />} />
              <Route path="/coach-thread" element={<CoachThread />} />
              {/* The Coach screens gate themselves on the instance config; the routes exist
                  unconditionally so a deep link from a notification lands somewhere sane
                  rather than on the catch-all. */}
              <Route path="/coach" element={<CoachChat />} />
              <Route path="/coach/intake" element={<CoachIntake />} />
              <Route path="/coach/proposal" element={<Navigate to="/coach" replace />} />
              <Route path="/coach/setup" element={<CoachSetup />} />
              {/* //// Neoffice — /admin removed. openGym's dashboard used to
                  list the profiles and invite codes of its Node user store;
                  the club manages its members, coaches and subscriptions in
                  the Frappe desk instead. */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      {/* Outside #app: the view's fade-in animates a transform, and a fixed element inside it
          would ride along with the page for the length of it. Decides for itself when to show.
          //// Neoffice — once signed in: the sign-in screen draws its own (above). The offline /
          //// not-synced banner is upstream's (v1.3.6): a member in the club's basement sees that
          //// their session is saved here and will sync. */}
      {authed && <SyncBanner />}
      {/* A conversation owns the bottom of the screen: its composer sits where
          the tabs would be. Measured the hard way on /coach-thread — the send
          and "help me word it" buttons started at y=802 and so did the tab
          bar, exactly overlapped. (//// Neoffice — /coach-thread is ours: CONVERSATIONS.) */}
      {!noTabs && !CONVERSATIONS.has(loc.pathname) && <TabBar onStart={startFlow} />}
      <RestTimer />
      <Modals />
      <Toast />
      <TimerFlash />
      <PrepCountdown />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
