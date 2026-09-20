// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// « Aider à écrire au coach » (lot B): the member writes in the logbook and
//// the message lands in the club's messenger. The Coach's help is optional —
//// without the club's tick the box still sends — and it never sends anything
//// by itself.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const mocks = vi.hoisted(() => ({
  askable: vi.fn(() => true),
  explainExercise: vi.fn(async () => ''),
  wordItForCoach: vi.fn(async () => 'Bonjour, mon dos me fait mal au soulevé de terre depuis deux semaines.'),
  sendToCoach: vi.fn(async () => ({ channel: 'ch1', url: '/raven/channel/ch1' })),
}))
vi.mock('./lib/coach-ask.js', () => ({
  askable: mocks.askable, explainExercise: mocks.explainExercise, wordItForCoach: mocks.wordItForCoach,
}))
vi.mock('./lib/api.js', async importOriginal => ({
  ...(await importOriginal()),
  sendToCoach: mocks.sendToCoach,
}))

const { writeToCoachSheet } = await import('./sheets.jsx')

const mounted = []
const COACH = { name: 'Coach Démo', reachable: true }

function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push(root)
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}

const buttonSaying = (host, re) => [...host.querySelectorAll('button')].find(b => re.test(b.textContent))
const type = (host, value) => {
  const box = host.querySelector('textarea')
  act(() => {
    const setter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, 'value').set
    setter.call(box, value)
    box.dispatchEvent(new Event('input', { bubbles: true }))
  })
  return box
}

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
  mocks.askable.mockReturnValue(true)
  mocks.wordItForCoach.mockResolvedValue('Bonjour, mon dos me fait mal au soulevé de terre depuis deux semaines.')
  mocks.sendToCoach.mockResolvedValue({ channel: 'ch1', url: '/raven/channel/ch1' })
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.clearAllMocks()
})

describe('the help is optional', () => {
  it('offers to word it when the club allows it', () => {
    writeToCoachSheet(COACH)
    const host = renderTop()
    expect(buttonSaying(host, /Help me word it/)).toBeTruthy()
    expect(mocks.askable).toHaveBeenCalledWith('messageCoach')
  })

  it('still sends when the club unticked it — the AI is the help, not the channel', async () => {
    mocks.askable.mockReturnValue(false)
    writeToCoachSheet(COACH)
    const host = renderTop()
    expect(buttonSaying(host, /Help me word it/)).toBeFalsy()
    expect(host.querySelector('textarea')).toBeTruthy()
    type(host, 'mal au dos')
    await act(async () => { buttonSaying(host, /^Send$/).click() })
    expect(mocks.sendToCoach).toHaveBeenCalledWith('mal au dos')
  })
})

describe('nothing leaves without the member', () => {
  it('cannot send an empty message', () => {
    writeToCoachSheet(COACH)
    const host = renderTop()
    expect(buttonSaying(host, /^Send$/).disabled).toBe(true)
    type(host, '   ')
    expect(buttonSaying(host, /^Send$/).disabled).toBe(true)
  })

  it('puts what the Coach wrote in the box, and sends nothing on its own', async () => {
    writeToCoachSheet(COACH)
    const host = renderTop()
    type(host, 'jai mal au dos')
    await act(async () => { buttonSaying(host, /Help me word it/).click() })
    expect(mocks.wordItForCoach).toHaveBeenCalledWith('jai mal au dos')
    expect(host.querySelector('textarea').value).toContain('mon dos me fait mal')
    //: The member reads it over. Wording is not sending.
    expect(mocks.sendToCoach).not.toHaveBeenCalled()
  })

  it('sends what is in the box, edits included', async () => {
    writeToCoachSheet(COACH)
    const host = renderTop()
    type(host, 'jai mal au dos')
    await act(async () => { buttonSaying(host, /Help me word it/).click() })
    type(host, 'Bonjour, mon dos me fait mal. Je peux passer jeudi ?')
    await act(async () => { buttonSaying(host, /^Send$/).click() })
    expect(mocks.sendToCoach).toHaveBeenCalledWith('Bonjour, mon dos me fait mal. Je peux passer jeudi ?')
  })
})

describe('landing in the conversation', () => {
  //: 🔴 Opening a sheet pushes a history entry (Modals.jsx) and closing one
  //: answers with `history.go(-1)`. A traversal CANCELS a navigation issued
  //: right after it, so closing before leaving lost the member on the settings
  //: screen with their message already sent. Measured on osiris, 2026-09-20.
  it('leaves for the conversation WITHOUT closing the sheet first', async () => {
    const href = []
    const original = Object.getOwnPropertyDescriptor(window, 'location')
    delete window.location
    window.location = { set href(v) { href.push(v) }, get href() { return href[href.length - 1] || '' } }
    try {
      writeToCoachSheet(COACH)
      const host = renderTop()
      type(host, 'bonjour')
      await act(async () => { buttonSaying(host, /^Send$/).click() })
      expect(href).toEqual(['/raven/channel/ch1'])
      expect(useUI.getState().sheets).toHaveLength(1, 'closing first would cancel the navigation')
    } finally {
      if (original) Object.defineProperty(window, 'location', original)
    }
  })

  it('closes and says so when the server gave no conversation to go to', async () => {
    mocks.sendToCoach.mockResolvedValue({ channel: 'ch1' })
    writeToCoachSheet(COACH)
    const host = renderTop()
    type(host, 'bonjour')
    await act(async () => { buttonSaying(host, /^Send$/).click() })
    expect(useUI.getState().sheets).toHaveLength(0)
    expect(useUI.getState().toastMsg).toContain('Sent to your coach.')
  })
})

describe('when it does not work', () => {
  it('says so and keeps what the member typed', async () => {
    mocks.wordItForCoach.mockRejectedValue(new Error('Your club has not enabled this from the AI coach.'))
    writeToCoachSheet(COACH)
    const host = renderTop()
    type(host, 'jai mal au dos')
    await act(async () => { buttonSaying(host, /Help me word it/).click() })
    expect(useUI.getState().toastMsg).toContain('Your club has not enabled this')
    expect(host.querySelector('textarea').value).toBe('jai mal au dos')
  })

  it('keeps the sheet open when the message could not be sent', async () => {
    mocks.sendToCoach.mockRejectedValue(new Error('No coach follows you yet. Ask your club.'))
    writeToCoachSheet(COACH)
    const host = renderTop()
    type(host, 'bonjour')
    await act(async () => { buttonSaying(host, /^Send$/).click() })
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(useUI.getState().toastMsg).toContain('No coach follows you yet.')
  })
})
