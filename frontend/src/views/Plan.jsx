import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { DAYN, weekOrder, weekStartOf, uid, exCount } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import { dayAssignSheet, dayAddRoutineSheet, starterPlanSheet, planToolsSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'
import { tappable } from '../lib/use-sheet-keyboard.js'
import { glyphOf, DEFAULT_GLYPH } from '../lib/glyphs.js'
//// Neoffice — the cycle week of a periodized program.
import { cycleWeekOf } from '../lib/coach-program.js'
import { DEMO } from '../lib/demo.js'
import { MOBILE } from '../lib/mobile.js'
import { coachAvailable } from '../lib/coach.js'

export default function Plan() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const update = useStore(s => s.update)
  const config = useStore(s => s.config)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const user = useStore(s => s.user)

  /* The Coach's only entry point in the app. Its screens have existed since the UI landed and
     nothing linked to them, so the feature was reachable only by typing the URL — enabled,
     configured, and invisible. The same predicate every other Coach surface uses gates it, so
     an instance without the feature sees exactly the Plan screen it saw before. */
  const showCoach = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })

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
  // Pull one routine off a weekday; drop the key when the day empties (never store []).
  const removeFromDay = (d, rid) => update(s => {
    const next = [].concat(s.week[d] || []).filter(id => id !== rid)
    if (next.length) s.week[d] = next; else delete s.week[d]
  })

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
    {showCoach && <button className="coach-cta" onClick={() => nav('/coach')}>
      <span className="coach-cta-av"><Icon name="sparkles" /></span>
      <span className="coach-cta-t">
        <b>{t('Coach')}</b>
        <span>{t('Plan design and reviews, from your own training')}</span>
      </span>
      <Icon name="chevronRight" className="coach-cta-chev" />
    </button>}

    <div className="cols"><div>
      <h4 className="sec">{t('Week schedule')}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {weekOrder(weekStartOf(S)).map(d => {
          const dayRoutines = [].concat(S.week[d] || []).map(id => S.routines.find(x => x.id === id)).filter(Boolean)
          //// Neoffice — upstream's several-routines-per-day rows AND our mayEdit
          //// guard: a club that drives its members' plans must not see the day
          //// sheet open, nor the remove and add controls. Taking only their
          //// lines would have dropped the guard silently.
          // An empty day stays one tappable row → pick its first routine (today's behaviour).
          if (!dayRoutines.length) return <div key={d} className="item"
            {...(mayEdit ? tappable(() => dayAssignSheet(d)) : { style: { cursor: 'default' } })}>
            <div className="grow"><div className="tt">{t(DAYN[d])}</div></div>
            <span className="tag">{t('Rest')}</span>
            {mayEdit && <Icon name="chevronRight" className="chev" />}</div>
          // A populated day: always-visible routine sub-rows + inline ✕, then ＋ Add routine.
          return <div key={d} className="item" style={{ display: 'block', padding: '10px 14px' }}>
            <div className="row between" style={{ marginBottom: 6 }}>
              <div className="tt">{t(DAYN[d])}</div>
              <div className="small dim">{t('{0} routines', dayRoutines.length)}</div>
            </div>
            {dayRoutines.map(r => <div key={r.id} className="row" style={{ gap: 8, padding: '4px 0 4px 8px' }}>
              <span className="lrow-i" style={{ width: 26, height: 26, fontSize: 14 }}><Icon name={glyphOf(r.emoji)} /></span>
              <div className="grow" style={{ minWidth: 0 }}><div className="tt" style={{ fontSize: 14 }}>{r.name}</div><div className="ss">{exCount(r.ex.length)}</div></div>
              {mayEdit && <button className="iconbtn sm" aria-label={t('Remove')} onClick={() => removeFromDay(d, r.id)}><Icon name="xmark" /></button>}
            </div>)}
            {mayEdit && <button className="btn ghost sm" style={{ marginTop: 4, marginLeft: 8 }} onClick={() => dayAddRoutineSheet(d)}>
              <Icon name="plus" /> {t('Add routine')}
            </button>}
          </div>
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
        <Button icon="sparkles" onClick={starterPlanSheet}>{t('Load starter plan')}</Button>
      </>}
    </div></div>
  </>
}
