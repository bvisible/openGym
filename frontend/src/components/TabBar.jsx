import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import Elapsed from './Elapsed.jsx'
//// Neoffice — what the bar holds and which place a screen lights (lib/nav-model.js), and whether the club has a coach (lib/use-coach-doors.js).
import { barModel, classesPlaces, BAR_PLACES, litPlace } from '../lib/nav-model.js'
import { useCoachDoors } from '../lib/use-coach-doors.js'
import { showsLibraryTab } from '../lib/level-visibility.js'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick}>
      <span className="tab-ic"><Icon name={icon} /></span><span>{label}</span>
    </button>
  )
}

//// Neoffice — the labels as literal t() calls, so that the checks on the translation packs see every one of them.
const labelOf = place => ({
  home: t('Home'), plan: t('Plan'), planning: t('Planning'), coach: t('Coach'), library: t('Exercises'), stats: t('Stats'),
})[place]

//// Neoffice — added (30.10, the pilot club): FIVE places, two on each side of the Start button, which the bar's grid centres whatever the count
//// (src/tabbar-centered.css). The account is no tab any more, it is the round button at the top right of the screens (components/AccountButton.jsx).
export default function TabBar({ onStart }) {
  const nav = useNavigate()
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

  // Root tabs are peers, not another level to unwind with Android Back.
  const switchTab = path => {
    if (loc.pathname !== path || loc.search) nav(path, { replace: true })
  }

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }

  const place = id => <Tab key={id} active={on(id)} icon={BAR_PLACES[id].icon} label={labelOf(id)} onClick={() => switchTab(BAR_PLACES[id].path)} />

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
      <button className={'start' + (S.active ? ' rec' : '') + (S.active && cur === 'workout' ? ' on' : '')} onClick={startWorkout}
        aria-label={running ? t('Resume') : undefined}>
        <span className="cir"><Icon name="play" /></span>
        {running ? <span className="tab-time"><Elapsed start={S.active.start} /></span>
          : <span>{S.active ? (cur === 'workout' ? t('Workout') : S.active.editingWorkoutId ? t('Edit workout') : t('Resume')) : t('Start')}</span>}
      </button>
      <div className="tab-side">{model.right.map(place)}</div>
    </nav>
  )
}
