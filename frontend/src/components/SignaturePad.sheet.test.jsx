// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The signature pad INSIDE the real bottom sheet: a drag that starts on the pad belongs to the pad. The sheet's own
//// swipe-to-dismiss (components/Modals.jsx) used to take it — the sheet followed the finger and a long stroke dismissed
//// it, which the pilot club met as « the page scrolls instead of letting me sign » (05.10). Driven by mouse events,
//// the same handler as the touch one (`begin`/`move`), as the sheet's own tests do.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const mocks = vi.hoisted(() => {
  const listeners = new Set()
  const state = {
    sheets: [],
    closeSheet(id) { state.sheets = state.sheets.filter(s => s.id !== id); listeners.forEach(l => l()) },
  }
  return { state, subscribe(l) { listeners.add(l); return () => listeners.delete(l) }, setSheets(s) { state.sheets = s; listeners.forEach(l => l()) } }
})
vi.mock('../store/useUI.js', async () => {
  const React = await import('react')
  const useUI = (selector = s => s) => React.useSyncExternalStore(mocks.subscribe, () => selector(mocks.state), () => selector(mocks.state))
  useUI.getState = () => mocks.state
  return { useUI }
})

let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  mocks.state.sheets = []
  const context = new Proxy({}, { get: () => () => {}, set: () => true })
  HTMLCanvasElement.prototype.getContext = () => context
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA'
  vi.stubGlobal('history', { pushState: vi.fn(), go: vi.fn() })
})
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = ''; vi.unstubAllGlobals(); vi.restoreAllMocks() })

const drag = (target, type, clientY) => {
  const e = new window.Event(type, { bubbles: true })
  Object.defineProperties(e, { button: { value: 0 }, clientX: { value: 40 }, clientY: { value: clientY } })
  target.dispatchEvent(e)
}

describe('the signature pad in a bottom sheet', () => {
  it('keeps a downward stroke to itself: the sheet neither follows the finger nor dismisses', async () => {
    const [{ default: Modals }, { default: SignaturePad }] = await Promise.all([import('./Modals.jsx'), import('./SignaturePad.jsx')])
    host = document.createElement('div'); document.body.appendChild(host)
    root = createRoot(host)
    await act(async () => { root.render(<Modals />) })
    await act(async () => { mocks.setSheets([{ id: 'sign', locked: false, kind: 'sheet', render: () => <SignaturePad /> }]) })
    const sheet = host.querySelector('.sheet')
    const canvas = host.querySelector('canvas')
    sheet.scrollTop = 0

    await act(async () => {
      drag(canvas, 'mousedown', 10)
      drag(sheet, 'mousemove', 70)
      drag(sheet, 'mousemove', 200)
      window.dispatchEvent(new window.Event('mouseup'))
    })

    expect(sheet.style.transform).toBe('')
    expect(mocks.state.sheets.map(s => s.id)).toEqual(['sign'])
  })
})
