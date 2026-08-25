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
import { assessmentsMine, goalsMine } from '../lib/api.js'
import Icon from '../components/Icon.jsx'

//// Neoffice — le résumé se compose ICI, pas au serveur.
//// Il y était d'abord, et il sortait en anglais chez un membre francophone :
//// une phrase écrite à la sauvegarde est figée dans la langue de qui a
//// enregistré. Le serveur envoie les FAITS — quels tests ont le plus bougé,
//// de combien, et si c'est un progrès — et le carnet écrit la phrase.
//// (Même correctif qu'au lot 3 sur le résumé du programme d'un coach.)
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
    //// Les objectifs se chargent à part : ils ont leur propre sens même quand
    //// aucune évaluation n'existe encore — un membre peut viser un poids dès
    //// son inscription, avant que le coach ne l'ait mesuré.
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

//// Neoffice — ce que le membre vise.
//// Au-dessus des mesures, parce qu'un objectif donne son sens à ce qui suit :
//// « 23,4 % de masse grasse » ne dit rien seul, « 23,4 % sur un objectif à
//// 20 % » dit où on en est.
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
        {/* La barre est là pour se lire d'un coup d'œil : un pourcentage écrit
            demande une soustraction mentale, une barre non. */}
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
      //// La flèche dit le SENS de la variation, la couleur dit si c'est une
      //// bonne nouvelle. Les deux ne coïncident pas : perdre 3 % de masse
      //// grasse descend et c'est un progrès, perdre 500 g de masse maigre
      //// descend aussi et ce n'en est pas un.
      //// Un écart NUL ne s'affiche pas. « ↓ 0 » se lit comme une baisse de
      //// zéro, ce qui n'est pas une chose ; la mesure n'a simplement pas
      //// bougé, et une colonne vide le dit mieux qu'un signe.
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
