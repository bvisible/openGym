import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats')

  //// Neoffice — the Classes tab rests on THREE conditions, and needs all
  //// three: there is a club behind it (the standalone mobile and demo builds
  //// have NO server at all — the tab would lead to a screen that cannot load
  //// anything), that club runs classes (perms.classes), and this member wants
  //// to see them (classesTab, their own setting). A club without classes shows
  //// nothing to anyone; a member who never goes gets rid of it for themselves
  //// alone. Defaults to true: `!== false` rather than `=== true`, otherwise the
  //// tab would vanish for as long as the state takes to arrive from the server.
  const showClasses = !MOBILE && !DEMO && S.perms?.classes !== false && S.classesTab !== false

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label }) => (
    <button className={on(k) ? 'on' : ''} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  return (
    //// Neoffice — `data-tabs` carries the column count: at seven, the labels
    //// have to shrink so they don't break in the middle of a word.
    <nav id="tabbar" data-tabs={showClasses ? 7 : 6}>
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      {showClasses && <Tab k="classes" icon="calendar" to="/classes" label={t('Classes')} />}
      {/* //// Neoffice — Plan moves from `calendar` to `clipboard`: classes ARE
           a calendar, and two neighbouring tabs wearing the same icon blur into
           one. It is already the icon the Plan screen shows when it is empty. */}
      <Tab k="plan" icon="clipboard" to="/plan" label={t('Plan')} />
      <button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
      {/* //// Neoffice — the account, far right. Settings were already reachable
           through the cog on the home screen; the tab gives them a fixed place,
           and balances the end of the bar.
           Home stays the FIRST tab (correction from Jeremy, 2026-08-25): it is
           the starting point, classes come after. */}
      <Tab k="settings" icon="personCircle" to="/settings" label={t('Account')} />
    </nav>
  )
}
