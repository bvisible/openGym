//// Neoffice — added file (no upstream equivalent).
////
//// SIGNER SON RENOUVELLEMENT — les conditions, la case, la signature.
////
//// Extracted from views/MembershipGate.jsx because the same act now happens
//// in two places: at the front door when the club gates on a valid
//// membership, and from « Mon abonnement » when the member wants to say yes
//// BEFORE their membership runs out (Jérémy, 19.09: *"quoi qu'il arrive il
//// faut que le gars puisse renouveler son abonnement"*).
////
//// One form, two frames: the gate renders it full-screen and reloads the app
//// afterwards, the membership screen renders it in a sheet and then offers to
//// pay. What is signed, and what it takes to sign, is written once.
import { useEffect, useState } from 'react'
import { acceptRenewal, renewalOffer } from '../lib/api.js'
import { t, dateLocale } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import SignaturePad from './SignaturePad.jsx'

const fmtDate = iso => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}
const fmtPlan = p => {
  if (!p) return ''
  const price = p.cost != null && p.currency ? `${p.cost} ${p.currency}` : ''
  return [p.label, price].filter(Boolean).join(' · ')
}
//// Neoffice — what a yes would open, said for the plan on screen (maintenance#936). The sheet used to show
//// the date the CURRENT membership ends beside the plan, and the pilot club's member read « it ends the day it
//// begins ». The server now answers, per plan, when the new period starts (`startsOn`), and either when it
//// ends (`endsOn`) or that it carries on by itself (`rollsOn`), with the very dates the restart will use.
const localToday = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
const startsLine = p => !p?.startsOn ? '' : p.startsOn === localToday() ? t('Starts today') : t('Starts on {0}', fmtDate(p.startsOn))
const endsLine = p => !p?.startsOn ? '' : p.rollsOn ? t('Then it renews by itself, period after period.') : p.endsOn ? t('Until {0}', fmtDate(p.endsOn)) : ''

export default function RenewalForm({ onDone, onCancel }) {
  const [offer, setOffer] = useState(null)
  const [choice, setChoice] = useState(null)
  const [accepted, setAccepted] = useState(false)
  const [signature, setSignature] = useState(null)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState(null)

  useEffect(() => {
    let alive = true
    renewalOffer()
      .then(r => { if (alive) setOffer(r.message || r) })
      .catch(e => { if (alive) setError(e.message || String(e)) })
    return () => { alive = false }
  }, [])

  const needsSignature = offer ? offer.signatureRequired !== false : true
  const canSign = accepted && (!needsSignature || !!signature) && !busy
  //// Neoffice — the plans the member may renew onto: their own first, then the ones the club offers. A server that
  //// predates the choice sends none, and the sheet stays what it was.
  const plans = offer?.plans || []
  const picked = plans.find(p => p.name === choice) || plans.find(p => p.current) || plans[0] || null

  const sign = async () => {
    setBusy(true); setError(null)
    try {
      const r = await acceptRenewal({ terms_accepted: 1, signature, terms_hash: offer?.termsHash, ...(plans.length > 1 ? { plan: picked.name } : {}) })
      onDone && onDone(r.message || r)
    } catch (e) {
      setError(e.message || String(e))
    } finally { setBusy(false) }
  }

  if (!offer && !error) return <p className="gate-line">{t('Loading…')}</p>
  if (!offer) return <div className="gate-actions">
    <p className="gate-error">{error}</p>
    {onCancel && <Button variant="ghost" onClick={onCancel}>{t('Back')}</Button>}
  </div>

  return <>
    {/* Why we are here, in the member's own situation: their membership has
        ended, or it is about to and will not restart on its own. */}
    <p className="sub">{offer.why === 'ending'
      ? t('Read the terms, accept them and sign: your membership carries on without a break.')
      : t('Read the terms, accept them and sign: your membership restarts today.')}</p>
    <div className="card gate-plan">
      {plans.length > 1
        ? <fieldset className="gate-choices">
          <legend className="small dim">{t('Choose your plan')}</legend>
          {plans.map(p => <label key={p.name} className="gate-choice">
            <input type="radio" name="renewal-plan" checked={picked.name === p.name} onChange={() => setChoice(p.name)} />
            <span>{fmtPlan(p)}</span>
          </label>)}
        </fieldset>
        : <div className="gate-plan-name">{fmtPlan(picked || offer.plan)}</div>}
      {picked?.startsOn
        ? <>
          <div className="small gate-period">{[startsLine(picked), endsLine(picked)].filter(Boolean).join(' · ')}</div>
          {offer.endedOn && <div className="small dim">{offer.why === 'ending'
            ? t('Your current membership ends on {0}.', fmtDate(offer.endedOn))
            : t('Your membership ended on {0}.', fmtDate(offer.endedOn))}</div>}
        </>
        : offer.endedOn && <div className="small dim">{offer.why === 'ending'
          ? t('Ends on {0}', fmtDate(offer.endedOn))
          : t('Ended on {0}', fmtDate(offer.endedOn))}</div>}
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
      <Button variant="primary" icon="checkCircle" disabled={!canSign} onClick={sign}>
        {busy ? t('Renewing…') : needsSignature ? t('Sign and renew') : t('Renew')}
      </Button>
      {onCancel && <Button variant="ghost" onClick={onCancel}>{t('Back')}</Button>}
    </div>
  </>
}
