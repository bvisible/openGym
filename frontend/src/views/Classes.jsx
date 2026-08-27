//// Neoffice — added file (no upstream equivalent): group classes.
////
//// None of the business logic is here. Booking's Slot mode already handles
//// capacity, recurring sessions, attendance, waitlist and coach
//// substitution. This screen is a FRONT DOOR — and that's where the
//// integration pays off: the member is ALREADY signed in. They open the
//// journal, they see the schedule, they sign up in two taps. No account to
//// create, no second password, no switching to another site.
////
//// IT'S REACHED BY TWO PATHS, and that's intentional: the home screen's
//// card, which shows the next class without having to go look for it, and a
//// TAB in the bottom bar (2026-08-25, Jérémy's request) — home first,
//// classes right after, and the account all the way on the right.
////
//// This comment used to say the opposite: "a sixth tab would make the
//// labels unreadable". Measured since then, rather than assumed: at seven
//// columns on an iPhone SE (320 px, the narrowest), each tab gets 45 px and
//// ONLY "Group classes" overflowed. Hence two keys — the tab says
//// "Classes", the screen's title says "Group classes".
////
//// The tab depends on TWO conditions: the club offers classes, and the
//// member wants to see it (setting `classesTab`, Settings → General).

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { classesWeek, classBook, classCancel } from '../lib/api.js'
import { classSheet, paySheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const dayKey = iso => (iso || '').slice(0, 10)

//// Neoffice — a class you CAN still take. Paid counts as open: the member
//// has the choice, they'll just need to pull out their card. Counting only
//// the free ones would show "nothing open" to someone with three classes
//// ahead of them.
//// At module level and not inside the component: the day picker also uses
//// this for its dots, and two definitions would drift apart on the first
//// change.
const takeable = x => !x.booked && !x.past
  && x.bookable !== false

//// A price reads "28.–", not "28" or "28.00". Decimals only show up when
//// they exist: a class at 28.50 deserves them, a class at 28 doesn't.
const fmtPrice = n => Number(n) % 1 === 0
  ? String(Number(n))
  : Number(n).toFixed(2)

export default function Classes() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  //// Neoffice — the day being viewed. Empty at first: we settle on the
  //// first day of the schedule that isn't in the past, not on a hardcoded date.
  const [picked, setPicked] = useState('')

  const load = () => {
    classesWeek()
      .then(setData)
      .catch(() => setError(t('The class schedule could not be loaded. Try again once you are back online.')))
  }
  useEffect(load, [])

  // A club that hasn't turned on classes has no business being here — and
  // if we land here via a URL, we leave rather than show an empty page.
  useEffect(() => {
    if (S.perms && S.perms.classes === false) nav('/home', { replace: true })
  }, [S.perms])

  //// Neoffice — the `catch` was missing, and this is what the member saw:
  //// NOTHING. A sign-up rejected by the server left the screen identical —
  //// same button, same counter — because the rejected promise skipped the
  //// reload without anyone announcing it. A refusal must be voiced: the
  //// server already explains why (past class, full, paid service), it's
  //// just a matter of carrying its message onto the screen.
  const act = async (fn, id) => {
    setBusy(id)
    try {
      await fn()
      load()
    } catch (e) {
      useUI.getState().toast(e?.message || t('That did not go through. Try again in a moment.'))
    } finally { setBusy(null) }
  }

  if (error) return <div className="narrow"><Hdr /><div className="card">{error}</div></div>
  if (!data) return <div className="narrow"><Hdr /><div className="card muted">{t('Loading…')}</div></div>
  if (!data.sessions.length) {
    return <div className="narrow"><Hdr />
      <div className="card muted" style={{ lineHeight: 1.5 }}>
        {t('No class published for the next {0} days.', data.horizon)}
      </div></div>
  }

  //// Neoffice — grouped by day, and only ONE is shown. A room's schedule is
  //// read day by day: you're looking for "what's on Tuesday", not the
  //// fourteenth class in a scrolling list. The picker carries a dot under
  //// every day that has classes, so you can see at a glance where to look
  //// before you even pick one.
  const byDay = new Map()
  data.sessions.forEach(s => {
    const k = dayKey(s.start)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k).push(s)
  })
  const days = [...byDay.keys()].sort()

  //// The chosen day must exist in the schedule, otherwise a member who
  //// leaves the screen open until midnight ends up facing an empty day.
  ////
  //// And on open we settle on the first day where there's still SOMETHING
  //// TO TAKE, not on today: landing on an empty day forces you to go
  //// hunting for the classes yourself, which is precisely the chore this
  //// picker is meant to remove. Failing that, the first day coming up — a
  //// fully-booked schedule is still a schedule worth checking.
  const openOn = d => (byDay.get(d) || []).some(takeable)
  const day = days.includes(picked) ? picked
    : days.find(d => d >= todayKey() && openOn(d))
      || days.find(d => d >= todayKey())
      || days[0]

  const items = byDay.get(day) || []
  const free = items.filter(takeable).length

  return <div className="narrow">
    <Hdr />

    <div className="card" style={{ padding: '10px 8px 8px' }}>
      <DayPicker days={days} day={day} byDay={byDay} onPick={setPicked} />
    </div>

    {/* //// The chosen day, large. It used to be a grey `h4
         className="sec"` lost between two lists — on a schedule you want to
         know FIRST which day you're looking at. */}
    <div className="hdr" style={{ marginTop: 18, marginBottom: 10, alignItems: 'baseline' }}>
      <div>
        <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{longDay(day)}</h2>
        <div className="sub" style={{ marginTop: 2 }}>
          {free > 0
            ? t(free === 1 ? '{0} class open' : '{0} classes open', free)
            : t('nothing open that day')}
        </div>
      </div>
    </div>

    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(s => <ClassRow key={s.id} s={s} busy={busy === s.id} act={act} />)}
    </div>
  </div>
}

