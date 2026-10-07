import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutineIds, effectiveRoutines } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import Elapsed from './Elapsed.jsx'
import { useConnectionTrouble } from './SyncBanner.jsx'

// Module scope, not TabBar's render body. Declared inside it, `Tab` was a new function on every
// render, so React saw a different component type each time and threw the button away and built a
// fresh one — on a bar that is fixed on screen, and once a second for the whole of a rest. The
// state it took with it is the DOM node itself: focus, the :active tint, any in-flight transition.
function Tab({ active, icon, label, onClick, dot }) {
  return (
    <button className={active ? 'on' : ''} onClick={onClick} aria-label={dot ? label + ', ' + t('Connection problem') : undefined}>
      <span className="tab-ic"><Icon name={icon} />{dot && <span className="tab-dot" aria-hidden="true" />}</span><span>{label}</span>
    </button>
  )
}

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  // With the connection banner switched off, a sync problem shows as a dot on Home, the tab
  // Settings lives under (#369, #330).
  const trouble = useConnectionTrouble()
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  //// Neoffice — Settings have their own tab here (Account, far right), so they light it rather
  //// than Home as upstream's bar does; a class booking lights Classes.
  const on = k => cur === k || (cur === 'history' && k === 'stats') || (cur === 'muscles' && k === 'library') || (cur === 'structural-balance' && k === 'stats')

  //// Neoffice — the Classes tab rests on THREE conditions, and needs all
  //// three: there is a club behind it (the standalone mobile and demo builds
  //// have NO server at all — the tab would lead to a screen that cannot load
  //// anything), that club runs classes (perms.classes), and this member wants
  //// to see them (classesTab, their own setting). A club without classes shows
  //// nothing to anyone; a member who never goes gets rid of it for themselves
  //// alone. Defaults to true: `!== false` rather than `=== true`, otherwise the
  //// tab would vanish for as long as the state takes to arrive from the server.
  const showClasses = !MOBILE && !DEMO && S.perms?.classes !== false && S.classesTab !== false

  const running = !!S.active && cur !== 'workout' && !S.active.editingWorkoutId && !S.active.backfill && S.active.start > 0
  const startWorkout = () => {
    if (!S.active) {
      // A weekday can hold several routines; start the combined session if any of them has
      // exercises, otherwise fall through to the picker.
      if (effectiveRoutines(S, todayISO()).some(r => r.ex.length)) { onStart(effectiveRoutineIds(S, todayISO())); return }
    }
    nav('/workout')
  }

  return (
    //// Neoffice — `data-tabs` carries the column count: at seven, the labels
    //// have to shrink so they don't break in the middle of a word.
    <nav id="tabbar" data-tabs={showClasses ? 7 : 6}>
      <Tab active={on('home')} icon="house" label={t('Home')} onClick={() => nav('/home')} />
      {showClasses && <Tab active={on('classes')} icon="calendar" label={t('Classes')} onClick={() => nav('/classes')} />}
      {/* //// Neoffice — Plan moves from `calendar` to `clipboard`: classes ARE
           a calendar, and two neighbouring tabs wearing the same icon blur into
           one. It is already the icon the Plan screen shows when it is empty. */}
      <Tab active={on('plan')} icon="clipboard" label={t('Plan')} onClick={() => nav('/plan')} />
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
      <Tab active={on('stats')} icon="chart" label={t('Stats')} onClick={() => nav('/stats')} />
      <Tab active={on('library')} icon="dumbbell" label={t('Exercises')} onClick={() => nav('/library')} />
      {/* //// Neoffice — the account, far right. Settings were already reachable
           through the cog on the home screen; the tab gives them a fixed place,
           and balances the end of the bar.
           Home stays the FIRST tab (correction from Jeremy, 2026-08-25): it is
           the starting point, classes come after. The connection's dot (upstream
           v1.3.10 puts it on Home, the tab Settings live under there) is on it. */}
      <Tab active={on('settings')} icon="personCircle" label={t('Account')} dot={trouble} onClick={() => nav('/settings')} />
    </nav>
  )
}
