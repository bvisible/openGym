// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The badge case. What is pinned is not that a medal draws — that shows on
//// screen. It is:
////   * silence for a club that has not turned badges on (most clubs);
////   * LOCKED badges being shown, which is the whole point for a beginner;
////   * the points half staying hidden when the club offers nothing, so it is
////     never made to promise something it does not have;
////   * the reward showing the GAP rather than the price — "il te manque 60
////     points" is a next step, "200 points" is a wall.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => ({ answer: null, fail: false }))
vi.mock('../lib/api.js', () => ({
  //// Neoffice — BOOT: the page's boot data (lib/api.js), read by our screens at import.
  BOOT: {},
  //// Neoffice — what our store imports from api.js; absent from a partial mock it falls through to the real module.
  getState: vi.fn(() => Promise.resolve({ state: null })), putState: vi.fn(() => Promise.resolve({})), logout: vi.fn(() => Promise.resolve({})),
  myBadges: () => (mocks.fail ? Promise.reject(new Error('offline')) : Promise.resolve(mocks.answer)),
}))
vi.mock('../lib/i18n.js', () => ({
  t: (s, ...a) => a.reduce((out, v, i) => out.replaceAll('{' + i + '}', v), s),
  tn: (one, other, n, ...rest) => [n, ...rest].reduce((out, v, i) => out.replaceAll('{' + i + '}', v), n === 1 ? one : other),
  dateLocale: () => 'en-GB',
}))
vi.mock('../lib/format.js', () => ({ fmtNum: n => String(Math.round(n * 10) / 10), fmtDate: (iso, long) => 'D(' + iso + (long ? ',long' : '') + ')' }))
vi.mock('./Icon.jsx', () => ({ default: () => React.createElement('i') }))

import Badges from './Badges.jsx'

const badge = (over = {}) => ({
  id: 'b1', name: 'Régulier', category: 'Consistency', glyph: 'flame',
  description: 'Trois semaines d’affilée.', points: 30,
  earned: true, earnedOn: '2026-08-30', progress: null, ...over,
})

let dom, root, container
const render = async () => {
  await act(async () => { root.render(React.createElement(Badges)) })
  return container
}

