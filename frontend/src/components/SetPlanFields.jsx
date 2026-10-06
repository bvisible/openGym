//// Neoffice — added file (no upstream equivalent).
////
//// The exercise config sheet's « different reps per set »: a switch, then one stepper per set.
//// A pyramid (6 · 8 · 10 · 6 · 8) is what a coach prescribes and what the one flat « sets × reps »
//// target could not say. The moves (start, drop, resize, edit) are lib/set-plan.js's, so the
//// sheet only draws them; ExConfig in sheets.jsx owns the draft and calls this in one line.
////
//// Reps only. The loads a coach may have given each set travel with the plan untouched and are
//// read in the line under the steppers; a member sets their own weight, set by set, in the
//// session itself.
import Stepper from './Stepper.jsx'
import { Row, Switch } from './ui.jsx'
import { t } from '../lib/i18n.js'
import { fmtNum } from '../lib/format.js'
import { setPlanOf, setPlanLine, startSetPlan, dropSetPlan, editSetReps } from '../lib/set-plan.js'

export default function SetPlanFields({ c, setC, perSide, bw, unit }) {
  const plan = setPlanOf(c)
  return <>
    <div className="sect-b" style={{ marginBottom: plan ? 10 : 8 }}>
      <Row icon="list" iconTint="var(--acc)" title={t('Different reps per set')}
        subtitle={plan ? t('Each set has its own target; add or remove sets with the Sets control above.') : t('A pyramid, a ramp: one target for each set.')}>
        <Switch checked={!!plan} onChange={v => setC(x => (v ? startSetPlan(x) : dropSetPlan(x)))} />
      </Row>
    </div>
    {plan && <>
      {/* `cfgrow-4` wraps the steppers into pairs on a phone, where five abreast left the inputs a few px wide. */}
      <div className="row cfgrow cfgrow-4" style={{ marginBottom: 8 }}>
        {plan.map((p, i) => <Stepper key={i} label={t('Set {0}', i + 1)} value={p.r} step={perSide ? 2 : 1} decimal={false}
          onChange={v => setC(x => editSetReps(x, i, v))} />)}
      </div>
      <div className="small dim" style={{ marginBottom: 18 }}>
        {setPlanLine(plan, { weight: c.weight, bodyweight: bw, unit, fmt: fmtNum })}
      </div>
    </>}
  </>
}
