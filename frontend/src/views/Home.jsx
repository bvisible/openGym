import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutines, effectiveRoutineIds, nextTrainingDay, streakWeeks, lastBW, setsDoneActive } from '../lib/history.js'
import { fmtNum, fmtDate, todayISO, isoOf, weekKey, weekStartOf, weekDayOffset, DAYS, DAYN, exCount } from '../lib/format.js'
import { t, tn, dateLocale } from '../lib/i18n.js'
import { bwSheet, goalSheet, dayOverrideSheet, calendarSheet, startFlow, starterPlanSheet, bwDeltaColor, coachOfferSheet, floorPlanSheet, weighInsSheet } from '../sheets.jsx'
import { loadFloorPlan } from '../components/FloorPlanSheet.jsx'
//// Neoffice — the "your coach sent you a program" banner.
import { useEffect } from 'react'
import { programInbox } from '../lib/api.js'
import { describeOffer } from '../lib/coach-program.js'
import { classesMine, challengesMine, announcements } from '../lib/api.js'
import LineChart from '../components/LineChart.jsx'
import Icon from '../components/Icon.jsx'
import InstallBanner from '../components/InstallBanner.jsx'
import QueueRow from '../components/QueueRow.jsx'
//// Neoffice — « Recent workouts » on Home, each with a visible Share button (components/RecentWorkouts.jsx).
import RecentWorkouts from '../components/RecentWorkouts.jsx'
//// Neoffice — the badges the club put forward, first thing under the notices.
import HomeBadges from '../components/HomeBadges.jsx'
import MiniBodyMap from '../components/MiniBodyMap.jsx'
import { queueOf, queueView, weekTally, pinState } from '../lib/queue.js'
import { scheduleModeOf } from '../lib/rotation.js'
import { useConnectionTrouble } from '../components/SyncBanner.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf } from '../lib/glyphs.js'
import { dayNoteOf } from '../lib/day-notes.js'
import { weighInAt } from '../lib/bodyweight.js'
import WeightRate from '../components/WeightRate.jsx'
import { SeasonDeco } from '../components/Seasonal.jsx'

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
  const [floor, setFloor] = useState([])
  useEffect(() => { let alive = true; loadFloorPlan().then(z => { if (alive) setFloor(z || []) }); return () => { alive = false } }, [])
  // The banner switched off and the sync stuck: a dot on the gear (Settings → Show connection status).
  const trouble = useConnectionTrouble()
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
  // A weekday can hold several routines. `todayRoutines` is the whole day; `routine` is the
  // first, kept for the one-routine glyph. The derived session name joins them (§9).
  const todayRoutines = effectiveRoutines(S, todayISO())
  const routine = todayRoutines[0] || null
  const todayName = todayRoutines.map(r => r.name).join(' + ')
  // A fulfilled pin (a coach session pinned to today and since done) reads as no override.
  const todayOvr = S.dayPlan[todayISO()] !== undefined && pinState(S, S.dayPlan[todayISO()]) !== 'done'
  // An open editor on a saved workout (lib/session-edit.js) holds S.active too, but it is not a
  // session in progress: the row takes you back to it as an edit, the way the tab bar does.
  const editingSaved = !!S.active?.editingWorkoutId
  const bw = lastBW(S)
  const prevBW = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prevBW ? bw.w - prevBW.w : null

  const ws = weekStartOf(S)
  // The first day of the shown week. Named for the role, not for Monday — which day that is
  // is the setting.
  const wkStart = new Date(today)
  wkStart.setDate(today.getDate() - weekDayOffset(today.getDay(), ws) + weekOffset * 7)
  const doneDays = new Set(S.workouts.map(w => w.d))
  // The last session logged for today, if any — what the row below reports instead of asking
  // you to start the one you already did. Last wins, so a second session names itself. Only once
  // today's plan is covered, though: a freestyle session on a planned day, or the rotation's
  // first session done when its next one is today's too, leaves the row offering what is still
  // to do, as Start and the progress row already do. A queue session is never "covered" by an
  // earlier workout: the queue only names one it does not count as done yet.
  const loggedToday = S.workouts.filter(w => w.d === todayISO())
  const queueIds = queueOf(S)?.ids || []
  const coveredToday = id => !queueIds.includes(id) && loggedToday.some(w => (Array.isArray(w.routineIds) ? w.routineIds : [w.routineId]).includes(id))
  const doneToday = (todayRoutines.every(r => coveredToday(r.id)) && loggedToday.at(-1)) || null
  const strip = []
  for (let i = 0; i < 7; i++) {
    const d = new Date(wkStart); d.setDate(wkStart.getDate() + i)
    const iso = isoOf(d)
    const eff = effectiveRoutineIds(S, iso).length > 0, ovr = S.dayPlan[iso] !== undefined, done = doneDays.has(iso)
    // A day off with a note (#261) reads as excused, not as a plan that went by.
    const dot = done ? ' done' : dayNoteOf(S, iso) ? ' noted' : ovr && eff ? ' ovr' : eff ? ' plan' : ''
    strip.push(<div key={i} className={'wday' + (iso === todayISO() ? ' today' : '')} {...tappable(() => dayOverrideSheet(iso))}>
      <div className="lbl">{t(DAYS[d.getDay()])}</div><div className="num">{d.getDate()}</div><div className={'dot' + dot} /></div>)
  }
  const wkEnd = new Date(wkStart); wkEnd.setDate(wkStart.getDate() + 6)
  const wkLabel = weekOffset === 0 ? t('This week') : `${wkStart.getDate()} ${wkStart.toLocaleDateString(dateLocale(), { month: 'short' })} – ${wkEnd.getDate()} ${wkEnd.toLocaleDateString(dateLocale(), { month: 'short' })}`

  // A coach week (S.queue) read through the same tolerant reader QueueRow uses, so a malformed
  // queue from another client shows the weekday dots, never an empty card.
  const queue = queueView(S, todayISO())
  // This card shows one thing or the other — QueueRow for a live queue, or Rotation chosen with
  // nothing built yet (S.scheduleMode), in which case there is no queue for QueueRow to render and
  // an empty-state card takes its place. Plan does the same in rotation mode: no weekday grid, only
  // the days that add a routine the loop does not have (Plan.jsx, "Also on fixed days").
  const rotating = scheduleModeOf(S) === 'rotation'
  // A planner-written queue (no rotationId) still names its weekday when it hasn't started yet —
  // that copy predates rotation and stays as it is. Our own rotation has no weekday of its own
  // (lib/rotation.js): naming one here — including on the pass's own one-day empty gap (THE
  // ONE-DAY BOUNDARY, rotation.js) or before a first routine is even added — would be the
  // fixed-week model leaking into a schedule that was never weekday-based.
  const liveQ = queueOf(S)
  const plannerQueue = !!queue && !liveQ?.rotationId
  // Ownership, not mere presence of a rotationId: a stale id left over from a rebuilt rotation
  // would otherwise still read as "this app manages it" (lib/rotation.js).
  const managedQueue = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  // On a rest day, saying when you train next beats leaving the row as a full stop.
  const next = !S.active && !todayRoutines.length && !(rotating && !plannerQueue) ? nextTrainingDay(S, todayISO()) : null
  // The streak card's fraction: this calendar week's workouts over the weekdays with a plan, or,
  // in a coach week, the queue's sessions and your own days together (lib/queue.js weekTally).
  const { done: doneThisWeek, planned: plannedPerWeek } = weekTally(S, todayISO())
  const bwPoints = S.bodyweight.slice(-30).map(b => ({ t: weighInAt(b), y: b.w, d: b.d }))
  //// Neoffice — no routine and nothing running: the plan's set-up is ONE compact row below (it used to be a big « Welcome! » card,
  //// and a second « No rotation yet » block inside the week card, on the screen a member opens the app on).
  const noPlan = !S.routines.length && !S.active

  // today's session shown right under the week strip
  const onToday = () => { if (S.active) nav('/workout'); else if (todayRoutines.length) startFlow(effectiveRoutineIds(S, todayISO())); else dayOverrideSheet(todayISO()) }
  // A chip on the coach week's progress row starts that one routine, in any order. A session
  // already in progress wins, as on the today row — starting another would overwrite it.
  const onQueueStart = id => { if (S.active) nav('/workout'); else startFlow([id]) }

  return <div className="narrow">
    <div className="hdr">
      <SeasonDeco spot="header-bats" />
      <div><h1>{user ? t('Hi {0}', user.name) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={trouble ? t('Settings') + ', ' + t('Connection problem') : t('Settings')}><Icon name="gear" />{trouble && <span className="tab-dot" aria-hidden="true" />}</button>
    </div>

    {/* //// Neoffice — the notice board, BEFORE the classes: a notice can
         correct the schedule read just below it ("the gym is closed on
         Thursday"), so it has to be read first. */}
    {/* //// Neoffice — "add to home screen", for a member still in the browser
         on their phone. First, above the club's notices: it is the one thing that
         makes every later visit shorter. Draws nothing once installed. */}
    <InstallBanner />

    {openNotices.map(n => <div key={n.name} className="card" style={{ borderColor: 'var(--acc)' }}>
      <div className="row between" style={{ marginBottom: 6, gap: 10 }}>
        <div className="lbl2">{n.title}</div>
        <button className="iconbtn" onClick={() => closeNotice(n)} aria-label={t('Close')}>
          <Icon name="xmark" />
        </button>
      </div>
      <div className="small" style={{ lineHeight: 1.5, whiteSpace: 'pre-line' }}>{n.body}</div>
    </div>)}

    {/* //// Neoffice — the badges the club put forward, with their progress ring: what the club's coach asked to see first (28.10). Silent when the club
         featured none, so the home screen of a club without badges is exactly what it was. */}
    <HomeBadges onOpen={() => nav('/stats')} />

    {/* //// Neoffice — the room itself, one tap away: « voir le plan de la salle
        hors exercice » (2026-09-09). Only when the club drew one. */}
    {floor.length > 0 && <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => floorPlanSheet(floor))}>
      <div className="row between">
        <div className="row" style={{ gap: 9 }}><span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="map" /></span>
          <div><div className="lbl2">{t('Floor plan')}</div><div className="small dim">{t('{0} zones · find every machine', floor.length)}</div></div></div>
        <Icon name="chevronRight" className="chev" />
      </div>
    </div>}

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
      {/* A coach week runs by order, not by weekday, so its progress row stands in for the
          seven dots (components/QueueRow.jsx). The today row below stays as it is: the queue's
          next session reaches it through effectiveRoutineIds like any planned routine. */}
      {/* //// Neoffice — an empty rotation says nothing on the home screen any more: « No rotation yet. Add routines to it in Plan » was the first thing
           the club's coach read on opening the app (28.10), and it means nothing to most members, whose days change from week to week. The Plan screen
           keeps its own empty state (Plan.jsx); the Today row below still starts the next session. */}
      {rotating ? (queue ? <QueueRow S={S} today={todayISO()} onStart={onQueueStart} managed={managedQueue} /> : null) : <>
        <div className="row between" style={{ marginBottom: 8 }}>
          <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w - 1)} aria-label={t('Previous week')}><Icon name="chevronLeft" /></button>
          <div className="small muted" style={{ fontWeight: 500 }}>{wkLabel}</div>
          <button className="iconbtn" style={{ width: 30, height: 30, fontSize: 15 }} onClick={() => setWeekOffset(w => w + 1)} aria-label={t('Next week')}><Icon name="chevronRight" /></button>
        </div>
        <div className="week">{strip}</div>
      </>}
      {/* Once today's session is logged the row stops asking for it. The week strip already
          knew (its dot goes 'done'); this row did not, so a finished day kept showing the
          routine name behind a green Start tag and read as still outstanding (issue #4).
          An in-progress session still wins — that one is happening right now. Tapping the
          row keeps working, so a second session in one day is a tap away, just not urged. */}
      <div className="today-row" {...tappable(onToday)}>
        <div className="row" style={{ gap: 9, minWidth: 0 }}>
          <span className="lrow-i" style={{ background: S.active ? 'var(--orange)' : doneToday ? 'var(--surface-3)' : routine ? 'var(--acc)' : 'var(--surface-3)' }}>
            <Icon name={S.active ? (editingSaved ? 'pencil' : 'play') : doneToday ? 'checkCircle' : routine ? glyphOf(routine.emoji) : 'moon'}
              style={doneToday && !S.active ? { color: 'var(--green)' } : undefined} />
          </span>
          <div style={{ minWidth: 0 }}>
            <div className="lbl2">{t('Today')}</div>
            <div className="ttl">{S.active ? (editingSaved ? S.active.name : t('{0} (in progress)', S.active.name))
              : doneToday ? (doneToday.name ? t('{0} (done)', doneToday.name) : t('Workout done'))
              : routine ? todayName : t('Rest day')}{todayOvr && routine && !doneToday ? ' · ' + t('rescheduled') : ''}</div>
            {next && !doneToday && <div className="ss">{t('Next session: {0}, {1}', t(DAYN[next.weekday]), next.routine.name)}</div>}
          </div>
        </div>
        {S.active ? <span className="tag" style={{ color: 'var(--orange)', background: 'color-mix(in srgb,var(--orange) 16%,transparent)' }}>{editingSaved ? t('Edit') : t('Resume')}</span>
          : doneToday ? <span className="tag" style={{ color: 'var(--green)', background: 'color-mix(in srgb,var(--green) 16%,transparent)' }}>{t('Done')}</span>
          : routine ? <span className="row" style={{ gap: 8 }}><MiniBodyMap routines={todayRoutines} body={S.body} /><span className="tag acc">{t('Start')}</span></span>
          : <Icon name="plus" className="chev" />}
      </div>
      {/* The row above starts today's plan in one tap, and so does the Start button in the tab
          bar — which is the whole problem when you want something else. Both jump straight into
          the planned session whenever there is one, so the Start screen (a freestyle session,
          and your other routines) is only reachable on a day with nothing planned. The one other
          way in, "Choose a different workout" on the weigh-in sheet, does not exist when the
          weigh-in is switched off. This is that door, and it starts nothing on its own. */}
      {!S.active && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
        <Button size="sm" variant="ghost" className="dim" icon="swap" onClick={() => nav('/workout')}>
          {t('Choose a different workout')}
        </Button>
      </div>}
      <SeasonDeco spot="home-hero" />
    </div>

    {/* //// Neoffice — the last three sessions, each with a visible Share button: sharing a session is one tap from the home screen. */}
    <RecentWorkouts S={S} nav={nav} />

    {/* Jump to the gym check-in cards (QR membership codes). Shown here as a quick tap on
        arrival at the gym; folds away per user via the "Gym check-in" switch in Settings. */}
    {S.checkIn !== false && (
      <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => nav('/checkin'))}>
        <div className="row between">
          <div className="row" style={{ gap: 9 }}>
            <span className="lrow-i" style={{ background: 'var(--blue)' }}><Icon name="qr" /></span>
            <div>
              <div className="lbl2">{t('At the gym')}</div>
              <div className="ttl">{t('Check in')}</div>
            </div>
          </div>
          <Icon name="chevronRight" className="chev" />
        </div>
      </div>
    )}

    {/* //// Neoffice — one compact row, below the recent workouts when there are some: a title and two small buttons. Upstream's
        //// big « Welcome! » card took most of the screen on an account that had nothing to show yet. */}
    {noPlan && (
      <div className="card plan-compact">
        <div className="plan-compact-row">
          <div className="plan-compact-title">{t('Welcome!')}</div>
          <Button size="sm" variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
          <Button size="sm" onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
        </div>
      </div>
    )}

    {S.showWeightCard !== false && <div className="card">
      <div className="row between bw-head" style={{ marginBottom: 6 }}>
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
          <span className="dim small" style={{ marginInlineStart: 'auto' }}>{fmtDate(bw.d, true)}</span>
        </div>
        {S.targetW && (
          <div className="small row" style={{ color: 'var(--yellow)', marginTop: 4, gap: 5 }}>
            <Icon name="target" style={{ fontSize: 13 }} />
            <span>{t('Goal')} {fmtNum(S.targetW)} {S.unit} · {Math.abs(S.targetW - bw.w) < 0.05 ? t('reached!') : t(S.targetW > bw.w ? '{0} to gain' : '{0} to lose', fmtNum(Math.abs(S.targetW - bw.w)) + ' ' + S.unit)}</span>
          </div>
        )}
        <div className="chart" style={{ marginTop: 8 }}><LineChart points={bwPoints} h={130} unit={S.unit} goal={S.targetW} /></div>
        {/* the weekly rate and, with one set, how it sits in its corridor (#759) */}
        <WeightRate S={S} />
        {/* every weigh-in, week by week with its average (Discord 'Weight') */}
        <div className="row" style={{ justifyContent: 'flex-end', marginTop: 4 }}>
          <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={weighInsSheet}>{t('All weigh-ins')}</Button>
        </div>
      </> : <div className="muted small">{/* //// Neoffice — "we also ask before every workout" is only true
          //// when the member set our weighInEvery to 'workout'; the default asks nobody. */}
        {S.weighIn === false || S.weighInEvery !== 'workout'
        ? t('No weigh-ins yet. Log your weight to start the curve.')
        : t("No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).")}</div>}
    </div>}

    <div className="card tappable" style={{ cursor: 'pointer' }} {...tappable(() => calendarSheet())}>
      <SeasonDeco spot="home-streak" />
      <div className="row between">
        <div>
          <div className="row" style={{ gap: 7, fontSize: 22, fontWeight: 600, letterSpacing: '-.021em' }}>
            <Icon name="flame" style={{ color: 'var(--orange)' }} />
            {/* //// Neoffice — a streak of one week is singular where the language agrees the noun with the count:
                //// « série de 1 semaines » read as a mistake to the pilot club (maintenance#1262). A locale
                //// without the « 1 week streak » entry keeps the general sentence. */}
            {streakWeeks(S) === 1 && t('1 week streak') !== '1 week streak' ? t('1 week streak') : t('{0} week streak', streakWeeks(S))}
          </div>
          <div className="muted small" style={{ marginTop: 2 }}>{doneThisWeek}{plannedPerWeek ? ' / ' + plannedPerWeek : ''} {t('this week')} · {tn('{0} workout total', '{0} workouts total', S.workouts.length)}</div>
        </div>
        <Icon name="calendar" className="chev" style={{ fontSize: 20 }} />
      </div>
    </div>
  </div>
}
