//// Neoffice — added file (no upstream equivalent) : les évaluations physiques.
////
//// Le membre ne les saisit pas — c'est le coach qui mesure — mais il doit
//// pouvoir les lire. Une évaluation qu'on ne montre pas est une évaluation que
//// le membre oublie avoir passée, et le club perd la seule chose qui rende son
//// suivi visible.
////
//// L'écran montre la DERNIÈRE évaluation en grand, puis les précédentes
//// repliées : ce qu'un membre veut savoir en ouvrant, c'est où il en est
//// aujourd'hui, pas l'historique complet de ses plis cutanés.

import { useEffect, useState } from 'react'
import { t, dateLocale } from '../lib/i18n.js'
import { assessmentsMine } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

const fmtDate = iso => new Date(iso).toLocaleDateString(dateLocale(), {
  day: 'numeric', month: 'long', year: 'numeric'
})

export default function Assessments() {
  const [list, setList] = useState(null)
  const [open, setOpen] = useState(null)
  const [error, setError] = useState(false)

  useEffect(() => {
    assessmentsMine().then(setList).catch(() => setError(true))
  }, [])

  if (error) return <Shell><div className="card">{t('Your assessments could not be loaded.')}</div></Shell>
  if (!list) return <Shell><div className="card muted">{t('Loading…')}</div></Shell>
  if (!list.length) {
    return <Shell>
      <div className="card muted" style={{ lineHeight: 1.5 }}>
        {t('No assessment yet. Your coach measures them — ask at your next session.')}
      </div>
    </Shell>
  }

  const [latest, ...older] = list
  return <Shell>
    <Assessment a={latest} expanded />
    {older.length > 0 && <>
      <h4 className="sec">{t('Earlier')}</h4>
      {older.map(a => <div key={a.id} className="card" style={{ cursor: 'pointer' }}
        onClick={() => setOpen(open === a.id ? null : a.id)}>
        <div className="row between">
          <div>
            <div className="tt">{fmtDate(a.date)}</div>
            <div className="small dim">{a.summary}</div>
          </div>
          <Icon name={open === a.id ? 'chevronUp' : 'chevronRight'} className="chev" />
        </div>
        {open === a.id && <div style={{ marginTop: 12 }}><Rows results={a.results} /></div>}
      </div>)}
    </>}
  </Shell>
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
    {a.summary ? <div className="small dim" style={{ marginBottom: 12, lineHeight: 1.4 }}>{a.summary}</div> : null}
    <Rows results={a.results} />
  </div>
}

function Rows({ results }) {
  if (!results || !results.length) return <div className="small dim">{t('Nothing recorded.')}</div>
  return <div>
    {results.map(r => {
      //// La flèche dit le SENS de la variation, la couleur dit si c'est une
      //// bonne nouvelle. Les deux ne coïncident pas : perdre 3 % de masse
      //// grasse descend et c'est un progrès, perdre 500 g de masse maigre
      //// descend aussi et ce n'en est pas un.
      const arrow = r.delta == null ? null : r.delta > 0 ? '↑' : '↓'
      const tone = r.delta == null ? 'dim' : r.improved ? 'acc' : 'warn'
      return <div key={r.test} className="row between" style={{ padding: '7px 0', gap: 12, minWidth: 0 }}>
        <div className="small" style={{ minWidth: 0, flex: 1 }}>{r.test}</div>
        <div className="row" style={{ gap: 8, whiteSpace: 'nowrap' }}>
          <b>{r.value}<span className="small dim"> {r.unit}</span></b>
          {r.delta != null && <span className={'small ' + tone}>
            {arrow} {Math.abs(r.delta)}
          </span>}
        </div>
      </div>
    })}
  </div>
}
