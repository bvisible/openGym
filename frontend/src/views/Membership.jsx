//// Neoffice — added file (no upstream equivalent).
////
//// « MON ABONNEMENT » (Jérémy, 18.09, après l'appel avec le club pilote :
//// *"une partie mon abonnement — voir l'abonnement, voir les factures,
//// est-ce qu'il y a des factures ouvertes, en retard"*).
////
//// What a member asks about money, in the order they ask it: what am I on,
//// until when, do I owe anything, and which invoice is it. The club decides
//// whether this screen exists at all (Gym Settings → "show the membership in
//// the app") — a club that bills elsewhere shows nothing rather than an empty
//// section a member would ask about.
////
//// Read-only for now: paying from here is the club's own switch and comes
//// with the payment methods it really accepts.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { myMembership, invoicePdfUrl } from '../lib/api.js'
import { payInvoiceSheet, renewalSheet } from '../sheets.jsx'
import { Button } from '../components/ui.jsx'
import { t, dateLocale } from '../lib/i18n.js'
import Icon from '../components/Icon.jsx'
import { Section, Row } from '../components/ui.jsx'

const fmtDate = iso => {
  if (!iso) return ''
  try { return new Date(iso + 'T00:00:00').toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long', year: 'numeric' }) } catch { return iso }
}
const fmtMoney = (n, cur) => {
  const amount = Number(n || 0).toLocaleString(dateLocale(), { minimumFractionDigits: 2, maximumFractionDigits: 2 })
  return cur ? `${amount} ${cur}` : amount
}
const every = (interval, count) => {
  const n = Number(count || 1)
  //: One msgid per period: a plural built by hand reads wrong in half the languages.
  if (interval === 'Month') return n > 1 ? t('every {0} months', n) : t('per month')
  if (interval === 'Year') return n > 1 ? t('every {0} years', n) : t('per year')
  if (interval === 'Week') return n > 1 ? t('every {0} weeks', n) : t('per week')
  if (interval === 'Day') return n > 1 ? t('every {0} days', n) : t('per day')
  return ''
}

// The oldest invoice still owed: the one a club chases first, and the one a
// member means when they say "I'll pay it".
const oldestOwed = invoices => [...(invoices || [])]
  .filter(i => i.state !== 'paid')
  .sort((a, b) => String(a.date || '').localeCompare(String(b.date || '')))[0] || null

export default function Membership() {
  const nav = useNavigate()
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  // Bumped when a payment goes through: the amounts and the states are the
  // club's, not ours to guess — we ask again rather than patch them here.
  const [round, setRound] = useState(0)

  useEffect(() => {
    let alive = true
    myMembership()
      .then(r => { if (alive) setData(r || {}) })
      .catch(e => { if (alive) setError(e.message || String(e)) })
    return () => { alive = false }
  }, [round])

  const head = <div className="hdr">
    <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
    <div style={{ flex: 1, marginLeft: 10 }}><h1>{t('My membership')}</h1></div>
  </div>

  if (error) {
    return <div className="narrow">{head}
      <Section><Row icon="info" title={t('Your membership could not be loaded.')} subtitle={error} /></Section>
    </div>
  }
  if (!data) return <div className="narrow">{head}<p className="muted small">{t('Loading…')}</p></div>
  if (data.shown === false) {
    return <div className="narrow">{head}
      <Section><Row icon="info" iconTint="var(--grey)" title={t('Your club handles the membership outside the app.')}
        subtitle={t('Ask at the desk for your invoices.')} /></Section>
    </div>
  }

  const plan = data.plan
  const invoices = data.invoices || []
  const owed = oldestOwed(invoices)
  const renewal = data.renewal
  const pay = (inv, allowDeferred) => payInvoiceSheet(
    { id: inv.name, title: t('Invoice {0}', inv.name), subtitle: fmtMoney(inv.outstanding ?? inv.total, inv.currency), allowDeferred },
    () => setRound(n => n + 1),
  )
  // Signing restarts the membership and raises its invoice. Paying it is the
  // next gesture, not another screen — and there "Invoice" is a real answer:
  // the member signs now and the club bills them.
  const renew = () => renewalSheet(result => {
    setRound(n => n + 1)
    if (data.canPay && result?.invoice) {
      pay({ name: result.invoice, outstanding: plan?.cost, currency: plan?.currency }, true)
    }
  })
  //: `_my_invoices` only ever returns submitted invoices, so there is no
  //: "draft" word to translate here: a draft is the club writing, not
  //: something the member owes.
  const label = { paid: t('Paid'), open: t('Unpaid'), overdue: t('Overdue') }

  return <div className="narrow">
    {head}

    {/* What the member is on. The state first — it is the one thing that
        changes what they can do today. */}
    <Section title={t('Your membership')}>
      {plan
        ? <Row icon="key" iconTint="var(--acc)" title={plan.label}
            subtitle={[plan.cost != null ? fmtMoney(plan.cost, plan.currency) : '', every(plan.interval, plan.intervalCount)].filter(Boolean).join(' · ')} />
        : <Row icon="key" iconTint="var(--grey)" title={t('No membership on your account')}
            subtitle={t('The club sets this up at the desk.')} />}
      {data.state === 'expired' && <Row icon="warning" iconTint="var(--red)" title={t('Your membership has ended')}
        subtitle={data.endsOn ? t('It ended on {0}.', fmtDate(data.endsOn)) : ''} />}
      {data.state === 'active' && data.periodEnd && <Row icon="calendar" iconTint="var(--blue)"
        title={t('Current period until {0}', fmtDate(data.periodEnd))} />}
      {/* Nothing renews itself in this club, or the membership is over: either
          way the member says yes here rather than at the desk. A membership
          that rolls on shows no button — there is nothing to say yes to. */}
      {renewal && <>
        {renewal.why === 'ending' && <Row icon="info" iconTint="var(--yellow)"
          title={t('It will not renew itself')}
          subtitle={renewal.endsOn ? t('It ends on {0} unless you renew it.', fmtDate(renewal.endsOn)) : ''} />}
        <div style={{ padding: '0 14px 14px' }}>
          <Button variant={renewal.why === 'ending' ? 'tinted' : 'primary'} icon="checkCircle" onClick={renew}>
            {renewal.why === 'ending' ? t('Renew it now') : t('Renew my membership')}
          </Button>
        </div>
      </>}
    </Section>

    {/* What is owed, said once and in one place: a member who owes nothing
        should not have to read a list to find that out. */}
    {data.due > 0 && <Section>
      <Row icon={data.overdue > 0 ? 'warning' : 'clock'} iconTint={data.overdue > 0 ? 'var(--red)' : 'var(--yellow)'}
        title={data.overdue > 0 ? t('{0} overdue', fmtMoney(data.overdue, data.currency)) : t('{0} to pay', fmtMoney(data.due, data.currency))}
        subtitle={data.canPay ? t('You can settle it from here.') : t('Settle it at the desk or by bank transfer.')} />
      {/* The button settles ONE invoice — the oldest one still owed. Paying
          "everything" would raise a document nobody asked for; the club's
          invoices are what the member owes, one at a time. */}
      {data.canPay && owed && <div style={{ padding: '0 14px 14px' }}>
        <Button variant="primary" icon="bolt" onClick={() => pay(owed, false)}>
          {t('Pay {0}', fmtMoney(owed.outstanding ?? owed.total, owed.currency))}
        </Button>
      </div>}
    </Section>}

    <Section title={t('Your invoices')} footer={invoices.length ? t('Tap an invoice to open its PDF.') : null}>
      {!invoices.length && <Row icon="clipboard" iconTint="var(--grey)" title={t('No invoice yet.')} />}
      {invoices.map(inv => <Row key={inv.name}
        icon={inv.state === 'paid' ? 'check' : inv.state === 'overdue' ? 'warning' : 'clipboard'}
        iconTint={inv.state === 'paid' ? 'var(--green)' : inv.state === 'overdue' ? 'var(--red)' : 'var(--yellow)'}
        title={fmtMoney(inv.total, inv.currency)}
        subtitle={[fmtDate(inv.date), label[inv.state] || '', inv.state !== 'paid' && inv.dueOn ? t('due {0}', fmtDate(inv.dueOn)) : '']
          .filter(Boolean).join(' · ')}
        accessory="chevron"
        onClick={() => window.open(invoicePdfUrl(inv.name), '_blank', 'noopener')} />)}
    </Section>
  </div>
}
