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
}))
vi.mock('../lib/format.js', () => ({ fmtNum: n => String(Math.round(n * 10) / 10) }))
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
