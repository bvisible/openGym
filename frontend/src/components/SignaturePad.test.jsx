// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The signature pad inside a bottom sheet: the gesture stays on the pad. The sheet swipes down to dismiss
//// (components/Modals.jsx), and a finger drawing downwards on the pad used to be taken for that swipe: the sheet
//// followed the finger and a long stroke dismissed it (the pilot club, 05.10).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import SignaturePad from './SignaturePad.jsx'

let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  // happy-dom draws nothing: a context that accepts every call is enough to mount the pad
  const context = new Proxy({}, { get: (_, name) => (name === 'scale' || name === 'save' || name === 'restore' ? () => {} : () => {}), set: () => true })
  HTMLCanvasElement.prototype.getContext = () => context
  HTMLCanvasElement.prototype.toDataURL = () => 'data:image/png;base64,AAAA'
})
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

const mount = async (props = {}) => {
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<SignaturePad {...props} />) })
  return host
}

describe('the signature pad', () => {
  it('opts out of the sheet’s swipe-to-dismiss: the sheet looks for [data-nodrag] above the touched element', async () => {
    const h = await mount()
    const canvas = h.querySelector('canvas')
    expect(canvas.closest('[data-nodrag]')).not.toBeNull()
  })

  it('cancels the touch on the canvas itself, with listeners that are allowed to (not passive)', async () => {
    const h = await mount()
    const canvas = h.querySelector('canvas')
    for (const type of ['touchstart', 'touchmove']) {
      const event = new Event(type, { bubbles: true, cancelable: true })
      canvas.dispatchEvent(event)
      expect(event.defaultPrevented, type).toBe(true)
    }
  })

  it('takes the stroke and hands over the picture once the finger lifts', async () => {
    const onChange = vi.fn()
    const h = await mount({ onChange })
    const canvas = h.querySelector('canvas')
    canvas.getBoundingClientRect = () => ({ left: 0, top: 0, width: 300, height: 160 })
    const pointer = (type, x, y) => {
      const e = new Event(type, { bubbles: true, cancelable: true })
      Object.assign(e, { clientX: x, clientY: y, pointerId: 1 })
      canvas.dispatchEvent(e)
    }
    await act(async () => { pointer('pointerdown', 10, 10); pointer('pointermove', 20, 60); pointer('pointerup', 20, 60) })
    expect(onChange).toHaveBeenCalledWith('data:image/png;base64,AAAA')
  })
})
