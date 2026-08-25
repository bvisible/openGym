//// Neoffice — added file (no upstream equivalent) : les défis du club.
////
//// LA RÈGLE QUI GOUVERNE CET ÉCRAN : un classement dit à quelle fréquence
//// quelqu'un s'entraîne et combien il soulève. Ce sont des données de santé au
//// sens de la LPD. Le membre y entre parce qu'il l'a CHOISI — jamais parce que
//// le club l'a inscrit — et il ne voit le classement que d'un défi qu'il a
//// rejoint. On ne charge donc pas le classement avec la liste : on le demande
//// quand il l'ouvre, et le serveur refuse s'il n'y est pas.
////
//// Ce que cet écran ne fait PAS : montrer les scores de ceux qui n'ont rien
//// signé, ni classer tout le club « pour voir ». Un défi sans participant est
//// un défi vide, pas un défi qui classe tout le monde d'office.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t, dateLocale } from '../lib/i18n.js'
import { challengesMine, challengeJoin, challengeLeave, challengeBoard } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const day = iso => iso
  ? new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'short' })
  : ''

// Ce que la métrique compte, dit dans la langue du membre. Le serveur envoie
// la clé, pas la phrase : traduire côté serveur donnerait la langue du CRON à
// qui n'a pas de langue, piège déjà payé deux fois sur ce module.
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
        {/* Une clé à part pour la première place : « 1e » n'existe pas en
            français, et l'ordinal ne se fabrique pas de la même façon d'une
            langue à l'autre. Le choix appartient donc à la traduction. */}
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

// Un volume s'écrit en kilos, des minutes en minutes, un nombre de séances tout
// court. Le même nombre brut partout laisserait croire à « 1200 séances ».
function fmtScore(metric, score) {
  const n = Math.round(score || 0)
  if (metric === 'Weight Moved') return t('{0} kg', n.toLocaleString(dateLocale()))
  if (metric === 'Active Minutes') return t('{0} min', n)
  return n
}
