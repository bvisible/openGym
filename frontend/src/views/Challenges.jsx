//// Neoffice — added file (no upstream equivalent): the club's challenges.
////
//// THE RULE THAT GOVERNS THIS SCREEN: a leaderboard tells how often somebody
//// trains and how much they lift. That is health data under Swiss data
//// protection law. A member joins because they CHOSE to — never because the
//// club signed them up — and they only see the leaderboard of a challenge they
//// joined. So we do not load the leaderboard with the list: we ask for it when
//// they open it, and the server refuses if they are not in.
////
//// What this screen does NOT do: show the scores of people who never opted in,
//// or rank the whole club "just to see". A challenge with no participant is an
//// empty challenge, not a challenge that ranks everyone by default.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, dateLocale } from '../lib/i18n.js'
import { challengesMine, challengeJoin, challengeLeave, challengeBoard } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const day = iso => iso
  ? new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
  : ''

// What the metric counts, said in the member's language. The server sends the
// key, not the sentence: translating server-side would hand the CRON's language
// to whoever has none — a trap this module has already paid for twice.
const METRIC = {
  'Workout Count': () => t('Number of workouts'),
  'Weight Moved': () => t('Total weight moved'),
  'Active Minutes': () => t('Minutes trained'),
  'Class Attendance': () => t('Classes attended'),
}

export default function Challenges() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [board, setBoard] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    challengesMine()
      .then(setData)
      .catch(() => setError(t('The challenges could not be loaded. Try again once you are back online.')))
  }
  useEffect(load, [])

  const act = async (fn, id) => {
    setBusy(id)
    try {
      await fn()
      setBoard(null)
      load()
    } finally { setBusy(null) }
  }

  const open = async (c) => {
    setBusy(c.name)
    try {
      setBoard(await challengeBoard(c.name))
    } catch (e) {
      // Un refus du serveur n'est pas une panne : il dit qu'on n'a pas rejoint.
      setBoard(null)
    } finally { setBusy(null) }
  }

  if (error) return <div className="narrow"><Hdr nav={nav} /><div className="card">{error}</div></div>
  if (!data) return <div className="narrow"><Hdr nav={nav} /><div className="card muted">{t('Loading…')}</div></div>

  if (!data.challenges.length) {
    return <div className="narrow"><Hdr nav={nav} />
      <div className="empty">
        <div className="ico"><Icon name="trophy" /></div>
        {t('No challenge running right now.')}
      </div>
    </div>
  }

  return <div className="narrow">
    <Hdr nav={nav} />
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {data.challenges.map(c => (
        <Row key={c.name} c={c} busy={busy === c.name} act={act} open={open} />
      ))}
    </div>
    {board && <Board board={board} close={() => setBoard(null)} />}
  </div>
}

function Hdr({ nav }) {
  return <div className="hdr">
    <div>
      <h1>{t('Challenges')}</h1>
      <div className="sub">{t('Take part if you want to — you choose')}</div>
    </div>
  </div>
}

function Row({ c, busy, act, open }) {
  const label = (METRIC[c.metric] || METRIC['Workout Count'])()
  return <div className="item" style={{ alignItems: 'flex-start' }}>
    <span className="lrow-i"><Icon name="trophy" /></span>
    <div className="grow">
      <div className="tt">{c.title}</div>
      <div className="ss">
        {day(c.starts_on)} – {day(c.ends_on)} · {label}
        {/* Le NOMBRE de participants n'expose personne — les noms, si. */}
        {c.participants > 0 && ' · ' + t(c.participants === 1
          ? '{0} person taking part' : '{0} people taking part', c.participants)}
      </div>
      {c.description && <div className="ss" style={{ marginTop: 4 }}>{c.description}</div>}
      {c.joined && c.rank && <div className="ss" style={{ marginTop: 4 }}>
        {/* A separate key for first place: French has no "1e", and ordinals
            are not built the same way from one language to the next. The choice
            therefore belongs to the translation. */}
        <b>{c.rank === 1 ? t('You are 1st of {0}', c.of) : t('You are {0} of {1}', c.rank, c.of)}</b>
      </div>}
      {!c.running && <div className="ss" style={{ marginTop: 4 }}>{t('Starts {0}', day(c.starts_on))}</div>}
    </div>
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      {c.joined
        ? <>
            <Button size="sm" variant="tinted" disabled={busy} onClick={() => open(c)}>{t('Ranking')}</Button>
            <Button size="sm" variant="ghost" disabled={busy}
              onClick={() => act(() => challengeLeave(c.name), c.name)}>{t('Leave')}</Button>
          </>
        : <Button size="sm" disabled={busy}
            onClick={() => act(() => challengeJoin(c.name), c.name)}>{t('Take part')}</Button>}
    </div>
  </div>
}

function Board({ board, close }) {
  return <div className="card" style={{ marginTop: 14 }}>
    <div className="row between" style={{ marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{board.title}</h4>
      <Button size="sm" variant="ghost" onClick={close}>{t('Close')}</Button>
    </div>
    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {board.rows.map(r => <div key={r.member} className="item">
        <span className="lrow-i" style={{ fontWeight: 600 }}>{r.rank}</span>
        <div className="grow"><div className="tt">{r.name}</div></div>
        <div className="ss">{fmtScore(board.metric, r.score)}</div>
      </div>)}
    </div>
  </div>
}

// A volume is written in kilos, minutes in minutes, a session count plain. The
// same raw number everywhere would read as "1200 sessions".
function fmtScore(metric, score) {
  const n = Math.round(score || 0)
  if (metric === 'Weight Moved') return t('{0} kg', n.toLocaleString(dateLocale()))
  if (metric === 'Active Minutes') return t('{0} min', n)
  return n
}
