// @vitest-environment happy-dom
import { afterEach, describe, expect, it } from 'vitest'
import { deviceOf, signIn, webauthnOK } from './api.js'

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

describe('signIn', () => {
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
