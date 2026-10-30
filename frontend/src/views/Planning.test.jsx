// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The « Planning » place (views/Planning.jsx): Plan, and the club's classes as a second segment.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { MemoryRouter, useLocation } from 'react-router-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import Planning, { PLANNING_TAB_KEY } from './Planning.jsx'
import { DEF, useStore } from '../store/useStore.js'

vi.mock('./Plan.jsx', () => ({ default: () => <div data-testid="plan">PLAN</div> }))
vi.mock('./Classes.jsx', () => ({ default: ({ embedded }) => <div data-testid="classes" data-embedded={String(!!embedded)}>CLASSES</div> }))

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root, originalS, here
const Where = () => { here = useLocation(); return null }

beforeEach(() => {
  originalS = useStore.getState().S
  localStorage.removeItem(PLANNING_TAB_KEY)
  host = document.createElement('div')
  document.body.appendChild(host)
  root = createRoot(host)
})
afterEach(() => {
  act(() => root.unmount())
  host.remove()
  useStore.setState({ S: originalS })
  localStorage.removeItem(PLANNING_TAB_KEY)
})

const mount = (entry = '/plan', S = {}) => {
  useStore.setState({ S: { ...JSON.parse(JSON.stringify(DEF)), ...S } })
  act(() => { root.render(<MemoryRouter initialEntries={[entry]}><Planning /><Where /></MemoryRouter>) })
}
const segments = () => [...host.querySelectorAll('.planning-seg button')]
const seg = label => segments().find(b => b.textContent === label)

describe('the Planning place', () => {
  it('is the Plan screen alone, with no title and no segments, for a club without classes', () => {
    mount('/plan', { perms: { classes: false } })
    expect(host.querySelector('[data-testid="plan"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="classes"]')).toBeNull()
    expect(host.querySelector('.planning')).toBeNull()
    expect(host.querySelector('h1')).toBeNull()
  })

  it('is the Plan screen alone too for a member who took the classes out of their bar', () => {
    mount('/plan', { classesTab: false })
    expect(host.querySelector('.planning')).toBeNull()
    expect(host.querySelector('[data-testid="plan"]')).toBeTruthy()
  })

  it('shows the title and two segments when the club has classes, on « My sessions » first', () => {
    mount('/plan')
    expect(host.querySelector('.planning h1').textContent).toBe('Planning')
    expect(segments().map(b => b.textContent)).toEqual(['My sessions', 'Classes'])
    expect(host.querySelector('[data-testid="plan"]')).toBeTruthy()
    expect(host.querySelector('[data-testid="classes"]')).toBeNull()
    expect(seg('My sessions').getAttribute('aria-pressed')).toBe('true')
  })

  it('swaps to the classes, drawn without their own title, and remembers the segment', () => {
    mount('/plan')
    act(() => { seg('Classes').click() })
    expect(host.querySelector('[data-testid="classes"]').getAttribute('data-embedded')).toBe('true')
    expect(host.querySelector('[data-testid="plan"]')).toBeNull()
    expect(here.search).toBe('?tab=classes')
    expect(localStorage.getItem(PLANNING_TAB_KEY)).toBe('classes')
  })

  it('comes back on the segment last used, when the link names none', () => {
    localStorage.setItem(PLANNING_TAB_KEY, 'classes')
    mount('/plan')
    expect(host.querySelector('[data-testid="classes"]')).toBeTruthy()
    expect(seg('Classes').getAttribute('aria-pressed')).toBe('true')
  })

  it('obeys ?tab= over what was remembered', () => {
    localStorage.setItem(PLANNING_TAB_KEY, 'classes')
    mount('/plan?tab=sessions')
    expect(host.querySelector('[data-testid="plan"]')).toBeTruthy()
  })

  it('shows the classes for a link to them even when the member took them out of the bar', () => {
    mount('/plan?tab=classes', { classesTab: false })
    expect(host.querySelector('[data-testid="classes"]')).toBeTruthy()
    expect(segments()).toHaveLength(2)
  })

  it('does not show the classes of a club that has none, whatever the link says', () => {
    mount('/plan?tab=classes', { perms: { classes: false } })
    expect(host.querySelector('[data-testid="classes"]')).toBeNull()
    expect(host.querySelector('[data-testid="plan"]')).toBeTruthy()
  })
})
