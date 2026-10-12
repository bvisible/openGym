// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The Share button of a workout row (WorkoutRow `onShare`) and the sheet it opens (shareWorkoutImageSheet): sharing a session should
//// be one tap away, and a button two screens away is a button nobody finds. The row's own tap still opens the detail.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { WorkoutRow, shareWorkoutImageSheet } from './sheets.jsx'

const mounted = []
const host = () => { const h = document.createElement('div'); document.body.appendChild(h); return h }
function mountNode(node) {
  const h = host()
  const root = createRoot(h)
  mounted.push([root, h])
  act(() => root.render(node))
  return h
}
const w = { id: 'w1', d: '2026-09-07', name: 'Push', start: 1000, end: 1000 + 45 * 60000, vol: 1200, entries: [], routineId: null }

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', routines: [], workouts: [w], active: null } }))
  document.body.innerHTML = ''
})
afterEach(() => { act(() => { mounted.splice(0).forEach(([root, h]) => { root.unmount(); h.remove() }) }) })

describe('WorkoutRow — the Share button', () => {
  it('has none unless the list asks for it', () => {
    const h = mountNode(<WorkoutRow w={w} onClick={() => {}} />)
    expect(h.querySelector('.wrow-share')).toBeNull()
  })

  it('is a visible, labelled button: the word and a glyph, announced as sharing an image', () => {
    const h = mountNode(<WorkoutRow w={w} onClick={() => {}} onShare={() => {}} />)
    const b = h.querySelector('button.wrow-share')
    expect(b).toBeTruthy()
    expect(b.textContent).toBe('Share')
    expect(b.getAttribute('aria-label')).toBe('Share as image')
    expect(b.querySelector('svg, .icn')).toBeTruthy()
  })

  it('hands the workout to onShare and does not open the detail with the same tap', () => {
    const onClick = vi.fn(), onShare = vi.fn()
    const h = mountNode(<WorkoutRow w={w} onClick={onClick} onShare={onShare} />)
    act(() => { h.querySelector('.wrow-share').click() })
    expect(onShare).toHaveBeenCalledWith(w)
    expect(onClick).not.toHaveBeenCalled()
    act(() => { h.querySelector('.item .tt').click() })
    expect(onClick).toHaveBeenCalledTimes(1)
  })

  it('is its own tap target for the keyboard: Enter on it shares, it does not trigger the row', () => {
    const onClick = vi.fn(), onShare = vi.fn()
    const h = mountNode(<WorkoutRow w={w} onClick={onClick} onShare={onShare} />)
    const b = h.querySelector('.wrow-share')
    act(() => { b.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter', bubbles: true })) })
    expect(onClick).not.toHaveBeenCalled()
  })
})

describe('shareWorkoutImageSheet', () => {
  it('opens the share-as-image sheet of the saved workout, straight from a list', () => {
    shareWorkoutImageSheet({ ...w, name: 'The row\'s copy' })
    const sheet = useUI.getState().sheets.at(-1)
    expect(sheet).toBeTruthy()
    const h = mountNode(sheet.render(() => useUI.getState().closeSheet(sheet.id)))
    expect(h.querySelector('h3').textContent).toBe('Share workout')
    expect([...h.querySelectorAll('button')].some(b => b.textContent.trim() === 'Share')).toBe(true)
  })
})
