//// Neoffice — added file (no upstream equivalent).
// @vitest-environment happy-dom
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

globalThis.IS_REACT_ACT_ENVIRONMENT = true

const loadLogo = vi.fn()
vi.mock('../lib/share/render.js', () => ({ loadLogo: (...a) => loadLogo(...a) }))
import ClubLogo from './ClubLogo.jsx'

let host, root
beforeEach(() => { host = document.createElement('div'); document.body.appendChild(host); root = createRoot(host); loadLogo.mockReset() })
afterEach(() => { act(() => root.unmount()); host.remove() })
const mount = async src => { await act(async () => { root.render(<ClubLogo src={src} alt="Club" />) }) }

describe('the club logo on the sign-in screen', () => {
  it('stands on the white plate by default, and keeps its alt text', async () => {
    loadLogo.mockResolvedValue({ light: false })
    await mount('/files/logo.png')
    const img = host.querySelector('img.signin-logo')
    expect(img.getAttribute('src')).toBe('/files/logo.png')
    expect(img.getAttribute('alt')).toBe('Club')
    expect(img.classList.contains('on-dark')).toBe(false)
  })

  it('a bright wordmark on a transparent background gets the dark plate', async () => {
    loadLogo.mockResolvedValue({ light: true })
    await mount('/files/logo-yellow.png')
    expect(host.querySelector('img.signin-logo').classList.contains('on-dark')).toBe(true)
  })

  it('a logo that cannot be read back keeps the white plate, and nothing throws', async () => {
    loadLogo.mockResolvedValue(null)
    await mount('/files/gone.png')
    expect(host.querySelector('img.signin-logo').classList.contains('on-dark')).toBe(false)
    loadLogo.mockRejectedValue(new Error('x'))
    await mount('/files/other.png')
    expect(host.querySelector('img.signin-logo').classList.contains('on-dark')).toBe(false)
  })
})