beforeEach(() => {
  dom = new Window({ url: 'https://localhost' })
  global.window = dom.window ?? dom
  global.document = global.window.document
  container = global.document.createElement('div')
  global.document.body.appendChild(container)
  root = createRoot(container)
  mocks.fail = false
  mocks.answer = { enabled: true, pointsEnabled: false, points: 0, badges: [badge()], rewards: [] }
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('badge case', () => {
  it('shows nothing when the club has not turned badges on', async () => {
    mocks.answer = { enabled: false, badges: [], points: 0, rewards: [] }
    expect((await render()).textContent).toBe('')
  })

  it('shows nothing when the request fails', async () => {
    mocks.fail = true
    expect((await render()).textContent).toBe('')
  })

  it('shows nothing when the club enabled badges but defined none', async () => {
    mocks.answer = { enabled: true, badges: [], points: 0, rewards: [] }
    expect((await render()).textContent).toBe('')
  })

  it('shows an earned badge as earned', async () => {
    const el = await render()
    expect(el.textContent).toContain('Régulier')
    expect(el.textContent).toContain('Earned')
    expect(el.querySelector('.badge.got')).not.toBeNull()
  })

  it('shows LOCKED badges too, with what it takes', async () => {
    // A case containing only what you already have gives a beginner an empty
    // screen and nothing to aim at.
    mocks.answer = { enabled: true, pointsEnabled: false, points: 0, rewards: [],
      badges: [badge({ id: 'b2', name: 'Habitué', earned: false, progress: 0.4,
                       description: 'Dix séances au total.' })] }
    const el = await render()
    expect(el.textContent).toContain('Habitué')
    expect(el.textContent).toContain('Dix séances au total.')
    expect(el.querySelector('.badge.got')).toBeNull()
    expect(el.querySelector('.badge-bar span').style.width).toBe('40%')
  })

  it('keeps the points half hidden when the club offers nothing', async () => {
    // Badges that buy nothing are a complete feature on their own; a club with
    // no rewards must not be made to promise any.
    const el = await render()
    expect(el.textContent).not.toContain('points')
    expect(el.querySelector('.reward-list')).toBeNull()
  })

  it('shows the GAP to a reward, not just its price', async () => {
    mocks.answer = { enabled: true, pointsEnabled: true, points: 140, badges: [badge()],
      rewards: [{ name: 'r1', reward_name: 'Une séance de coaching', cost_points: 200 },
                { name: 'r2', reward_name: 'Une boisson', cost_points: 50 }] }
    const el = await render()
    expect(el.textContent).toContain('60 points to go')   // 200 - 140
    expect(el.textContent).toContain('Available')          // the 50 one
    expect(el.querySelectorAll('.reward.on').length).toBe(1)
  })
})

describe('badge case: levels', () => {
  const tiered = (over = {}) => badge({
    id: 'w', name: 'Total soulevé', glyph: 'dumbbell', metric: 'Weight Moved', levels: 3, thresholds: [20000, 40000, 60000],
    tier: 1, next: 40000, value: 31200, progress: 0.78, earned: true, ...over,
  })

  it('the level held, the bar towards the next one in its medal colour, and what it takes', async () => {
    mocks.answer = { enabled: true, pointsEnabled: false, points: 0, rewards: [], badges: [tiered()] }
    const el = await render()
    expect(el.querySelector('.badge.got.m-bronze')).toBeTruthy()
    expect(el.textContent).toContain('Bronze')
    expect(el.querySelector('.badge-bar span').className).toBe('silver')
    expect(el.querySelector('.badge-bar span').style.width).toBe('78%')
    expect(el.textContent).toContain('Silver in 8800 kg')
  })

  it('every level reached: the last medal, no bar', async () => {
    mocks.answer = { enabled: true, pointsEnabled: false, points: 0, rewards: [], badges: [tiered({ tier: 3, next: null, progress: 1 })] }
    const el = await render()
    expect(el.querySelector('.badge.m-gold')).toBeTruthy()
    expect(el.textContent).toContain('Gold')
    expect(el.querySelector('.badge-bar')).toBeNull()
  })

  it('a badge with three levels and none reached yet: a locked tile that says what the first one takes', async () => {
    mocks.answer = { enabled: true, pointsEnabled: false, points: 0, rewards: [], badges: [tiered({ tier: 0, earned: false, next: 20000, value: 5000, progress: 0.25 })] }
    const el = await render()
    expect(el.querySelector('.badge.got')).toBeNull()
    expect(el.querySelector('.badge-bar span').className).toBe('bronze')
    expect(el.textContent).toContain('Bronze in 15000 kg')
  })
})

//// Neoffice — the vouchers the badges give (the pilot club, 2026-11-03).
describe('badge case: vouchers', () => {
  const vouchers = (over = {}) => ({
    enabled: true, currency: 'CHF', balance: 10, cap: 15, minimumPurchase: null, canUse: true,
    available: [
      { id: 'v1', amount: 5, validUntil: '2027-06-01', badge: 'Régularité', tier: 1, year: 2026 },
      { id: 'v2', amount: 5, validUntil: '2027-09-12', badge: 'Cours collectifs', tier: 2, year: 2026 },
    ],
    pending: [],
    movements: [
      { id: 'm3', on: '2026-11-04 10:00', type: 'used', amount: 5, effect: -5, badge: 'Régularité', staff: null },
      { id: 'm2', on: '2026-10-20 18:30', type: 'won', amount: 5, effect: 5, badge: 'Cours collectifs', staff: null },
      { id: 'm1', on: '2026-10-01 09:00', type: 'won', amount: 5, effect: 5, badge: 'Régularité', staff: null },
    ],
    ...over,
  })
  const answer = v => ({ enabled: true, pointsEnabled: false, points: 0, rewards: [], badges: [badge()], vouchers: v })

  it('a club that gives none shows none', async () => {
    mocks.answer = answer({ enabled: false })
    expect((await render()).querySelector('.vouchers')).toBeNull()
    mocks.answer = { ...answer(undefined), vouchers: undefined }
    expect((await render()).querySelector('.vouchers')).toBeNull()
  })

  it('a member with nothing yet and nothing to show sees no empty block', async () => {
    mocks.answer = answer(vouchers({ balance: 0, available: [], pending: [], movements: [] }))
    expect((await render()).querySelector('.vouchers')).toBeNull()
  })

  it('the balance, the rule, and each voucher with its worth and its date', async () => {
    mocks.answer = answer(vouchers())
    const el = await render()
    const box = el.querySelector('.vouchers')
    expect(box.querySelector('.voucher-sum').textContent).toMatch(/10/)
    expect(box.textContent).toContain('CHF')
    expect(box.textContent).toContain("On the club's products only, not on the subscription. One voucher per visit.")
    expect(box.textContent).toContain('valid until D(2027-06-01)')
    expect(box.textContent).toContain('valid until D(2027-09-12)')
    expect(box.querySelectorAll('.reward.on').length).toBe(2)
  })

  it("the club's minimum purchase is part of the rule when it has one", async () => {
    mocks.answer = answer(vouchers({ minimumPurchase: 20 }))
    expect((await render()).querySelector('.vouchers').textContent).toMatch(/Minimum purchase .*20/)
  })

  it('a voucher on hold says it waits for room and unlocks when one is spent', async () => {
    mocks.answer = answer(vouchers({ pending: [{ id: 'h1', amount: 5, badge: 'Heures creuses', tier: 1 }] }))
    expect((await render()).querySelector('.vouchers').textContent).toMatch(/waiting for room in your balance/)
  })

  it('the statement is behind a tap, newest first, spending in the minus colour and never with the name of the desk', async () => {
    mocks.answer = answer(vouchers())
    const el = await render()
    expect(el.querySelector('.voucher-statement')).toBeNull()
    const toggle = el.querySelector('.vouchers button')
    await act(async () => { toggle.dispatchEvent(new window.MouseEvent('click', { bubbles: true })) })
    const rows = [...el.querySelectorAll('.voucher-statement .row')]
    expect(rows.length).toBe(3)
    expect(rows[0].textContent).toContain('Voucher spent')
    expect(rows[0].querySelector('b').className).toBe('neg')
    expect(rows[0].querySelector('b').textContent).toMatch(/^\u2212/)
    expect(rows[1].textContent).toContain('Voucher won')
    expect(rows[1].querySelector('b').textContent).toMatch(/^\+/)
  })

  it('the levels of the years gone by are listed under the badges', async () => {
    mocks.answer = { ...answer(vouchers()), history: [
      { id: 'r', name: 'Régularité', year: 2025, tier: 3, levels: 3 },
      { id: 'c', name: 'Cours collectifs', year: 2025, tier: 1, levels: 1 },
    ] }
    const tags = [...(await render()).querySelectorAll('.badge-history .tag')].map(x => x.textContent)
    expect(tags).toEqual(['Régularité · Gold · 2025', 'Cours collectifs · Earned · 2025'])
  })
})
