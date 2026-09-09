// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The membership gate: the club's message instead of the journal, the renewal
//// only when the club allows it, and a renewal that needs both the checkbox
//// and the signature before it is sent.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  BOOT: { app_title: 'Olympia', app_icon: null, lang: 'fr', user: { name: 'm@x.ch', full_name: 'Marie' }, membership: {} },
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
})