//// Neoffice — added: the day picker.
////
//// It SCROLLS rather than paginating by week — a club's schedule often
//// spans two weeks, and pagination loses the thread of what you were
//// looking for. The arrows nudge the strip one notch; a finger does the
//// same thing on a phone.
////
//// The MONTH is written above, and it changes as you scroll: "Thu 3" on
//// its own doesn't say whether it's September or October, and that's
//// exactly what you need to know when booking two weeks out.
function DayPicker({ days, day, byDay, onPick }) {
  const strip = useRef(null)
  //// Neoffice — we store the displayed DAY, not its formatted label.
  //// Keeping the already-formatted sentence froze it in whatever language
  //// was current at the time: the translation bundle arrives after this
  //// first calculation, and the header would stay stuck on "August 2026"
  //// above days written "Mar. / Mer. / Jeu.". Formatting at render time
  //// follows the language without having to subscribe to it.
  const [monthDay, setMonthDay] = useState('')

  //// The displayed month is that of the FIRST visible day, not that of the
  //// chosen day: you read the header to know where you're currently
  //// looking, not where you stopped.
  const refreshMonth = () => {
    const el = strip.current
    if (!el) return
    const left = el.scrollLeft
    let best = days[0]
    for (const child of el.children) {
      if (child.offsetLeft + child.offsetWidth > left + 2) { best = child.dataset.day; break }
    }
    if (best) setMonthDay(best)
  }
  useEffect(() => { refreshMonth() }, [days.join(',')])

  const push = dir => {
    const el = strip.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 140), behavior: 'smooth' })
    setTimeout(refreshMonth, 320)
  }

  return <>
    <div className="row between" style={{ marginBottom: 6, paddingInline: 2 }}>
      <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 14 }}
        onClick={() => push(-1)} aria-label={t('Earlier')}><Icon name="chevronLeft" /></button>
      <div className="small muted" style={{ fontWeight: 500, textTransform: 'capitalize' }}>{monthLabel(monthDay || days[0])}</div>
      <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 14 }}
        onClick={() => push(1)} aria-label={t('Later')}><Icon name="chevronRight" /></button>
    </div>
    <div className="daypick" ref={strip} onScroll={refreshMonth}>
      {days.map(d => {
        const n = (byDay.get(d) || []).filter(takeable).length
        const dt = new Date(d + 'T00:00:00')
        return <button key={d} data-day={d} className={'wday' + (d === day ? ' today' : '')} onClick={() => onPick(d)}>
          <div className="lbl">{dt.toLocaleDateString(dateLocale(), { weekday: 'short' })}</div>
          <div className="num">{dt.getDate()}</div>
          {/* A dot when there's still something to take that day: that's
              what saves you from opening each day one by one. */}
          <div className={'dot' + (n ? ' plan' : '')} />
        </button>
      })}
    </div>
  </>
}

const monthLabel = k => new Date(k + 'T00:00:00').toLocaleDateString(dateLocale(),
  { month: 'long', year: 'numeric' })

