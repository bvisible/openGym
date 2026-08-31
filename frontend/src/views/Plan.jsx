import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, loadStarterPlan, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
//// Neoffice — the cycle week of a periodized program.
import { cycleWeekOf } from '../lib/coach-program.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)

  const addRoutine = () => {
    const r = { id: uid(), name: t('New routine'), emoji: DEFAULT_GLYPH, ex: [] }
    update(s => { s.routines.push(r) })
    nav('/plan/r/' + r.id)
  }

  //// Neoffice — the club decides whether its members touch their own plan.
  //// The setting arrives from the server with the state (S.perms.editPlan);
  //// the LOCK itself is server-side — apply_state drops routines pushed by a
  //// member who is not allowed. Here we hide, and above all we SAY why: a
  //// button that vanishes without explanation reads as a breakage.
  //// Absent = allowed, so that an offline state composed before this field
  //// existed does not lock somebody's plan by accident.
  const mayEdit = S.perms ? S.perms.editPlan !== false : true

  return <>
    <div className="hdr">
      <div><h1>{t('Plan')}</h1><div className="sub">{t('Your weekly routine')}</div></div>
      <button className="iconbtn" onClick={planToolsSheet} aria-label={t('Share your plan')} title={t('Share your plan')}><Icon name="upload" /></button>
    </div>
    {!mayEdit && <div className="card" style={{ padding: '11px 13px', marginBottom: 14, lineHeight: 1.45 }}>
      <div className="small muted">{t('Your coach writes your plan. You can train it and log your sets — the routines themselves are theirs to change.')}</div>
    </div>}
    {/* //// Neoffice — where the member stands in their coach's cycle.
         Without this line, a plan that changes by itself on Monday morning
         reads as a bug: the member sees different sessions and cannot tell
         why. */}
    {S.coachCycle && S.coachCycle.span > 1 && <div className="card" style={{ padding: '10px 13px', marginBottom: 12 }}>
      <div className="row between" style={{ gap: 10 }}>
        <div className="small">{S.coachCycle.name
          ? t('Week {0} of {1} — {2}', cycleWeekOf(S.coachCycle), S.coachCycle.span, S.coachCycle.name)
          : t('Week {0} of {1} of your program', cycleWeekOf(S.coachCycle), S.coachCycle.span)}</div>
        <div className="cyclebar">
          {Array.from({ length: S.coachCycle.span }, (_, i) =>
            <i key={i} className={i + 1 === cycleWeekOf(S.coachCycle) ? 'on' : ''} />)}
        </div>
      </div>
    </div>}
    <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {[1, 2, 3, 4, 5, 6, 0].map(d => {
          const r = S.routines.find(x => x.id === S.week[d])
          //// Neoffice — upstream's tappable() (v1.2.14 touch polish) AND our
          //// mayEdit guard: a club that drives its members' plans must not see
          //// the day sheet open at all. Taking only their line would have
          //// dropped the guard silently — the sheet would open and the member
          //// would edit a plan they are not allowed to touch.
          return <div key={d} className="item"
            {...(mayEdit ? tappable(() => dayAssignSheet(d)) : { style: { cursor: 'default' } })}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            {r ? <span className="tag acc"><Icon name={glyphOf(r.emoji)} />{r.name}</span> : <span className="tag">{t('Rest')}</span>}
            {mayEdit && <Icon name="chevronRight" className="chev" />}</div>
        })}
      </div>
    </div><div>
      <div className="row between" style={{ marginTop: 22, marginBottom: 10 }}>
        <h4 className="sec" style={{ margin: 0 }}>{t('Routines')}</h4>
        {mayEdit && <Button size="sm" variant="tinted" icon="plus" onClick={addRoutine}>{t('New')}</Button>}
      </div>
      {S.routines.length ? <div className="list">{S.routines.map(r => <div key={r.id} className="item" {...tappable(() => nav('/plan/r/' + r.id))}>
        <span className="lrow-i"><Icon name={glyphOf(r.emoji)} /></span>
        <div className="grow"><div className="tt">{r.name}</div><div className="ss">{exCount(r.ex.length)}{r.coachProgramName ? ' · ' + r.coachProgramName : ''}</div></div>
        <Icon name="chevronRight" className="chev" /></div>)}</div> : <>
        <div className="empty"><div className="ico"><Icon name="clipboard" /></div>{t('No routines yet.')}<br />{t('Create one or load the starter plan.')}</div>
        <Button icon="sparkles" onClick={loadStarterPlan}>{t('Load starter plan (Push / Pull / Legs)')}</Button>
      </>}
    </div></div>
  </>
}
