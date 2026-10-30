// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The club's running challenges, as a card (components/ChallengesCard.jsx).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ challenges: [], nav: vi.fn() }))
vi.mock('react-router-dom', () => ({ useNavigate: () => m.nav }))
vi.mock('../lib/api.js', async importOriginal => ({ ...await importOriginal(), challengesMine: () => Promise.resolve({ challenges: m.challenges }) }))
import ChallengesCard from './ChallengesCard.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
beforeEach(() => { m.nav.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = async () => { await act(async () => { root.render(<ChallengesCard />) }) }

describe('the challenges card', () => {
  it('is silent when no challenge is running', async () => {
    m.challenges = [{ name: 'c0', title: 'Old one', running: false }]
    await mount()
    expect(host.textContent).toBe('')
  })

  it('lists the running ones, at most three, and opens the challenges screen', async () => {
    m.challenges = [1, 2, 3, 4].map(i => ({ name: 'c' + i, title: 'Challenge ' + i, running: true, joined: false }))
    await mount()
    expect(host.querySelectorAll('.ttl')).toHaveLength(3)
    await act(async () => { host.querySelector('.card').click() })
    expect(m.nav).toHaveBeenCalledWith('/challenges')
  })

  it('says the member’s own rank, and never anyone else’s', async () => {
    m.challenges = [{ name: 'c1', title: 'October push', running: true, joined: true, rank: 3, of: 12 }]
    await mount()
    expect(host.textContent).toContain('You are 3 of 12')
  })

  it('says the member is first when they are', async () => {
    m.challenges = [{ name: 'c1', title: 'October push', running: true, joined: true, rank: 1, of: 12 }]
    await mount()
    expect(host.textContent).toContain('You are 1st of 12')
  })
})
