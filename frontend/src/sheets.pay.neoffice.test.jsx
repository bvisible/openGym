// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The payment sheet of a class or a membership invoice (sheets.jsx PaySheet). Asked for by the pilot club on 2026-10-29: the ways to pay led to the same
//// page and the wait after the tap showed nothing. Pinned here: the methods the server sends are drawn as sent (the merging is the server's: api/payment_methods.py),
//// a tap asks the server with the language the member reads the journal in (so the provider's page opens in it), and while the page is being asked for the
//// screen says it is waiting instead of showing a dimmed row.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const calls = vi.hoisted(() => ({ payWith: [], payInvoice: [], release: null }))
vi.mock('./lib/api.js', async importOriginal => {
  const real = await importOriginal()
  const slow = (list, answer) => (...args) => {
    list.push(args)
    return new Promise(resolve => { calls.release = () => resolve(answer) })
  }
  return {
    ...real,
    payStart: () => Promise.resolve({
      booking: 'BKG-1', amount: 28, currency: 'CHF',
      methods: [
        { id: 'Facture - CHF', title: 'Facture', gateway_type: 'facture' },
        { id: 'Payrexx - CHF', title: 'TWINT / Carte', gateway_type: 'payrexx' },
      ],
    }),
    payWith: slow(calls.payWith, { action: 'none', invoice: 'FA-1' }),
    invoiceMethods: () => Promise.resolve({
      amount: 50, currency: 'CHF', methods: [{ id: 'Payrexx - CHF', title: 'TWINT / Carte', gateway_type: 'payrexx' }],
    }),
    payInvoice: slow(calls.payInvoice, { action: 'none', invoice: 'FA-2' }),
    payState: () => Promise.resolve({ state: 'pending' }),
    invoicePayState: () => Promise.resolve({ paid: false }),
  }
})
vi.mock('./lib/i18n.js', async importOriginal => {
  const real = await importOriginal()
  return { ...real, getLang: () => 'de' }
})

import { useUI } from './store/useUI.js'
import { paySheet, payInvoiceSheet } from './sheets.jsx'

const mounted = []
let host
const settle = () => act(async () => { await Promise.resolve() })
async function open(openSheet) {
  act(() => { openSheet() })
  const sheet = useUI.getState().sheets.at(-1)
  host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  await settle(); await settle()
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], timer: null, work: null })
  calls.payWith.length = 0
  calls.payInvoice.length = 0
})
afterEach(() => {
  mounted.splice(0).forEach(r => act(() => r.unmount()))
  document.body.innerHTML = ''
})

describe('the payment sheet', () => {
  it('draws the ways to pay as the server sends them: one button for the provider that takes TWINT and card', async () => {
    await open(() => paySheet({ id: 'BKS-1', title: 'Yoga', start: '2026-11-09T14:00:00' }))
    const rows = [...host.querySelectorAll('.pay-m')].map(b => b.querySelector('.tt').textContent)
    expect(rows).toEqual(['Facture', 'TWINT / Carte'])
  })

  it('a tap on a class payment asks the server with the journal language, and says it is waiting', async () => {
    await open(() => paySheet({ id: 'BKS-1', title: 'Yoga', start: '2026-11-09T14:00:00' }))
    expect(host.querySelector('.pay-wait')).toBeNull()
    act(() => host.querySelectorAll('.pay-m')[1].click())
    await settle()
    expect(calls.payWith).toEqual([['BKG-1', 'Payrexx - CHF', 'de']])
    expect(host.querySelector('.pay-wait .spin')).toBeTruthy()
    expect(host.querySelector('.pay-wait').textContent).toContain('Loading')
    expect([...host.querySelectorAll('.pay-m')].every(b => b.disabled)).toBe(true)
    await act(async () => { calls.release() })
    expect(host.querySelector('.pay-wait .spin')).toBeFalsy()
  })

  it('a tap on a membership invoice asks the server with the journal language too', async () => {
    await open(() => payInvoiceSheet({ id: 'FA-2', title: 'Abonnement', subtitle: '' }))
    act(() => host.querySelector('.pay-m').click())
    await settle()
    expect(calls.payInvoice).toEqual([['FA-2', 'Payrexx - CHF', 'de']])
    await act(async () => { calls.release() })
  })
})
