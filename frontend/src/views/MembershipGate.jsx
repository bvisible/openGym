//// Neoffice — added file (no upstream equivalent).
////
//// The journal's front door. When the club gates on a valid membership
//// (Gym Settings) and this member has none, the boot says so
//// (`BOOT.membership.blocked`) and App.jsx renders this instead of the
//// journal: the club's message, the plan that ended and when, how to reach
//// the club — and, when the club allows it, the renewal signed right here:
//// the terms, a checkbox, a signature, and the membership restarts.
//// Asked by the pilot club on 2026-09-09.
import React, { useEffect, useState } from 'react'
import { BOOT, acceptRenewal, logout, renewalOffer } from '../lib/api.js'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import SignaturePad from '../components/SignaturePad.jsx'

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
  const [offer, setOffer] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)
  const [result, setResult] = useState(null)

  useEffect(() => {
    if (mode !== 'renew' || offer) return
    renewalOffer().then(r => setOffer(r.message || r)).catch(e => setError(e.message || String(e)))
  }, [mode, offer])

  const signOut = async () => {
    try { await logout() } catch { /* the cookie may already be gone */ }
    useStore.getState().clearLocal()
    window.location.href = '/gym'
  }

  const renew = async () => {
    setBusy(true); setError(null)
    try {
      const r = await acceptRenewal({ terms_accepted: 1, signature, terms_hash: offer?.termsHash })
      setResult(r.message || r)
      setMode('done')
    } catch (e) {
      setError(e.message || String(e))
    } finally { setBusy(false) }
  }

  const needsSignature = offer ? offer.signatureRequired !== false : true
  const canSign = accepted && (!needsSignature || !!signature) && !busy

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

    {mode === 'renew' && <>
      <p className="sub">{t('Read the terms, accept them and sign: your membership restarts today.')}</p>
      {!offer && !error && <p className="gate-line">{t('Loading…')}</p>}
      {offer && <>
        <div className="card gate-plan">
          <div className="gate-plan-name">{fmtPlan(offer.plan)}</div>
          {offer.endedOn && <div className="small dim">{t('Ended on {0}', fmtDate(offer.endedOn))}</div>}
        </div>
        {offer.terms
          ? <div className="gate-terms" dangerouslySetInnerHTML={{ __html: offer.terms }} />
          : <p className="gate-line">{t('Your club has not written any terms for this membership.')}</p>}
        <label className="gate-accept">
          <input type="checkbox" checked={accepted} onChange={e => setAccepted(e.target.checked)} />
          <span>{t('I have read and I accept the terms of the membership.')}</span>
        </label>
        {needsSignature && <SignaturePad onChange={setSignature} />}
        {error && <p className="gate-error">{error}</p>}
        <div className="gate-actions">
          <Button variant="primary" icon="checkCircle" disabled={!canSign} onClick={renew}>
            {busy ? t('Renewing…') : needsSignature ? t('Sign and renew') : t('Renew')}
          </Button>
          <Button variant="ghost" onClick={() => { setMode('gate'); setError(null) }}>{t('Back')}</Button>
        </div>
      </>}
      {error && !offer && <div className="gate-actions">
        <p className="gate-error">{error}</p>
        <Button variant="ghost" onClick={() => { setMode('gate'); setError(null) }}>{t('Back')}</Button>
      </div>}
    </>}

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
