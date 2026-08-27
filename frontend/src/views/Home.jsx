import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine, effectiveRoutineId, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, DAYS, exCount } from '../lib/format.js'
import { t, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, loadStarterPlan, bwDeltaColor, coachOfferSheet } from '../sheets.jsx'
//// Neoffice — the "your coach sent you a program" banner.
import { useEffect } from 'react'
import { programInbox } from '../lib/api.js'
import { describeOffer } from '../lib/coach-program.js'
import { classesMine, challengesMine, announcements } from '../lib/api.js'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { glyphOf } from '../lib/glyphs.js'

//// Neoffice — what the offer contains, said in the member's language.
function offerSummary(o) {
  const d = describeOffer(o)
  if (!d.ok) return t('This program could not be read: {0}', d.error)
  const parts = [t(d.routineCount === 1 ? '{0} routine' : '{0} routines', d.routineCount), exCount(d.exerciseCount)]
  if (d.scheduledDays > 0) {
    parts.push(t(d.scheduledDays === 1 ? 'scheduled on {0} day' : 'scheduled on {0} days', d.scheduledDays))
  }
  //// A cycle is stated BEFORE accepting: "on 3 days" describes a typical
  //// week, and lets the member believe the schedule will not move again.
  if (d.cycleSpan > 1) parts.push(t('{0}-week cycle', d.cycleSpan))
  return parts.join(' · ')
}

