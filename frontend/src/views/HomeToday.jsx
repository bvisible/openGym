//// Neoffice — added file (no upstream equivalent).
////
//// The home screen, calmed for everybody (the pilot club, 30.10: « plus c'est épuré, plus c'est simple à utiliser », for everyone). One screen, one task:
//// today's session, with one filled button. Under it only what a member needs on arrival: what is waiting to be read, the badges the club put forward,
//// the way to the coach, the weight (« relégué, PAS planqué »: views/bodyweight.reachable.test.jsx), and the access code in the header.
//// Nothing was removed, it moved to the place it belongs to: the floor plan to Settings › Your club (components/FloorPlanRow.jsx), the club's challenges
//// to Classes, the recent workouts to Stats › History (where each row still has its Share button), the weight curve to Stats.
//// Upstream's own screen (views/Home.jsx) is kept untouched so upstream merges stay trivial; only the route changed (App.jsx).
import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { todayISO, fmtNum, fmtDate, DAYS, DAYN, exCount } from '../lib/format.js'
import { lastBW, streakWeeks } from '../lib/history.js'
import { weekTally, queueOf, queueView } from '../lib/queue.js'
import { scheduleModeOf } from '../lib/rotation.js'
import { todayHero, weekDots } from '../lib/home-today.js'
import { useHomeFeed, offerSummary } from '../lib/use-home-feed.js'
import { useCoachDoors } from '../lib/use-coach-doors.js'
import { t, dateLocale } from '../lib/i18n.js'
import { startFlow, dayOverrideSheet, starterPlanSheet, bwSheet, bwDeltaColor, coachOfferSheet, calendarSheet, weighInsSheet } from '../sheets.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import InstallBanner from '../components/InstallBanner.jsx'
import HomeBadges from '../components/HomeBadges.jsx'
import ChallengesCard from '../components/ChallengesCard.jsx'
import { classesPlaces } from '../lib/nav-model.js'
import { showsHomeExtras } from '../lib/level-visibility.js'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import QueueRow from '../components/QueueRow.jsx'
import { SeasonDeco } from '../components/Seasonal.jsx'

// A streak of one week is singular where the language agrees the noun with the count: a locale without the « 1 week streak » entry keeps the general sentence.
const streakLine = n => (n === 1 && t('1 week streak') !== '1 week streak' ? t('1 week streak') : t('{0} week streak', n))

