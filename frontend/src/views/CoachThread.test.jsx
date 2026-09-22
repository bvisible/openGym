// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// « ÉCRIRE À MON COACH » : ce que l'écran promet au membre.
////
//// Four things are pinned, and all four are promises made to somebody, not
//// details of the markup: a member never names a recipient, a photo travels
//// as a FILE and never as a path, a photo alone is a message, and the day
//// separator is written once per day rather than once per message.
import React, { act } from 'react'
import { createRoot } from 'react-dom/client'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

const api = vi.hoisted(() => ({
  coachThread: vi.fn(),
  coachThreadPost: vi.fn(() => Promise.resolve({ name: 'GMSG-2026-000002' })),
}))
vi.mock('../lib/api.js', () => api)
const nav = vi.fn()
vi.mock('react-router-dom', () => ({ useNavigate: () => nav }))
//: The Coach's wording help is the AI layer, tested where it lives. Here it is
//: mocked away so the conversation can be tested without a model.
vi.mock('../lib/coach-ask.js', () => ({ askable: () => false, wordItForCoach: vi.fn() }))
vi.mock('../coach.css', () => ({}))

let root, host
beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  vi.resetModules()
  api.coachThread.mockReset()
  api.coachThreadPost.mockClear()
  nav.mockReset()
  //: happy-dom has no object URLs, and the preview revokes one on unmount.
  globalThis.URL.createObjectURL = vi.fn(() => 'blob:photo')
  globalThis.URL.revokeObjectURL = vi.fn()
})
afterEach(async () => { await act(async () => { root?.unmount() }); document.body.innerHTML = '' })

const at = iso => iso
const mount = async (payload) => {
  api.coachThread.mockResolvedValue(payload)
  const { default: CoachThread } = await import('./CoachThread.jsx')
  host = document.createElement('div'); document.body.appendChild(host)
  root = createRoot(host)
  await act(async () => { root.render(<CoachThread />) })
  return host
}
const type = async (h, value) => {
  const box = h.querySelector('textarea')
  await act(async () => {
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set.call(box, value)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
}
const click = async (el) => { await act(async () => { el.dispatchEvent(new MouseEvent('click', { bubbles: true })) }) }
const sendBtn = h => [...h.querySelectorAll('button')].find(b => b.getAttribute('aria-label') === 'Send')

describe('the conversation with the coach', () => {
  it('names nobody: writing carries the words, never a recipient', async () => {
    const h = await mount({ coach: { name: 'Coach Démo' }, messages: [] })
    await type(h, 'Je peux passer jeudi ?')
    await click(sendBtn(h))
    //: One argument of substance. The thread is the session's, server-side —
    //: an écran that could name somebody would make that untrue.
    expect(api.coachThreadPost).toHaveBeenCalledWith('Je peux passer jeudi ?', null)
    expect(JSON.stringify(api.coachThreadPost.mock.calls[0])).not.toContain('@')
  })

  it('sends a photo as a file, so no path of ours can be asked for', async () => {
    const h = await mount({ coach: { name: 'Coach Démo' }, messages: [] })
    const file = new File([new Uint8Array([1, 2, 3])], 'machine.png', { type: 'image/png' })
    const picker = h.querySelector('input[type="file"]')
    await act(async () => {
      Object.defineProperty(picker, 'files', { value: [file], configurable: true })
      picker.dispatchEvent(new Event('change', { bubbles: true }))
    })
    //: A photo on its own is a message: somebody showing a machine has
    //: nothing to add to it, and the send button must not stay disabled.
    expect(sendBtn(h).disabled).toBe(false)
    await click(sendBtn(h))
    expect(api.coachThreadPost).toHaveBeenCalledWith('', file)
  })

  it('refuses a file that is not a photo, before uploading anything', async () => {
    const h = await mount({ coach: { name: 'Coach Démo' }, messages: [] })
    const pdf = new File([new Uint8Array([1])], 'contrat.pdf', { type: 'application/pdf' })
    const picker = h.querySelector('input[type="file"]')
    await act(async () => {
      Object.defineProperty(picker, 'files', { value: [pdf], configurable: true })
      picker.dispatchEvent(new Event('change', { bubbles: true }))
    })
    expect(h.textContent).toContain('Only a photo can be sent here.')
    expect(api.coachThreadPost).not.toHaveBeenCalled()
  })

  it('writes the day once, not once per message', async () => {
    const day = new Date()
    day.setHours(9, 0, 0, 0)
    const later = new Date(day.getTime() + 3600000)
    const h = await mount({
      coach: { name: 'Coach Démo' },
      messages: [
        { name: 'a', body: 'bonjour', mine: true, senderName: 'Moi', at: at(day.toISOString()) },
        { name: 'b', body: 'bonjour', mine: false, senderName: 'Coach Démo', at: at(later.toISOString()) },
      ],
    })
    expect(h.querySelectorAll('.msg-day').length).toBe(1)
    expect(h.querySelector('.msg-day').textContent).toBe('Today')
    //: And the name is on the coach's bubble only — a member does not need
    //: to be told who they are.
    const who = [...h.querySelectorAll('.bub-who')].map(e => e.textContent)
    expect(who).toEqual(['Coach Démo'])
  })
})