// Home = what to do now + a quick glance. Deep charts & history live in Stats.
export default function Home() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const [weekOffset, setWeekOffset] = useState(0)

  //// Neoffice — what the coach has sent.
  ////
  //// Polled on mount and whenever the tab comes back, not on an interval: a
  //// member opens the logbook to train, and an offer appearing mid-session
  //// helps nobody. Failure is SILENT — offline there is no offer to show, and
  //// that is not an error to put in front of someone about to lift.
  const [offers, setOffers] = useState([])
  useEffect(() => {
    let alive = true
    const load = () => {
      programInbox().then(list => { if (alive) setOffers(Array.isArray(list) ? list : []) }).catch(() => {})
    }
    //// Neoffice — le premier chargement est INCONDITIONNEL.
    //// An early version skipped it when document.hidden was true. That is
    //// wrong on mount: a tab mounted hidden will never get a visibilitychange
    //// if it was already in that state — no offers at all, ever. The guard
    //// only makes sense on later reloads, where it avoids a call at the very
    //// moment the tab is being LEFT.
    load()
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('online', load)
    }
  }, [])

  //// Neoffice — the next classes, if the club runs any.
  //// Loaded separately from the program offers: two independent calls that do
  //// not block one another, and a club without classes does not even pay for
  //// the round trip — perms.classes decides before we hit the network.
  const [classes, setClasses] = useState([])
  //// Neoffice — the club's notice board. What a member dismissed is
  //// remembered by THEIR device: writing it to the database would cost one
  //// write per member per notice for a display convenience, and would hand the
  //// club the list of who read what — which it never asked for.
  //// The key carries the MODIFIED date: a notice corrected by the club reopens
  //// for those who had read the wrong version. Without that, a schedule
  //// correction would never be read by the very people it concerns.
  const [notices, setNotices] = useState([])
  const [seen, setSeen] = useState(() => {
    try { return JSON.parse(localStorage.getItem('gym_notices_seen') || '{}') } catch (e) { return {} }
  })
  useEffect(() => {
    let alive = true
    announcements()
      .then(r => { if (alive) setNotices(r.announcements || []) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  const closeNotice = (n) => {
    const next = { ...seen, [n.name]: n.modified }
    setSeen(next)
    try { localStorage.setItem('gym_notices_seen', JSON.stringify(next)) } catch (e) { /* private mode */ }
  }
  const openNotices = notices.filter(n => seen[n.name] !== n.modified)

  //// Neoffice — the running challenges. Loaded separately from the classes: a
  //// club may have one without the other, and a failure here must not empty
  //// the schedule.
  const [challenges, setChallenges] = useState([])
  useEffect(() => {
    let alive = true
    challengesMine()
      .then(r => { if (alive) setChallenges((r.challenges || []).filter(c => c.running).slice(0, 3)) })
      .catch(() => {})
    return () => { alive = false }
  }, [])
  useEffect(() => {
    if (S.perms && S.perms.classes === false) return
    let alive = true
    const load = () => {
      classesMine().then(list => { if (alive) setClasses(Array.isArray(list) ? list.slice(0, 3) : []) }).catch(() => {})
    }
    load()
    const onVis = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVis)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVis) }
  }, [S.perms && S.perms.classes])

  const today = new Date()
  const routine = effectiveRoutine(S, todayISO())
  const todayOvr = S.dayPlan[todayISO()] !== undefined
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const monday = new Date(today); monday.setDate(today.getDate() - ((today.getDay() + 6) % 7) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  // The last session logged for today, if any — what the row below reports instead of asking
  // you to start the one you already did. Last wins, so a second session names itself.
  const doneToday = S.workouts.filter(w => w.d === todayISO()).at(-1) || null
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(monday); d.setDate(monday.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineId(S, iso), ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    const dot = done ? ' done' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} onClick={() => dayOverrideSheet(iso)}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const sunday = new Date(monday); sunday.setDate(monday.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${monday.getDate()} ${monday.toLocaleDateString(dateLocale(), { month: 'short' })} – ${sunday.getDate()} ${sunday.toLocaleDateString(dateLocale(), { month: 'short' })}`

  const wThisWeek = S.workouts.filter(w => weekKey(w.d) === weekKey(todayISO())).length
  const plannedPerWeek = Object.keys(S.week).filter(k => S.week[k]).length
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: b.t || new Date(b.d).getTime(), y: b.w, d: b.d }))

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (routine) startFlow(routine.id); else dayOverrideSheet(todayISO()) }

  return <div className="narrow">
    <div className="hdr">
      <div><h1>{user ? t('Hi {0}', user.name) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Settings')}><Icon name="gear" /></button>
    </div>

    {/* //// Neoffice — the notice board, BEFORE the classes: a notice can
         correct the schedule read just below it ("the gym is closed on
         Thursday"), so it has to be read first. */}
    {openNotices.map(n => <div key={n.name} className="card" style={{ borderColor: 'var(--acc)' }}>
      <div className="row between" style={{ marginBottom: 6, gap: 10 }}>
        <div className="lbl2">{n.title}</div>
        <button className="iconbtn" onClick={() => closeNotice(n)} aria-label={t('Close')}>
          <Icon name="xmark" />
        </button>
      </div>
      <div className="small" style={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>{n.body}</div>
    </div>)}

    {/* //// Neoffice — les prochains cours. Sous les offres et au-dessus de la
         semaine : un cours est un RENDEZ-VOUS, donc il se lit avant le plan. */}
    {classes.length > 0 && <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/classes')}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="lbl2">{t('Your next classes')}</div>
        <span className="small acc">{t('See the schedule')}</span>
      </div>
      {classes.map(c => <div key={c.id} className="row" style={{ gap: 9, padding: '4px 0', minWidth: 0 }}>
        <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="calendar" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="ttl">{c.title}</div>
          <div className="small dim">{c.start
            ? new Date(c.start).toLocaleString(dateLocale(), { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
            : ''}{c.coach ? ' \u00b7 ' + c.coach : ''}</div>
        </div>
      </div>)}
    </div>}

    {/* //// Neoffice — the running challenges. After the classes: a class is an
         appointment you can miss, a challenge runs over weeks and waits.
         We show the member's OWN rank, never anyone else's — their score is
         health data, and it is asked for on the challenges screen. */}
    {challenges.length > 0 && <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/challenges')}>
      <div className="row between" style={{ marginBottom: 8 }}>
        <div className="lbl2">{t('Challenges')}</div>
        <span className="small acc">{t('See all')}</span>
      </div>
      {challenges.map(c => <div key={c.name} className="row" style={{ gap: 9, padding: '4px 0', minWidth: 0 }}>
        <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="trophy" /></span>
        <div style={{ minWidth: 0 }}>
          <div className="ttl">{c.title}</div>
          <div className="small dim">{c.joined
            ? (c.rank ? (c.rank === 1 ? t('You are 1st of {0}', c.of) : t('You are {0} of {1}', c.rank, c.of)) : t('You are taking part'))
            : t('Take part if you want to')}</div>
        </div>
      </div>)}
    </div>}

    {/* //// Neoffice — above the week, never as a pop-up: a program offer does
         not interrupt, it waits to be seen. */}
    {offers.map(o => <div key={o.id} className="card" style={{ cursor: 'pointer', borderColor: 'var(--acc)' }} onClick={() => coachOfferSheet(o)}>
      <div className="row" style={{ gap: 10, minWidth: 0 }}>
        <span className="lrow-i" style={{ background: 'var(--acc)' }}><Icon name="clipboard" /></span>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div className="lbl2">{o.coach ? t('{0} sent you a program', o.coach) : t('Your coach sent you a program')}</div>
          {/* //// Neoffice — the summary is composed HERE, not server-side.
              The server would render the sentence in the COACH's language at
              send time and it would stay frozen there: a French-speaking member
              would read "1 routine · 2 exercises". The bundle travels with the
              offer, so the logbook counts for itself, in its own language. */}
          <div className="ttl">{offerSummary(o)}</div>
        </div>
        <Icon name="chevronRight" className="chev" />
      </div>
    </div>)}

    <div className="card">
      <div className="row between" style={{ marginBottom: 8 }}>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label="Previous week"><Icon name="chevronLeft" /></button>
        <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
        <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label="Next week"><Icon name="chevronRight" /></button>
      </div>
      <div className="week">{strip}</div>
      {/* Once today's session is logged the row stops asking for it. The week strip already
          knew (its dot goes 'done'); this row did not, so a finished day kept showing the
          routine name behind a green Start tag and read as still outstanding (issue #4).
          An in-progress session still wins — that one is happening right now. Tapping the
          row keeps working, so a second session in one day is a tap away, just not urged. */}
      <div className="today-row" onClick={onToday}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : doneToday ? 'var(--surface-3)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? 'timer' : doneToday ? 'checkCircle' : routine ? glyphOf(routine.emoji) : 'moon'}
              style={doneToday && !S.active ? { color: 'var(--green)' } : undefined} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? t('{0} — in progress', S.active.name)
              : doneToday ? (doneToday.name ? t('{0} — done', doneToday.name) : t('Workout done'))
              : routine ? routine.name : t('Rest day')}{todayOvr && routine && !doneToday ? ' · ' + t('rescheduled') : ''}</div>
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)' }}>{t('Resume')}</span>
          : doneToday ? <span className="tag" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' }}>{t('Done')}</span>
          : routine ? <span className="tag acc">{t('Start')}</span>
          : <Icon name="plus" className="chev" />}
      </div>
    </div>

    {!S.routines.length && !S.active && (
      <div className="card">
        <div className="row" style={{ gap: 10, marginBottom: 6 }}>
          <span className="lrow-i"><Icon name="sparkles" /></span>
          <div className="big" style={{ fontSize: 22 }}>{t('Welcome!')}</div>
        </div>
        <div className="muted small" style={{ marginBottom: 12 }}>{t('Set up your weekly routine to get going — or load a ready-made Push / Pull / Legs plan.')}</div>
        <Button variant="primary" icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (PPL)')}</Button>
        <div style={{ height: 8 }} /><Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
    )}

    <div className="card">
      <div className="row between" style={{ marginBottom: 6 }}>
        <h2 style={{ margin: 0 }}>{t('Body weight')}</h2>
        <div className="row" style={{ gap: 8 }}>
          <Button size="sm" icon="target" style={S.targetW ? { color: 'var(--yellow)' } : undefined} onClick={goalSheet}>{S.targetW ? fmtNum(S.targetW) : t('Goal')}</Button>
          <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
        </div>
      </div>
      {bw ? <>
        <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
          <div className="big">{fmtNum(bw.w)} <span className="muted" style={{ fontSize: '1rem' }}>{S.unit}</span></div>
          {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
          {!!delta && (
            <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />
              {fmtNum(Math.abs(delta))}
            </span>
          )}
          <span className="dim small" style={{ marginLeft: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
      </> : <div className="muted small">{t("No entries yet — log your weight to start the curve. It's also asked before every workout.")}</div>}
    </div>

    <div className="card tappable" style={{ cursor: 'pointer' }} onClick={() => calendarSheet()}>
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--orange)' }} />
            {t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{wThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {t(S.workouts.length === 1 ? '{0} workout total' : '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
