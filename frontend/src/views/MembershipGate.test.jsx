// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The membership gate: the club's message instead of the journal, the renewal
//// only when the club allows it, and a renewal that needs both the checkbox
//// and the signature before it is sent.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  BOOT: { app_title: 'Club Test', app_icon: null, lang: 'fr', user: { name: 'm@x.ch', full_name: 'Marie' }, membership: {} },
  renewalOffer: vi.fn(),
  acceptRenewal: vi.fn(),
  logout: vi.fn(),
}))
vi.mock('../lib/api.js', () => api)
vi.mock('../store/useStore.js', () => ({ useStore: { getState: () => ({ clearLocal: vi.fn() }) } }))
//// The pad draws on a canvas happy-dom does not have: a stand-in that signs on click.
vi.mock('../components/SignaturePad.jsx', () => ({
  default: ({ onChange }) => <button className="fake-pad" onClick={() => onChange('data:image/png;base64,AAAA')}>sign</button>,
}))

let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetModules(); api.renewalOffer.mockReset(); api.acceptRenewal.mockReset() })
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

const mount = async (membership) => {
  api.BOOT.membership = membership
  const { default: Gate } = await import('./MembershipGate.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<Gate />) })
  return host
}
const button = (h, re) => [...h.querySelectorAll('button')].find(b => re.test(b.textContent))

describe('the membership gate', () => {
  it('shows the club message, the plan that ended, and no renewal when the club does not allow it', async () => {
    const h = await mount({ required: true, blocked: true, state: 'expired', endsOn: '2026-08-31', message: 'Voyez l’accueil.', contact: '027 000 00 00',
      plan: { label: 'Mensuel', cost: 59, currency: 'CHF' }, renewal: { available: false } })
    expect(h.textContent).toContain('Voyez l’accueil.')
    expect(h.textContent).toContain('027 000 00 00')
    expect(h.textContent).toContain('Mensuel · 59 CHF')
    expect(button(h, /Renew my membership/)).toBeUndefined()
    expect(button(h, /Sign out/)).toBeDefined()
  })

  it('offers the renewal, and sends it only once the terms are accepted and the signature is there', async () => {
    api.renewalOffer.mockResolvedValue({ message: { plan: { label: 'Mensuel', cost: 59, currency: 'CHF' }, endedOn: '2026-08-31', terms: '<p>Les conditions</p>', termsHash: 'abc', signatureRequired: true } })
    api.acceptRenewal.mockResolvedValue({ message: { ok: true, endsOn: '2026-10-09', invoice: 'FA-1' } })
    const h = await mount({ required: true, blocked: true, state: 'expired', plan: { label: 'Mensuel' }, renewal: { available: true } })
    await act(async () => { button(h, /Renew my membership/).click() })
    expect(h.textContent).toContain('Les conditions')
    const go = button(h, /Sign and renew/)
    expect(go.disabled).toBe(true)
    await act(async () => { h.querySelector('.gate-accept input').click() })
    expect(button(h, /Sign and renew/).disabled).toBe(true)          // accepted, not signed
    await act(async () => { h.querySelector('.fake-pad').click() })
    expect(button(h, /Sign and renew/).disabled).toBe(false)
    await act(async () => { button(h, /Sign and renew/).click() })
    expect(api.acceptRenewal).toHaveBeenCalledWith({ terms_accepted: 1, signature: 'data:image/png;base64,AAAA', terms_hash: 'abc' })
    expect(h.textContent).toContain('Your membership is renewed.')
    expect(h.textContent).toContain('Your club will hand you the invoice.')
  })

  it('needs no signature when the club does not ask for one', async () => {
    api.renewalOffer.mockResolvedValue({ message: { plan: { label: 'Annuel' }, terms: '', termsHash: '', signatureRequired: false } })
    const h = await mount({ required: true, blocked: true, state: 'expired', plan: { label: 'Annuel' }, renewal: { available: true } })
    await act(async () => { button(h, /Renew my membership/).click() })
    expect(h.querySelector('.fake-pad')).toBeNull()
    await act(async () => { h.querySelector('.gate-accept input').click() })
    expect(button(h, /^Renew$/).disabled).toBe(false)
  })

  //// Neoffice — what the sheet says it signs (maintenance#936): the new period, not the old end date beside the plan.
  const offerOf = (extra = {}) => ({ message: {
    plan: { label: 'Mensuel', cost: 59, currency: 'CHF' }, endedOn: '2026-10-15', why: 'ending', terms: '', termsHash: '', signatureRequired: false, ...extra } })
  const openSheet = async (offer) => {
    api.renewalOffer.mockResolvedValue(offer)
    const h = await mount({ required: true, blocked: true, state: 'expired', plan: { label: 'Mensuel' }, renewal: { available: true } })
    await act(async () => { button(h, /Renew my membership/).click() })
    return h
  }
  const monthly = (extra = {}) => ({ name: 'M', label: 'Mensuel', cost: 59, currency: 'CHF', current: true, startsOn: '2026-10-16', endsOn: null, rollsOn: true, ...extra })
  const quarterly = (extra = {}) => ({ name: 'T', label: 'Trimestriel', cost: 150, currency: 'CHF', current: false, startsOn: '2026-10-16', endsOn: '2027-01-15', rollsOn: false, ...extra })

  it('says when the new period starts and that it renews by itself, instead of the date the old one ends beside the plan', async () => {
    const h = await openSheet(offerOf({ plans: [monthly()] }))
    expect(h.textContent).toMatch(/Starts on .*2026/)
    expect(h.textContent).toContain('Then it renews by itself, period after period.')
    expect(h.textContent).toMatch(/Your current membership ends on .*2026/)
    expect(h.textContent).not.toContain('Ends on')
  })

  it('gives the end of the new period when the club does not renew in the member’s name', async () => {
    const h = await openSheet(offerOf({ plans: [monthly({ endsOn: '2026-11-15', rollsOn: false })] }))
    expect(h.textContent).toMatch(/Until .*2026/)
    expect(h.textContent).not.toContain('renews by itself')
  })

  it('says it starts today when the membership has already ended', async () => {
    const d = new Date()
    const today = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
    const h = await openSheet(offerOf({ why: 'ended', endedOn: '2026-09-01', plans: [monthly({ startsOn: today })] }))
    expect(h.textContent).toContain('Starts today')
    expect(h.textContent).toMatch(/Your membership ended on .*2026/)
  })

  it('lets the member pick another plan the club offers, and sends the choice', async () => {
    api.acceptRenewal.mockResolvedValue({ message: { ok: true } })
    const h = await openSheet(offerOf({ plans: [monthly(), quarterly()] }))
    const radios = [...h.querySelectorAll('input[name="renewal-plan"]')]
    expect(radios.length).toBe(2)
    expect(radios[0].checked).toBe(true)                              // their own plan is the default
    expect(h.textContent).toContain('renews by itself')
    await act(async () => { radios[1].click() })
    expect(h.querySelectorAll('input[name="renewal-plan"]')[1].checked).toBe(true)
    expect(h.textContent).toMatch(/Until .*2027/)                      // the period of the plan on screen
    await act(async () => { h.querySelector('.gate-accept input').click() })
    await act(async () => { button(h, /^Renew$/).click() })
    expect(api.acceptRenewal).toHaveBeenCalledWith(expect.objectContaining({ plan: 'T' }))
  })

  it('sends no plan when there is nothing to choose', async () => {
    api.acceptRenewal.mockResolvedValue({ message: { ok: true } })
    const h = await openSheet(offerOf({ plans: [monthly()] }))
    expect(h.querySelector('input[name="renewal-plan"]')).toBeNull()
    await act(async () => { h.querySelector('.gate-accept input').click() })
    await act(async () => { button(h, /^Renew$/).click() })
    expect(api.acceptRenewal.mock.calls[0][0]).not.toHaveProperty('plan')
  })

  it('still reads a server that predates the choice', async () => {
    const h = await openSheet(offerOf())
    expect(h.textContent).toContain('Mensuel · 59 CHF')
    expect(h.textContent).toMatch(/Ends on .*2026/)
  })
})