const todayKey = () => new Date().toISOString().slice(0, 10)
const longDay = k => new Date(k + 'T00:00:00').toLocaleDateString(dateLocale(),
  { weekday: 'long', day: 'numeric', month: 'long' })

function Hdr() {
  return <div className="hdr">
    {/* //// Neoffice — the TITLE says "group classes", the TAB says
         "classes": seven columns leave no room for two words, and upstream
         uses the same key for both — it only has short titles. Two keys,
         then, one per use. */}
    <div><h1>{t('Group classes')}</h1><div className="sub">{t('Book in two taps — you are already signed in')}</div></div>
  </div>
}

function ClassRow({ s, busy, act }) {
  const time = s.start ? new Date(s.start).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
  const waiting = s.booking && s.booking.status === 'Waiting'

  // What the row says when you CAN'T sign up matters as much as the button:
  // "full" and nothing else makes the member close the app.
  const state = s.booked
    ? (waiting ? t('on the waiting list') : t('you are in'))
    : s.full ? t('full — you can join the waiting list')
    //// Neoffice — one form per count: "noch 1 Plätze frei" in German,
    //// "1 place left" in English. The journal already makes this
    //// distinction elsewhere ({0} routine / {0} routines) — a class's last
    //// spot is exactly the moment the member reads this line.
    //// Neoffice — free spots aren't enough: the server cross-checks against
    //// real availability (opening hours, gaps between classes, instructor
    //// booked elsewhere). A session that's happening but can no longer be
    //// booked STAYS ON THE SCHEDULE — the member wants to know it exists —
    //// but it no longer invites signing up.
    //// Neoffice — a PAID class isn't a closed class. The member used to see
    //// "registration closed" on a class they could very well take, simply
    //// by paying — and they knew neither that it was paid, nor how much.
    //// The price is stated before the click, not after.
    : s.included === false && s.bookable !== false
      ? (s.price ? t('{0} {1} — pay to book', fmtPrice(s.price), s.currency || '') : t('paid class'))
    : s.bookable === false ? t('registration closed')
    : t(s.free === 1 ? '{0} place left' : '{0} places left', s.free)

  //// Neoffice — the whole row opens the card, including for a closed
  //// class: that's exactly where you want to know what you missed and when
  //// it comes around again. The button, on the other hand, keeps its own
  //// action — a click on it signs you up, it doesn't open the card.
  return <div className="item" style={{ cursor: 'pointer' }} onClick={() => classSheet(s, act)}>
    <span className="lrow-i" style={{ background: s.booked ? 'var(--acc)' : 'var(--surface-3)' }}>
      <Icon name={s.booked ? 'check' : 'calendar'} />
    </span>
    <div className="grow" style={{ minWidth: 0 }}>
      <div className="tt">{time} · {s.title}</div>
      <div className="small dim">{s.coach ? s.coach + ' · ' : ''}{state}</div>
    </div>
    {s.past ? <span className="tag">{t('done')}</span>
      : s.booked
        //// Neoffice — `waiting` rather than just `disabled`: a button
        //// that's merely greyed out doesn't say whether the app registered the click.
        ? <Button size="sm" variant="ghost" disabled={busy} className={busy ? 'waiting' : ''}
            onClick={e => { e.stopPropagation(); act(() => classCancel(s.booking.id), s.id) }}>{t('Cancel')}</Button>
        : (s.included === false && s.bookable !== false && !s.past)
          ? <Button size="sm" variant="tinted"
              //// Neoffice — the payment sheet, not the shop. The
              //// `stopPropagation` stays: a click on the ROW opens the
              //// class's card, one on the button goes straight to payment.
              //// The reload goes through `act`: it's the one that has
              //// `load()` in scope. Calling `load` here was crashing the
              //// row — `ReferenceError`, and the button did nothing at all.
              onClick={e => { e.stopPropagation(); paySheet(s, () => act(() => Promise.resolve(), s.id)) }}>
              {t('Book and pay')}
            </Button>
        : (s.bookable === false && !s.full)
          //// No button, and no false hope: the session is happening, it's
          //// just no longer open. Offering "sign up" here used to be the
          //// click that did nothing.
          ? <span className="tag">{t('closed')}</span>
          : <Button size="sm" variant={s.full ? 'ghost' : 'tinted'} disabled={busy}
              className={busy ? 'waiting' : ''}
              onClick={e => { e.stopPropagation(); act(() => classBook(s.id), s.id) }}>
              {s.full ? t('Waiting list') : t('Book')}
            </Button>}
  </div>
}
