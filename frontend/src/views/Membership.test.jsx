// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// « Mon abonnement » : ce que le membre lit de son argent.
////
//// Three things are pinned: a club that answers money at the desk shows no
//// invoice at all, what is owed is announced with the LATE number and not the
//// total, and an invoice opens the club's PDF and nothing else.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  myMembership: vi.fn(),
  invoicePdfUrl: name => '/api/method/neoffice_gym.api.membership.invoice_pdf?invoice=' + encodeURIComponent(name),
}))
vi.mock('../lib/api.js', () => api)
const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
//: The payment sheet is the classes' own screen (sheets.jsx); importing it
//: here would drag the whole module in. What this view owes is WHICH invoice
//: it hands over, and that is what is checked.
const sheet = vi.fn()
vi.mock('../sheets.jsx', () => ({ payInvoiceSheet: (...a) => sheet(...a) }))

let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetModules(); api.myMembership.mockReset(); nav.mockReset(); sheet.mockReset() })
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

const mount = async (payload) => {
  api.myMembership.mockResolvedValue(payload)
  const { default: Membership } = await import('./Membership.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<Membership />) })
  return host
}
const rowWith = (h, re) => [...h.querySelectorAll('.lrow')].find(r => re.test(r.textContent))
//: The invoice rows only — the section above says "70 overdue" too, and a
//: match on the amount alone would read the summary instead of the invoice.
const invoiceRow = (h, re) => {
  const section = [...h.querySelectorAll('.sect')].find(s => /Your invoices/.test(s.querySelector('.sect-t')?.textContent || ''))
  return [...section.querySelectorAll('.lrow')].find(r => re.test(r.textContent))
}

describe('my membership', () => {
  it('says nothing about money when the club answers it at the desk', async () => {
    const h = await mount({ shown: false, invoices: [], methods: [] })
    expect(h.textContent).toContain('Your club handles the membership outside the app.')
    //: Not an empty list, not a zero: no invoice section at all.
    expect(h.textContent).not.toContain('Your invoices')
  })

  it('shows the plan, its price and the period it runs to', async () => {
    const h = await mount({
      shown: true, state: 'active', currency: 'CHF', due: 0, overdue: 0, invoices: [],
      plan: { label: 'Abonnement mensuel', cost: 59, currency: 'CHF', interval: 'Month', intervalCount: 1 },
      periodEnd: '2026-10-31',
    })
    const plan = rowWith(h, /Abonnement mensuel/)
    expect(plan.textContent).toContain('59.00 CHF')
    expect(plan.textContent).toContain('per month')
    expect(h.textContent).toContain('Current period until')
    expect(h.textContent).toContain('No invoice yet.')
  })

  it('announces what is LATE, not the whole of what is owed', async () => {
    const h = await mount({
      shown: true, state: 'active', currency: 'CHF', due: 120, overdue: 70, canPay: false, plan: null,
      invoices: [
        { name: 'FA-2', total: 50, currency: 'CHF', date: '2026-09-10', dueOn: '2026-10-10', state: 'open' },
        { name: 'FA-1', total: 70, currency: 'CHF', date: '2026-08-10', dueOn: '2026-09-10', state: 'overdue' },
      ],
    })
    //: 70 overdue out of 120 owed — the member reads the urgent number first,
    //: and is told where to settle it since the club does not take money here.
    expect(h.textContent).toContain('70.00 CHF overdue')
    expect(h.textContent).toContain('Settle it at the desk or by bank transfer.')
    expect(invoiceRow(h, /70\.00 CHF/).textContent).toContain('Overdue')
    expect(invoiceRow(h, /50\.00 CHF/).textContent).toContain('Unpaid')
  })

  it('opens the club’s own PDF for the invoice that was tapped', async () => {
    const open = vi.spyOn(window, 'open').mockImplementation(() => null)
    const h = await mount({
      shown: true, state: 'active', currency: 'CHF', due: 0, overdue: 0, plan: null,
      invoices: [{ name: 'FA-2026-0007', total: 59, currency: 'CHF', date: '2026-09-01', dueOn: '2026-09-30', state: 'paid' }],
    })
    await act(async () => { invoiceRow(h, /59\.00 CHF/).click() })
    expect(open).toHaveBeenCalledWith(
      '/api/method/neoffice_gym.api.membership.invoice_pdf?invoice=FA-2026-0007', '_blank', 'noopener')
    open.mockRestore()
  })

  it('offers to settle the OLDEST invoice still owed, and only when the club takes money', async () => {
    const owed = {
      shown: true, state: 'active', currency: 'CHF', due: 120, overdue: 70, canPay: false, plan: null,
      invoices: [
        { name: 'FA-3', total: 50, outstanding: 50, currency: 'CHF', date: '2026-09-10', dueOn: '2026-10-10', state: 'open' },
        { name: 'FA-1', total: 70, outstanding: 70, currency: 'CHF', date: '2026-08-10', dueOn: '2026-09-10', state: 'overdue' },
      ],
    }
    let h = await mount(owed)
    //: The club has not opened paying: no button, and the screen says where to settle.
    expect([...h.querySelectorAll('button')].some(b => /Pay /.test(b.textContent))).toBe(false)

    await act(async () => { root.unmount() }); document.body.innerHTML = ''
    h = await mount({ ...owed, canPay: true })
    const pay = [...h.querySelectorAll('button')].find(b => /Pay /.test(b.textContent))
    expect(pay.textContent).toContain('70.00 CHF')
    await act(async () => { pay.click() })
    //: The oldest one — the one a club chases first.
    expect(sheet.mock.calls[0][0].id).toBe('FA-1')
  })

  it('asks the club again after a payment rather than patching the numbers itself', async () => {
    const h = await mount({
      shown: true, state: 'active', currency: 'CHF', due: 50, overdue: 0, canPay: true, plan: null,
      invoices: [{ name: 'FA-9', total: 50, outstanding: 50, currency: 'CHF', date: '2026-09-10', dueOn: '2026-10-10', state: 'open' }],
    })
    await act(async () => { [...h.querySelectorAll('button')].find(b => /Pay /.test(b.textContent)).click() })
    expect(api.myMembership).toHaveBeenCalledTimes(1)
    api.myMembership.mockResolvedValue({ shown: true, state: 'active', due: 0, overdue: 0, canPay: true, plan: null, invoices: [] })
    //: The sheet calls back when the money lands: the screen re-asks.
    await act(async () => { sheet.mock.calls[0][1]() })
    expect(api.myMembership).toHaveBeenCalledTimes(2)
    expect(h.textContent).toContain('No invoice yet.')
  })

  it('says so when the membership has ended instead of leaving the screen empty', async () => {
    const h = await mount({ shown: true, state: 'expired', endsOn: '2026-08-31', due: 0, overdue: 0, invoices: [], plan: null })
    expect(h.textContent).toContain('Your membership has ended')
    expect(h.textContent).toContain('No membership on your account')
  })
})
