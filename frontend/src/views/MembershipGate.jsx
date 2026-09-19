//// Neoffice — added file (no upstream equivalent).
////
//// The journal's front door. When the club gates on a valid membership
//// (Gym Settings) and this member has none, the boot says so
//// (`BOOT.membership.blocked`) and App.jsx renders this instead of the
//// journal: the club's message, the plan that ended and when, how to reach
//// the club — and, when the club allows it, the renewal signed right here:
//// the terms, a checkbox, a signature, and the membership restarts.
//// Asked by the pilot club on 2026-09-09.
import React, { useState } from 'react'
import { BOOT, logout } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
//// Neoffice — the terms, the checkbox and the signature now live in one
//// place: the member also signs from « Mon abonnement », before their
//// membership runs out. See components/RenewalForm.jsx.
import RenewalForm from '../components/RenewalForm.jsx'

const fmtDate = iso => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(undefined, { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}
const fmtPlan = p => {
  if (!p) return ''
  const price = p.cost != null && p.currency ? `${p.cost} ${p.currency}` : ''
  return [p.label, price].filter(Boolean).join(' · ')
}

export default function MembershipGate() {
  const m = BOOT.membership || {}
  const [mode, setMode] = useState('gate')      // gate | renew | done
  const [result, setResult] = useState(null)

  const signOut = async () => {
    try { await logout() } catch { /* the cookie may already be gone */ }
    useStore.getState().clearLocal()
    window.location.href = '/gym'
  }

  return <div className="signin gate">
    {BOOT.app_logo
      ? <img className="signin-logo" src={BOOT.app_logo} alt={BOOT.app_title || ''} />
      : <div className="signin-mark">
        {BOOT.app_icon ? <img src={BOOT.app_icon} alt="" /> : <Icon name="dumbbell" />}
      </div>}
    <h1>{BOOT.app_title || t('Fitness')}</h1>

    {mode === 'gate' && <>
      <div className="gate-lock"><Icon name="lock" /></div>
      <p className="sub gate-msg">{m.message || t('To use the app, you need a valid membership.')}</p>
      {m.plan && <p className="gate-line">
        {m.state === 'expired' && m.endsOn
          ? t('Your {0} membership ended on {1}.', fmtPlan(m.plan), fmtDate(m.endsOn))
          : fmtPlan(m.plan)}
      </p>}
      {m.contact && <p className="gate-line gate-contact">{m.contact}</p>}
      <div className="gate-actions">
        {m.renewal?.available && <Button variant="primary" icon="checkCircle" onClick={() => setMode('renew')}>{t('Renew my membership')}</Button>}
        <Button variant="ghost" icon="signOut" onClick={signOut}>{t('Sign out')}</Button>
      </div>
      <p className="gate-who">{BOOT.user?.full_name} · {BOOT.user?.name}</p>
    </>}

    {mode === 'renew' && <RenewalForm
      onDone={r => { setResult(r); setMode('done') }}
      onCancel={() => setMode('gate')} />}

    {mode === 'done' && <>
      <div className="gate-lock gate-ok"><Icon name="checkCircle" /></div>
      <p className="sub">{t('Your membership is renewed.')}</p>
      {result?.endsOn && <p className="gate-line">{t('Valid until {0}.', fmtDate(result.endsOn))}</p>}
      <p className="gate-line">{result?.invoice
        ? t('Your club will hand you the invoice.')
        : t('Your club will get in touch about the invoice.')}</p>
      <div className="gate-actions">
        <Button variant="primary" icon="play" onClick={() => window.location.reload()}>{t('Open my journal')}</Button>
      </div>
    </>}
  </div>
}
