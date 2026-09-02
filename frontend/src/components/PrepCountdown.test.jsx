// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/sound.js', () => ({ beep: vi.fn(), vibrate: vi.fn() }))

let root, host, useUI
beforeEach(async () => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.useFakeTimers(); vi.resetModules()
  ;({ useUI } = await import('../store/useUI.js'))
})
afterEach(async () => { await act(async () => { root?.unmount() }); useUI.getState().cancelPrep(); useUI.getState().stopWork(); vi.useRealTimers(); document.body.innerHTML = '' })

const mount = async () => {
  const { default: PrepCountdown } = await import('./PrepCountdown.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<PrepCountdown />) })
  return host
}

describe('the countdown overlay', () => {
  it('draws nothing when no count is running', async () => {
    const h = await mount()
    expect(h.querySelector('.prep')).toBeNull()
  })

  it('shows the number and the exercise, big', async () => {
    const h = await mount()
    await act(async () => { useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn()) })
    expect(h.querySelector('.prep-n').textContent).toBe('3')
    expect(h.textContent).toContain('Planche')
    await act(async () => { vi.advanceTimersByTime(1000) })
    expect(h.querySelector('.prep-n').textContent).toBe('2')
  })

  it('a tap anywhere starts the hold; cancel does not', async () => {
    const h = await mount()
    await act(async () => { useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn()) })
    await act(async () => { h.querySelector('.prep').click() })
    expect(useUI.getState().work).toMatchObject({ total: 45 })
    await act(async () => { useUI.getState().stopWork(); useUI.getState().startWorkWithPrep(45, 'Planche', vi.fn()) })
    await act(async () => { h.querySelector('.prep-cancel').click() })
    expect(useUI.getState().prep).toBeNull()
    expect(useUI.getState().work).toBeNull()
  })
})