function Hero({ S, nav, hero, today, iso }) {
  const dots = weekDots(S, today, iso)
  // A coach week or a rotation runs by order, not by weekday: its progress row stands in for the seven dots (components/QueueRow.jsx).
  const rotating = scheduleModeOf(S) === 'rotation'
  const queue = queueView(S, iso)
  const liveQ = queueOf(S)
  const managed = !!liveQ && !!S.rotation && liveQ.rotationId === S.rotation.id
  const { done, planned } = weekTally(S, iso)
  const streak = streakWeeks(S)

  const onStart = () => {
    if (S.active) nav('/workout')
    else if (hero.routineIds.length) startFlow(hero.routineIds)
    else dayOverrideSheet(iso)
  }
  const onQueueStart = id => { if (S.active) nav('/workout'); else startFlow([id]) }

  const running = hero.kind === 'running' || hero.kind === 'editing'
  const title = running ? (hero.kind === 'running' ? t('{0} (in progress)', hero.title) : hero.title)
    : hero.kind === 'done' ? (hero.title ? t('{0} (done)', hero.title) : t('Workout done'))
    : hero.kind === 'planned' ? hero.title
    : hero.kind === 'rest' ? t('Rest day')
    : t('Welcome!')
  const sentence = hero.kind === 'planned'
    ? exCount(hero.exercises) + (hero.rescheduled ? ' · ' + t('rescheduled') : '')
    : hero.kind === 'rest' && hero.next ? t('Next session: {0}, {1}', t(DAYN[hero.next.weekday]), hero.next.routine.name)
    : ''

  return <div className="card home-hero">
    <SeasonDeco spot="home-hero" />
    <div className="lbl2">{t('Today')}</div>
    <div className="home-hero-title row" style={{ gap: 8 }}>
      {hero.kind === 'done' && <Icon name="checkCircle" style={{ color: 'var(--green)' }} />}
      <span>{title}</span>
    </div>
    {sentence && <div className="dim home-hero-sub">{sentence}</div>}

    {hero.kind === 'empty'
      ? <div className="row" style={{ gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button variant="primary" icon="clipboard" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
        <Button onClick={() => nav('/plan')}>{t('Build my own plan')}</Button>
      </div>
      : hero.kind === 'planned' || running
        ? <Button variant="primary" className="home-hero-go" icon="play" onClick={onStart}>
          {hero.kind === 'editing' ? t('Edit') : hero.kind === 'running' ? t('Resume') : t('Start workout')}
        </Button>
        : <Button variant="tinted" className="home-hero-go" icon="swap" onClick={() => nav('/workout')}>{t('Choose a different workout')}</Button>}

    {rotating
      ? (queue ? <div style={{ marginTop: 12 }}><QueueRow S={S} today={iso} onStart={onQueueStart} managed={managed} /></div> : null)
      : <div className="week home-hero-week">{dots.map(d => <div key={d.iso} className={'wday' + (d.today ? ' today' : '')} {...tappable(() => dayOverrideSheet(d.iso))}>
        <div className="lbl">{t(DAYS[d.weekday])}</div><div className="num">{d.date}</div><div className={'dot' + (d.state ? ' ' + d.state : '')} />
      </div>)}</div>}

    <div className="small dim home-hero-line" {...tappable(() => calendarSheet())}>
      {done}{planned ? ' / ' + planned : ''} {t('this week')}{streak > 0 ? ' · ' + streakLine(streak) : ''}
    </div>

    {/* The way to another session: both the card and the Start button jump into the planned one, so this is the door to a freestyle session. */}
    {!S.active && (hero.kind === 'planned' || hero.kind === 'done') && <div style={{ display: 'flex', justifyContent: 'center', marginTop: 4 }}>
      <Button size="sm" variant="ghost" className="dim" icon="swap" onClick={() => nav('/workout')}>{t('Choose a different workout')}</Button>
    </div>}
  </div>
}

function ToRead({ offers, notices, close }) {
  const [open, setOpen] = useState(null)
  if (!offers.length && !notices.length) return null
  return <div className="card home-read">
    <div className="lbl2" style={{ marginBottom: 6 }}>{t('To read')}</div>
    {/* A program the coach sent is an offer to accept: it comes before a notice. */}
    {offers.map(o => <div key={o.id} className="home-read-row" {...tappable(() => coachOfferSheet(o))}>
      <span className="lrow-i" style={{ background: 'var(--acc)' }}><Icon name="clipboard" /></span>
      <div className="grow" style={{ minWidth: 0 }}>
        <div className="ttl">{o.coach ? t('{0} sent you a program', o.coach) : t('Your coach sent you a program')}</div>
        <div className="small dim">{offerSummary(o)}</div>
      </div>
      <Icon name="chevronRight" className="chev" />
    </div>)}
    {notices.map(n => <div key={n.name} className="home-read-row">
      <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="bell" /></span>
      <div className="grow" style={{ minWidth: 0 }} {...tappable(() => setOpen(open === n.name ? null : n.name))}>
        <div className="ttl">{n.title}</div>
        <div className={'small dim' + (open === n.name ? '' : ' home-read-clamp')} style={{ whiteSpace: 'pre-line', lineHeight: 1.5 }}>{n.body}</div>
      </div>
      <button className="iconbtn" onClick={() => close(n)} aria-label={t('Close')}><Icon name="xmark" /></button>
    </div>)}
  </div>
}

function CoachCard({ nav, doors }) {
  if (!doors.any) return null
  return <div className="card home-coach">
    <div className="lbl2" style={{ marginBottom: 8 }}>{t('Your coach')}</div>
    <div className="row" style={{ gap: 8, flexWrap: 'wrap' }}>
      {doors.human && <Button variant="tinted" icon="chat" onClick={() => nav('/coach-thread')}>{t('Write to your coach')}</Button>}
      {doors.nora && <Button variant="tinted" icon="sparkles" onClick={() => nav('/coach')}>{t('Ask Nora')}</Button>}
    </div>
  </div>
}

function WeightRow({ S }) {
  if (S.showWeightCard === false) return null
  const bw = lastBW(S)
  const prev = S.bodyweight.length > 1 ? S.bodyweight[S.bodyweight.length - 2] : null
  const delta = bw && prev ? bw.w - prev.w : null
  return <div className="card home-weight">
    <div className="row between">
      <div className="grow" style={{ minWidth: 0 }} {...(bw ? tappable(weighInsSheet) : {})}>
        <div className="lbl2">{t('Body weight')}</div>
        {bw
          ? <div className="row" style={{ gap: 8, alignItems: 'baseline' }}>
            <span className="ttl">{fmtNum(bw.w)} {S.unit}</span>
            {/* only when it actually moved — an unchanged weight used to read as "− 0" */}
            {!!delta && <span className="small row" style={{ gap: 2, fontWeight: 500, color: bwDeltaColor(delta, bw.w) }}>
              <Icon name={delta > 0 ? 'arrowUp' : 'arrowDown'} style={{ fontSize: 12 }} />{fmtNum(Math.abs(delta))}
            </span>}
            <span className="dim small">{fmtDate(bw.d, true)}</span>
          </div>
          : <div className="small dim">{S.weighIn === false || S.weighInEvery !== 'workout'
            ? t('No weigh-ins yet. Log your weight to start the curve.')
            : t('No weigh-ins yet. Log your weight to start the curve (we also ask before every workout).')}</div>}
      </div>
      <Button size="sm" icon="plus" onClick={() => bwSheet()}>{t('Log')}</Button>
    </div>
  </div>
}

export default function HomeToday() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const feed = useHomeFeed()
  const doors = useCoachDoors()
  const today = new Date()
  const iso = todayISO()
  const hero = todayHero(S, iso)

  return <div className="narrow home-today">
    <div className="hdr">
      <SeasonDeco spot="header-bats" />
      <div><h1>{user ? t('Hi {0}', user.name) : 'openGym'}</h1><div className="sub">{today.toLocaleDateString(dateLocale(), { weekday: 'long', day: 'numeric', month: 'long' })}</div></div>
      {S.checkIn !== false && <div className="hdr-actions">
        {/* An icon, not a labelled pill: with a long member name the greeting wrapped on three lines at phone width. It still has its name (screen readers, long press). */}
        <button className="iconbtn" onClick={() => nav('/checkin')} aria-label={t('My access')} title={t('My access')}><Icon name="qr" /></button>
      </div>}
    </div>
    <InstallBanner />
    <Hero S={S} nav={nav} hero={hero} today={today} iso={iso} />
    <ToRead offers={feed.offers} notices={feed.notices} close={feed.close} />
    <HomeBadges onOpen={() => nav('/stats')} />
    {/* The challenges live with the classes (Planning); with no classes segment in the bar there is no such place, so they stay here. */}
    {!classesPlaces({ mobile: MOBILE, demo: DEMO, perms: S.perms, classesTab: S.classesTab }).bar && showsHomeExtras(S) && <ChallengesCard />}
    <CoachCard nav={nav} doors={doors} />
    <WeightRow S={S} />
  </div>
}
