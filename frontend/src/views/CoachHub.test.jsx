// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The « Coach » place (views/CoachHub.jsx): Nora and the member's own coach, each only when it exists.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import CoachHub from './CoachHub.jsx'

const m = vi.hoisted(() => ({ nav: vi.fn(), doors: { nora: false, human: false, any: false }, coach: null }))
vi.mock('react-router-dom', () => ({ useNavigate: () => m.nav }))
vi.mock('../lib/use-coach-doors.js', () => ({ useCoachDoors: () => m.doors }))
vi.mock('../lib/api.js', () => ({ myCoach: vi.fn(() => Promise.resolve({ coach: m.coach })) }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
beforeEach(() => {
  m.nav.mockClear()
  m.doors = { nora: false, human: false, any: false }
  m.coach = null
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => { act(() => root.unmount()); host.remove() })

const mount = async () => { await act(async () => { root.render(<CoachHub />) }) }
const button = label => [...host.querySelectorAll('button')].find(b => b.textContent.includes(label))

describe('the Coach place', () => {
  it('offers Nora, and says she answers within the limits the club has set', async () => {
    m.doors = { nora: true, human: false, any: true }
    await mount()
    expect(host.querySelector('h1').textContent).toBe('Coach')
    expect(host.textContent).toContain('She answers within the limits your club has set.')
    await act(async () => { button('Ask Nora').click() })
    expect(m.nav).toHaveBeenCalledWith('/coach')
    expect(host.textContent).not.toContain('Write to your coach')
  })

  it('offers the member’s own coach when they can be written to, by name', async () => {
    m.doors = { nora: false, human: true, any: true }
    m.coach = { name: 'Coach Démo', reachable: true }
    await mount()
    expect(host.textContent).toContain('Coach Démo')
    expect(host.textContent).not.toContain('Ask Nora')
    const row = [...host.querySelectorAll('.row, [role="button"], button')].find(el => el.textContent.includes('Write to your coach'))
    await act(async () => { row.click() })
    expect(m.nav).toHaveBeenCalledWith('/coach-thread')
  })

  it('offers both doors when both exist', async () => {
    m.doors = { nora: true, human: true, any: true }
    m.coach = { name: 'Coach Démo', reachable: true }
    await mount()
    expect(host.textContent).toContain('Ask Nora')
    expect(host.textContent).toContain('Write to your coach')
  })

  it('does not offer a coach who has no account for messages', async () => {
    m.doors = { nora: true, human: false, any: true }
    m.coach = { name: 'Coach Démo', reachable: false }
    await mount()
    expect(host.textContent).not.toContain('Write to your coach')
  })

  it('says so, and offers nothing, when the club has neither', async () => {
    await mount()
    expect(host.textContent).toContain('Your club has no coach to write to yet.')
    expect(host.querySelectorAll('button')).toHaveLength(0)
  })
})
