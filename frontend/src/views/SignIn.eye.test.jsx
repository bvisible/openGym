// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The password eye: what is typed can be shown, and showing it never submits.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('../lib/api.js', () => ({ BOOT: { app_title: 'Olympia', app_icon: null, lang: 'fr' }, login: vi.fn(), forgotPassword: vi.fn() }))

let root, host
beforeEach(() => { globalThis.IS_REACT_ACT_ENVIRONMENT = true; vi.resetModules() })
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

const mount = async () => {
  const { default: SignIn } = await import('./SignIn.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<SignIn />) })
  return host
}

describe('the password eye', () => {
  it('starts hidden, shows on tap, hides again', async () => {
    const h = await mount()
    const input = h.querySelector('input[autocomplete="current-password"]')
    const eye = h.querySelector('.signin-eye')
    expect(input.type).toBe('password')
    expect(eye, 'no eye button').not.toBeNull()
    await act(async () => { eye.click() })
    expect(input.type).toBe('text')
    expect(eye.getAttribute('aria-pressed')).toBe('true')
    await act(async () => { eye.click() })
    expect(input.type).toBe('password')
  })

  it('is a button that never submits the form', async () => {
    //// A <button> inside a <form> submits by default. Tapping the eye with
    //// an empty form would then fire validation — the wrong surprise.
    const h = await mount()
    expect(h.querySelector('.signin-eye').getAttribute('type')).toBe('button')
  })
})
