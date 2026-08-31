// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The "where to find it" panel. What matters is not that it draws boxes —
//// that shows on screen. It is that it stays SILENT when there is nothing to
//// say: most clubs will never draw their room, and an empty frame under every
//// exercise would be a permanent reminder of a feature they don't use.
//// A failed request is silence too: this is a convenience, and interrupting
//// someone mid-workout about it would be worse than not showing it.

import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { Window } from 'happy-dom'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

//// The shape api() really returns: it has ALREADY unwrapped Frappe's
//// {message: …}. Mocking the wrapped shape is what let a bug through — the
//// component read r.message.items, the test agreed, and the panel stayed
//// blank against a real server that had answers.
const mocks = vi.hoisted(() => ({ answer: { items: [] }, fail: false, calls: [] }))

vi.mock('../lib/api.js', () => ({
  floorWhereIs: (id) => {
    mocks.calls.push(id)
    return mocks.fail ? Promise.reject(new Error('offline')) : Promise.resolve(mocks.answer)
  },
}))
vi.mock('../lib/i18n.js', () => ({ t: s => s }))

import FloorPlanFor from './FloorPlan.jsx'

const item = (over = {}) => ({
  name: 'itm-1', item_name: 'Bench press', number: '3', zone: 'z1', zone_name: 'Ground floor',
  item_type: 'Machine', enabled: 1, pos_x: 20, pos_y: 30, width: 10, height: 8, shape: 'Rectangle',
  ...over,
})

let dom, root, container
const render = async (props) => {
  await act(async () => { root.render(React.createElement(FloorPlanFor, props)) })
  return container
}

beforeEach(() => {
  dom = new Window({ url: 'https://localhost' })
  global.window = dom.window ?? dom
  global.document = global.window.document
  container = global.document.createElement('div')
  global.document.body.appendChild(container)
  root = createRoot(container)
  mocks.answer = { items: [] }
  mocks.fail = false
  mocks.calls = []
})
afterEach(() => { act(() => root.unmount()); container.remove() })

describe('where-to-find-it panel', () => {
  it('renders nothing when the club has not mapped the room', async () => {
    const el = await render({ exerciseId: 'bench-press' })
    expect(el.textContent).toBe('')
    expect(el.querySelector('.floor-map')).toBeNull()
  })

  it('renders nothing when the request fails', async () => {
    mocks.fail = true
    const el = await render({ exerciseId: 'bench-press' })
    expect(el.textContent).toBe('')
  })

  it('does not even ask without an exercise', async () => {
    const el = await render({ exerciseId: null })
    expect(mocks.calls).toEqual([])
    expect(el.textContent).toBe('')
  })

  it('shows the number and the zone once the club has mapped it', async () => {
    mocks.answer = { items: [item()] }
    const el = await render({ exerciseId: 'bench-press' })
    expect(el.textContent).toContain('Ground floor')
    expect(el.textContent).toContain('3')
    expect(el.textContent).toContain('Bench press')
    expect(el.querySelector('.floor-item.focus')).not.toBeNull()
  })

  it('groups by zone — a club on two floors must say WHICH floor', async () => {
    mocks.answer = { items: [
      item(), item({ name: 'itm-2', zone: 'z2', zone_name: 'Mezzanine', number: '12' }),
    ] }
    const el = await render({ exerciseId: 'bench-press' })
    expect(el.querySelectorAll('.floor-map').length).toBe(2)
    expect(el.textContent).toContain('Ground floor')
    expect(el.textContent).toContain('Mezzanine')
  })

  it('marks a machine that is out of order rather than hiding it', async () => {
    // Someone looking for it needs to know it is out — not to wonder where it went.
    mocks.answer = { items: [item({ enabled: 0 })] }
    const el = await render({ exerciseId: 'bench-press' })
    expect(el.querySelector('.floor-item.out')).not.toBeNull()
    expect(el.textContent).toContain('out of order')
  })

  it('positions items as percentages, so one plan fits every screen', async () => {
    mocks.answer = { items: [item({ pos_x: 42, pos_y: 17, width: 25, height: 9 })] }
    const el = await render({ exerciseId: 'bench-press' })
    const box = el.querySelector('.floor-item')
    expect(box.style.left).toBe('42%')
    expect(box.style.top).toBe('17%')
    expect(box.style.width).toBe('25%')
  })
})
