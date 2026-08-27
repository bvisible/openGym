//// Neoffice — added file (no upstream equivalent): physical assessments.
////
//// The member does not enter these — the coach takes the measurements — but
//// they must be able to read them. An assessment nobody shows is an assessment
//// the member forgets having taken, and the club loses the one thing that
//// makes its follow-up visible.
////
//// The screen shows the LATEST assessment large, then the previous ones
//// folded away: what a member wants on opening is where they stand today, not
//// the full history of their skinfolds.

import { useEffect, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { assessmentsMine, goalsMine } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

//// Neoffice — the summary is composed HERE, not on the server.
//// It used to be built there, and came out in English for a French-speaking
//// member: a sentence written at save time is frozen in the language of
//// whoever saved. The server sends the FACTS — which tests moved most, by how
//// much, and whether that is progress — and the logbook writes the sentence.
//// (Same fix as batch 3 on the summary of a coach's program.)
export function summaryOf(a) {
  if (!a) return ''
  if (!a.compared) return t('First assessment — nothing to compare yet.')
  if (!a.highlights || !a.highlights.length) return t('No change since the previous assessment.')
  const parts = a.highlights.map(h =>
    `${h.improved ? '✓' : '·'} ${t(h.test)} ${h.delta > 0 ? '↑' : '↓'} ${Math.abs(h.delta)}${h.unit || ''}`
  )
  return parts.join(' · ') + ' — ' + t('{0} improved', a.improvedCount)
}

const fmtDate = iso => new Date(iso).toLocaleDateString(dateLocale(), {
  day: 'numeric', month: 'long', year: 'numeric'
})

export default function Assessments() {
  const [list, setList] = useState(null)
  const [goals, setGoals] = useState([])
  const [open, setOpen] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    assessmentsMine().then(setList).catch(() => setError(true))
    //// Goals load separately: they mean something on their own even when no
    //// assessment exists yet — a member can aim at a weight from the day they
    //// join, before the coach has measured them.
    goalsMine().then(g => setGoals(Array.isArray(g) ? g : [])).catch(() => {})
  }, [])

  if (error) return <Shell><div className="card">{t('Your assessments could not be loaded.')}</div></Shell>
  if (!list) return <Shell><div className="card muted">{t('Loading…')}</div></Shell>
  if (!list.length && !goals.length) {
    return <Shell>
      <div className="card muted" style={{ lineHeight: 1.5 }}>
        {t('No assessment yet. Your coach measures them — ask at your next session.')}
      </div>
    </Shell>
  }

  const [latest, ...older] = list
  return <Shell>
    <Goals goals={goals} />
    {latest && <Assessment a={latest} expanded />}
    {older.length > 0 && <>
      <h4 className="sec">{t('Earlier')}</h4>
      {older.map(a => <div key={a.id} className="card" style={{ cursor: 'pointer' }}
        onClick={() => setOpen(open === a.id ? null : a.id)}>
        <div className="row between">
          <div>
            <div className="tt">{fmtDate(a.date)}</div>
            <div className="small dim">{summaryOf(a)}</div>
          </div>
          <Icon name={open === a.id ? 'chevronUp' : 'chevronRight'} className="chev" />
        </div>
        {open === a.id && <div style={{ marginTop: 12 }}><Rows results={a.results} /></div>}
      </div>)}
    </>}
  </Shell>
}

//// Neoffice — what the member is aiming at.
//// Above the measurements, because a goal gives meaning to what follows:
//// "23.4% body fat" says nothing on its own, "23.4% against a 20% goal" says
//// where you stand.
function Goals({ goals }) {
  if (!goals || !goals.length) return null
  return <div className="card">
    <div className="lbl2" style={{ marginBottom: 10 }}>{t('Your goals')}</div>
    {goals.map(g => {
      const pct = Math.max(0, Math.min(100, Math.round(g.progress || 0)))
      return <div key={g.id} style={{ padding: '6px 0' }}>
        <div className="row between" style={{ gap: 12, minWidth: 0 }}>
          <div className="small" style={{ minWidth: 0, flex: 1 }}>
            {t(g.test)}
            {g.reached ? <span className="tag acc" style={{ marginLeft: 7 }}>{t('reached')}</span> : null}
          </div>
          <div className="small" style={{ whiteSpace: 'nowrap' }}>
            <b>{g.current != null ? g.current : '—'}</b>
            <span className="dim"> / {g.target}{g.unit}</span>
          </div>
        </div>
        {/* The bar is there to be read at a glance: a written percentage asks
            for a mental subtraction, a bar does not. */}
        <div className="goalbar"><i style={{ width: pct + '%' }} /></div>
        {g.due && !g.reached
          ? <div className="small dim" style={{ marginTop: 3 }}>{t('by {0}', fmtDate(g.due))}</div>
          : null}
      </div>
    })}
  </div>
}

function Shell({ children }) {
  return <div className="narrow">
    <div className="hdr">
      <div>
        <h1>{t('Assessments')}</h1>
        <div className="sub">{t('What your coach measured, and what changed')}</div>
      </div>
    </div>
    {children}
  </div>
}

function Assessment({ a }) {
  return <div className="card">
    <div className="row between" style={{ marginBottom: 4 }}>
      <div className="lbl2">{fmtDate(a.date)}</div>
      {a.coach ? <span className="small dim">{a.coach}</span> : null}
    </div>
    <div className="small dim" style={{ marginBottom: 12, lineHeight: 1.4 }}>{summaryOf(a)}</div>
    <Rows results={a.results} />
  </div>
}

function Rows({ results }) {
  if (!results || !results.length) return <div className="small dim">{t('Nothing recorded.')}</div>
  return <div>
    {results.map(r => {
      //// The arrow gives the DIRECTION of the change, the colour says whether
      //// that is good news. The two do not coincide: losing 3% body fat goes
      //// down and is progress, losing 500g of lean mass goes down too and is
      //// not.
      //// A ZERO difference is not displayed. "↓ 0" reads as a drop of zero,
      //// which is not a thing; the measurement simply did not move, and an
      //// empty column says that better than a sign.
      const moved = r.delta != null && r.delta !== 0
      const arrow = moved ? (r.delta > 0 ? '↑' : '↓') : null
      const tone = r.improved ? 'acc' : 'warn'
      return <div key={r.test} className="row between" style={{ padding: '7px 0', gap: 12, minWidth: 0 }}>
        <div className="small" style={{ minWidth: 0, flex: 1 }}>{t(r.test)}</div>
        <div className="row" style={{ gap: 8, whiteSpace: 'nowrap' }}>
          <b>{r.value}<span className="small dim"> {r.unit}</span></b>
          {moved && <span className={'small ' + tone}>
            {arrow} {Math.abs(r.delta)}
          </span>}
        </div>
      </div>
    })}
  </div>
}
