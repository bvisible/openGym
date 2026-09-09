// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The Coach through the club's Nora: the request goes to the instance, with the
//// CSRF header and the session, and Frappe's envelope is peeled off the answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { window.gym_boot = { csrf_token: 'tok', coach: { enabled: true, provider: 'nora', model: 'nora' } } })
afterEach(() => { delete window.gym_boot; vi.resetModules() })

const load = async () => await import('./coach-nora.js')

describe('the Nora adapter', () => {
  it('posts the chat-completions body to the instance with the CSRF header and the session', async () => {
    const { noraAdapter, noraCfg, noraFetch } = await load()
    const calls = []
    const fetchImpl = vi.fn(async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => JSON.stringify({ message: { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] } }) } })
    const r = await noraAdapter.invoke({ cfg: noraCfg(), prompt: 'hello', env: {}, model: 'nora', fetch: fetchImpl })
    expect(r.code).toBe(0)
    expect(r.text).toBe('{"ok":true}')
    expect(calls[0].url).toBe(window.location.origin + '/api/method/neoffice_gym.api.coach_ai.chat_completions')
    expect(calls[0].init.headers['X-Frappe-CSRF-Token']).toBe('tok')
    const body = JSON.parse(calls[0].init.body)
    expect(body.model).toBe('nora')
    expect(body.messages.map(m => m.role)).toEqual(['system', 'user'])
    expect(body.max_tokens).toBeGreaterThan(0)
    // the transport keeps the session cookie
    const spy = vi.spyOn(globalThis, 'fetch').mockResolvedValue({ ok: true })
    await noraFetch('/x', { method: 'POST' })
    expect(spy.mock.calls[0][1].credentials).toBe('same-origin')
    spy.mockRestore()
  })

  it('reads a Frappe error through its envelope', async () => {
    const { noraAdapter, noraCfg } = await load()
    const fetchImpl = async () => ({ ok: false, status: 403, text: async () => JSON.stringify({ exc_type: 'PermissionError', _server_messages: JSON.stringify([JSON.stringify({ message: 'The AI coach is not enabled by your club.' })]) }) })
    const r = await noraAdapter.invoke({ cfg: noraCfg(), prompt: 'hello', env: {}, model: 'nora', fetch: fetchImpl })
    expect(r.code).toBe(1)
    expect(r.stderr).toMatch(/^403 The AI coach is not enabled/)
  })

  it('is configured only when the boot says so', async () => {
    const { noraConfigured } = await load()
    expect(noraConfigured()).toBe(true)
    window.gym_boot = { coach: { enabled: false } }
    vi.resetModules()
    const again = await load()
    expect(again.noraConfigured()).toBe(false)
  })
})
