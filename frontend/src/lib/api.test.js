// @vitest-environment happy-dom
import { afterEach, describe, expect, it, vi } from 'vitest'
import { deviceOf, signIn, webauthnOK } from './api.js'   //// Neoffice — what our api.js exports: no passkeys, vault or biometrics

const originalPublicKeyCredential = window.PublicKeyCredential
const originalCredentials = navigator.credentials

function setCapability(target, property, value) {
  Object.defineProperty(target, property, { configurable: true, value })
}

afterEach(() => {
  setCapability(window, 'PublicKeyCredential', originalPublicKeyCredential)
  setCapability(navigator, 'credentials', originalCredentials)
})

describe('webauthnOK', () => {
  it('accepts WebAuthn when PublicKeyCredential is exposed', () => {
    setCapability(window, 'PublicKeyCredential', class PublicKeyCredential {})
    setCapability(navigator, 'credentials', {})
    expect(webauthnOK()).toBe(true)
  })

  it('does not reject WebAuthn when the generic credentials check is unavailable', () => {
    setCapability(window, 'PublicKeyCredential', class PublicKeyCredential {})
    setCapability(navigator, 'credentials', undefined)
    expect(webauthnOK()).toBe(true)
  })

  it('rejects browsers without the WebAuthn credential type', () => {
    setCapability(window, 'PublicKeyCredential', undefined)
    setCapability(navigator, 'credentials', {})
    expect(webauthnOK()).toBe(false)
  })
})

//// Neoffice — the device the journal declares at sign-in (see deviceOf in api.js).
describe('deviceOf', () => {
  const nav = (userAgent, maxTouchPoints = 0) => ({ userAgent, maxTouchPoints })
  it('a phone or a tablet is mobile', () => {
    expect(deviceOf(nav('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)'))).toBe('mobile')
    expect(deviceOf(nav('Mozilla/5.0 (Linux; Android 14; Pixel 8)'))).toBe('mobile')
    expect(deviceOf(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 5))).toBe('mobile') // iPadOS
  })
  it('a desktop browser is a desk', () => {
    expect(deviceOf(nav('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7)', 0))).toBe('desktop')
    expect(deviceOf(nav('Mozilla/5.0 (Windows NT 10.0; Win64; x64)'))).toBe('desktop')
    expect(deviceOf(null)).toBe('desktop')
  })
})

//// Neoffice — upstream's v1.3.9 tests of the same rule, on our paths (Frappe methods answer a JSON
//// object, `{message}` for a value): a 2xx that is not JSON is somebody else answering.
describe('api() refuses an answer that is not the server\'s', () => {
  const html = () => new Response('<!doctype html><title>Sign in</title>', { status: 200, headers: { 'content-type': 'text/html' } })
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original })

  it('a 200 page of HTML is an error with the status it came with, a push included', async () => {   //// Neoffice — our Frappe paths
    const { api } = await import('./api.js')
    globalThis.fetch = async () => html()   //// Neoffice — fetch replaced by hand, as the tests below do
    await expect(api('/api/method/neoffice_gym.api.state.put', { method: 'POST', body: '{}' })).rejects.toMatchObject({ code: 'bad-response', status: 200 })
    await expect(api('/api/method/neoffice_gym.api.state.get')).rejects.toMatchObject({ code: 'bad-response', status: 200 })
  })

  it('a JSON answer still comes back as it is, unwrapped from Frappe\'s message', async () => {   //// Neoffice — Frappe's {message} envelope
    const { api } = await import('./api.js')
    globalThis.fetch = async () => new Response(JSON.stringify({ message: { ok: true, rev: 4 } }), { status: 200, headers: { 'content-type': 'application/json' } })   //// Neoffice — Frappe's {message} envelope
    await expect(api('/api/method/neoffice_gym.api.state.put', { method: 'POST', body: '{}' })).resolves.toEqual({ ok: true, rev: 4 })
    globalThis.fetch = async () => new Response('{}', { status: 200, headers: { 'content-type': 'application/json' } })
    await expect(api('/api/method/x')).resolves.toEqual({})
  })

  it('a refused request whose body is not JSON keeps its HTTP status', async () => {
    const { api } = await import('./api.js')
    globalThis.fetch = async () => new Response('<html>Bad gateway</html>', { status: 502, headers: { 'content-type': 'text/html' } })   //// Neoffice — our Frappe paths
    await expect(api('/api/method/x')).rejects.toMatchObject({ status: 502, message: 'HTTP 502', data: {} })
  })
})

