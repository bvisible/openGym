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
  myBadges: () => (mocks.fail ? Promise.reject(new Error('offline')) : Promise.resolve(mocks.answer)),
}))
vi.mock('../lib/i18n.js', () => ({
  t: (s, ...a) => a.reduce((out, v, i) => out.replaceAll('{' + i + '}', v), s),
}))
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
