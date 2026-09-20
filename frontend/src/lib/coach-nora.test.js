// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// The Coach through the club's Nora: the request goes to the instance, with the
//// CSRF header and the session, and Frappe's envelope is peeled off the answer.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

beforeEach(() => { window.gym_boot = { csrf_token: 'tok', coach: { enabled: true, provider: 'nora', model: 'nora' } } })
afterEach(() => { delete window.gym_boot; vi.resetModules() })

const load = async () => await import('./coach-nora.js')

describe('how long to wait before asking again', () => {
  //: 🔴 Nora's proxy sends TWO different 503s. `service_unavailable` is
  //: back-pressure and its wait is COMPUTED (2-30 s). `upstream_unavailable`
  //: means the engine is restarting: its `retry_after: 20` is a fixed
  //: optimistic guess, and the real wait was measured at 115 to 320 s. The
  //: pipeline's own delays are 2 s then 5 s — both burnt in seven seconds,
  //: for an outage that has not begun to clear.
  const body = error => ({ message: { error } })
  const withHeader = value => ({ headers: { get: n => (n === 'Retry-After' ? value : null) } })

  it('gives up at once while the engine is restarting', async () => {
    const { waitBeforeRetry } = await load()
    expect(waitBeforeRetry(body({ type: 'upstream_unavailable', retry_after: 20 }), null)).toBe(false)
  })

  it('honours a computed back-pressure wait, in milliseconds', async () => {
    const { waitBeforeRetry } = await load()
    expect(waitBeforeRetry(body({ type: 'service_unavailable', retry_after: 7 }), null)).toBe(7000)
  })

  it('reads the header when the body carries no wait', async () => {
    const { waitBeforeRetry } = await load()
    expect(waitBeforeRetry(body({ type: 'service_unavailable' }), withHeader('12'))).toBe(12000)
  })

  it('falls back to the caller\u2019s own delays when the wait is absent or absurd', async () => {
    const { waitBeforeRetry } = await load()
    expect(waitBeforeRetry(body({ message: 'busy' }), null)).toBe(null)
    expect(waitBeforeRetry(body({ retry_after: 9000 }), null)).toBe(null)
    expect(waitBeforeRetry(body({ retry_after: -1 }), null)).toBe(null)
    expect(waitBeforeRetry(null, null)).toBe(null)
  })

  it('is the spec\u2019s own hook, so the pipeline uses it', async () => {
    const { noraSpec, waitBeforeRetry } = await load()
    expect(noraSpec.waitBeforeRetry).toBe(waitBeforeRetry)
  })
})

describe('the Nora adapter', () => {
  it('posts the chat-completions body to the instance with the CSRF header and the session', async () => {
    const { noraAdapter, noraCfg, noraFetch, setJobKind } = await load()
    setJobKind('create')
    const calls = []
    const fetchImpl = vi.fn(async (url, init) => { calls.push({ url, init }); return { ok: true, status: 200, text: async () => JSON.stringify({ message: { choices: [{ message: { content: '{"ok":true}' }, finish_reason: 'stop' }] } }) } })
    const r = await noraAdapter.invoke({ cfg: noraCfg(), prompt: 'hello', env: {}, model: 'nora', fetch: fetchImpl })
    expect(r.code).toBe(0)
    expect(r.text).toBe('{"ok":true}')
    expect(calls[0].url).toBe(window.location.origin + '/api/method/neoffice_gym.api.coach_ai.chat_completions')
    expect(calls[0].init.headers['X-Frappe-CSRF-Token']).toBe('tok')
    expect(calls[0].init.headers['X-Coach-Kind']).toBe('create')
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
