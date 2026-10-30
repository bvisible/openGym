// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The floor plan's row in Settings › Your club (components/FloorPlanRow.jsx).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const m = vi.hoisted(() => ({ zones: [], open: vi.fn() }))
vi.mock('./FloorPlanSheet.jsx', () => ({ loadFloorPlan: () => Promise.resolve(m.zones) }))
vi.mock('../sheets.jsx', () => ({ floorPlanSheet: m.open }))
import FloorPlanRow from './FloorPlanRow.jsx'

globalThis.IS_REACT_ACT_ENVIRONMENT = true
let host, root
beforeEach(() => { m.open.mockClear(); host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host) })
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = async () => { await act(async () => { root.render(<FloorPlanRow />) }) }

describe('the floor plan row', () => {
  it('is silent when the club drew no plan', async () => {
    m.zones = []
    await mount()
    expect(host.textContent).toBe('')
  })

  it('names the plan and its zones, and opens it with the zones', async () => {
    m.zones = [{ name: 'a' }, { name: 'b' }]
    await mount()
    expect(host.textContent).toContain('Floor plan')
    expect(host.textContent).toContain('2 zones')
    await act(async () => { host.querySelector('button').click() })
    expect(m.open).toHaveBeenCalledWith(m.zones)
  })
})