//// Neoffice — upstream's v1.3.9 tests of the limits, on our api() (see TIMEOUT_GET_MS).
describe('api() gives up on a request that never answers', () => {
  const original = globalThis.fetch
  afterEach(() => { globalThis.fetch = original; vi.useRealTimers() })
  const hang = () => {
    const seen = []
    globalThis.fetch = vi.fn((url, init) => { seen.push(init.signal); return new Promise(() => {}) })   //// Neoffice — fetch replaced by hand
    return seen
  }

  it('a GET after 20 s, and the request itself is aborted', async () => {
    vi.useFakeTimers()
    const { api } = await import('./api.js')
    const signals = hang()
    const p = api('/api/method/neoffice_gym.api.state.rev')   //// Neoffice — our Frappe paths
    const done = vi.fn()
    p.catch(done)
    await vi.advanceTimersByTimeAsync(19000)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(1500)
    await expect(p).rejects.toMatchObject({ code: 'timeout', status: undefined })
    expect(signals[0].aborted).toBe(true)
  })

  it('a write after 60 s, since it carries the whole profile', async () => {   //// Neoffice — a POST to a whitelisted method, not upstream's PUT
    vi.useFakeTimers()
    const { api } = await import('./api.js')
    hang()
    const p = api('/api/method/neoffice_gym.api.state.put', { method: 'POST', body: '{}' })   //// Neoffice — our Frappe paths
    const done = vi.fn()
    p.catch(done)
    await vi.advanceTimersByTimeAsync(30000)
    expect(done).not.toHaveBeenCalled()
    await vi.advanceTimersByTimeAsync(31000)
    await expect(p).rejects.toMatchObject({ code: 'timeout' })
  })

  it('a caller that knows its request is slow sets its own limit, and the option is not sent along', async () => {
    vi.useFakeTimers()
    const { api } = await import('./api.js')
    hang()
    const p = api('/api/method/x', { method: 'POST', body: '{}', timeout: 150000 })   //// Neoffice — our Frappe paths
    const done = vi.fn()
    p.catch(done)
    await vi.advanceTimersByTimeAsync(120000)
    expect(done).not.toHaveBeenCalled()
    expect('timeout' in globalThis.fetch.mock.calls[0][1]).toBe(false)   //// Neoffice — fetch replaced by hand
    await vi.advanceTimersByTimeAsync(31000)
    await expect(p).rejects.toMatchObject({ code: 'timeout' })
  })
})

describe('api()', () => {   //// Neoffice — upstream's own api() test follows
  it('a failed request throws with the status and the parsed body attached', async () => {
    const { api } = await import('./api.js')
    const original = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ error: 'conflict', rev: 3, state: { _rev: 3 } }) })
    try {
      await expect(api('/api/data', { method: 'PUT', body: '{}' })).rejects.toMatchObject({
        message: 'conflict', status: 409, data: { error: 'conflict', rev: 3, state: { _rev: 3 } }
      })
    } finally { globalThis.fetch = original }
  })

  //// Neoffice — the same, in the shape Frappe gives it: a whitelisted method
  //// that answers 409 still wraps its return value in {message: …}. The store
  //// reads e.data.state whichever server sent it, so the unwrapping happens here.
  it('unwraps a Frappe-shaped error body the same way', async () => {
    const { api } = await import('./api.js')
    const original = globalThis.fetch
    globalThis.fetch = async () => ({ ok: false, status: 409, json: async () => ({ message: { error: 'conflict', rev: 3, state: { _rev: 3 } } }) })
    try {
      await expect(api('/api/method/neoffice_gym.api.state.put', { method: 'POST', body: '{}' })).rejects.toMatchObject({
        message: 'conflict', status: 409, data: { error: 'conflict', rev: 3, state: { _rev: 3 } }
      })
    } finally { globalThis.fetch = original }
  })
})

describe('signIn', () => {   //// Neoffice — our sign-in, through Frappe's login
  const originalFetch = globalThis.fetch
  afterEach(() => { globalThis.fetch = originalFetch })
  it('posts usr, pwd and the device to Frappe', async () => {
    let seen = null
    globalThis.fetch = async (url, init) => { seen = { url, body: JSON.parse(init.body) }; return { ok: true, status: 200, json: async () => ({ message: 'Logged In' }) } }
    await signIn('a@b.c', 'secret', 'mobile')
    expect(seen.url).toBe('/api/method/login')
    expect(seen.body).toEqual({ usr: 'a@b.c', pwd: 'secret', device: 'mobile' })
  })
})
