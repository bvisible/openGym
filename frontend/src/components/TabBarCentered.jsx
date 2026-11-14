//// Neoffice — added file (no upstream equivalent). The bottom bar of the Neoffice journal: components/TabBar.jsx (upstream's) stays in the tree untouched, App.jsx draws this one.
import { useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
//// Neoffice — upstream v1.4.5's Start button, mirrored here: a day trained separately (#908), the picker on a long press or on every tap (#930).
import { dayApart, nextSessionIds } from '../lib/day-sessions.js'
import { START_HOLD_MS } from './TabBar.jsx'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import Elapsed from './Elapsed.jsx'
//// Neoffice — what the bar holds and which place a screen lights (lib/nav-model.js), and whether the club has a coach (lib/use-coach-doors.js).
import { barModel, classesPlaces, BAR_PLACES, litPlace } from '../lib/nav-model.js'
import { useCoachDoors } from '../lib/use-coach-doors.js'
import { showsLibraryTab } from '../lib/level-visibility.js'
//// Neoffice — upstream v1.4.4's TabBar, mirrored here: the tab you are already on takes you to the top of its page (lib/scroll-top.js), and the tabs carry the app tour's targets.
import { retapTab } from '../lib/scroll-top.js'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, tour }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} data-tour={tour}>
      <span className="tab-ic"><Icon name={icon} /></span><span>{label}</span>
    </button>
  )
}

//// Neoffice — the app tour's targets (components/Tour.jsx): upstream names four tabs; the places upstream does not have carry none, the tour skips what it cannot find.
const TOURS = { home: 'tab-home', plan: 'tab-plan', planning: 'tab-plan', library: 'tab-library', stats: 'tab-stats' }

//// Neoffice — the labels as literal t() calls, so that the checks on the translation packs see every one of them.
const labelOf = place => ({
  home: t('Home'), plan: t('Plan'), planning: t('Planning'), coach: t('Coach'), library: t('Exercises'), stats: t('Stats'),
})[place]

//// Neoffice — added (30.10, the pilot club): FIVE places, two on each side of the Start button, which the bar's grid centres whatever the count
//// (src/tabbar-centered.css). The account is no tab any more, it is the round button at the top right of the screens (components/AccountButton.jsx).
export default function TabBarCentered({ onStart, onPick }) {
  const nav = useNavigate()
  const hold = useRef(null)
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  const doors = useCoachDoors()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'

  //// Neoffice — the classes are not a tab of their own any more: they are the second segment of the Planning place (views/Planning.jsx).
  //// The place takes the name « Planning » when the club runs classes and this member wants to see them (lib/nav-model.js).
  const showClasses = classesPlaces({ mobile: MOBILE, demo: DEMO, perms: S.perms, classesTab: S.classesTab }).bar

  const model = barModel({ classes: showClasses, coach: doors.any, library: showsLibraryTab(S) })
  const lit = litPlace(cur, { coach: doors.any, fromStats: loc.state?.from === '/stats' })
  const on = place => lit === place || (lit === 'plan' && place === 'planning')

  // Root tabs are peers, not another level to unwind with Android Back. The tab you are already
  // on takes you to the top of its page instead (lib/scroll-top.js).
  const switchTab = path => {
    if (loc.pathname !== path || loc.search) nav(path, { replace: true })
    else retapTab(path)
  }

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const startWorkout = () => {
    // The press was held: the picker is open already, and this click is its release.
    if (hold.current === 'fired') { hold.current = null; return }
    if (!S.active) {
      // Settings → Workout → Start button (#930): every tap asks which workout.
      if (S.startPick === 'ask' && onPick) { onPick(); return }
      // A day trained separately (#908) starts its next session not done yet.
      if (dayApart(S, todayISO())) {
        const ids = nextSessionIds(S, todayISO())
        if (ids) { onStart(ids); return }
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      } else if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }
  // A long press on Start opens the picker (#930): today's plan on top, everything else below.
  // A tap still does what Start always did. Only with no workout running.
  const holdStart = () => {
    if (S.active || !onPick) return
    clearTimeout(hold.current)
    hold.current = setTimeout(() => {
      hold.current = 'fired'
      try { navigator.vibrate?.(10) } catch { /* no vibration here */ }
      onPick()
    }, START_HOLD_MS)
  }
  const holdEnd = () => { if (hold.current !== 'fired') { clearTimeout(hold.current); hold.current = null } }

  const place = id => <Tab key={id} active={on(id)} icon={BAR_PLACES[id].icon} label={labelOf(id)} onClick={() => switchTab(BAR_PLACES[id].path)} tour={TOURS[id]} />

  return (
    <nav id="tabbar" data-tabs={model.left.length + model.right.length + 1} data-layout="centered">
      <div className="tab-side">{model.left.map(place)}</div>
      {/* On the workout screen itself there is nothing to resume, so the button reads as the
          tab it is and stays lit (#29); anywhere else it brings you back to the exercise you
          were on — the marker is kept in S.active.cur and never moves on its own (#21). The
          glyph is always play: start and resume are one concept, and an exercise is a dumbbell.
          A live session you stepped away from shows its running time instead of a word, the
          button still named Resume; a past workout being edited or logged after the fact has no
          clock to run. */}
      <button data-tour="start" className={'start' + (S.active ? ' rec' : '') + (S.active && cur === 'workout' ? ' on' : '')} onClick={startWorkout}
        onPointerDown={holdStart} onPointerUp={holdEnd} onPointerLeave={holdEnd} onPointerCancel={holdEnd}
        onContextMenu={e => { if (!S.active && onPick) e.preventDefault() }}
        aria-label={running ? t('Resume') : undefined}>
        <span className="cir"><Icon name="play" /></span>
        {running ? <span className="tab-time"><Elapsed start={S.active.start} pausedAt={S.active.pausedAt} /></span>
          : <span>{S.active ? (cur === 'workout' ? t('Workout') : S.active.editingWorkoutId ? t('Edit workout') : t('Resume')) : t('Start')}</span>}
      </button>
      <div className="tab-side">{model.right.map(place)}</div>
    </nav>
  )
}
