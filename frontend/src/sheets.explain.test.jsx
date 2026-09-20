// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// « Expliquer un exercice » (lot B) on the exercise sheet: the club's switch
//// decides the button exists, and the answer is rendered as paragraphs — or
//// the refusal is, in the club's own words.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'

const mocks = vi.hoisted(() => ({
  askable: vi.fn(() => true),
  explainExercise: vi.fn(async () => 'Le premier paragraphe.\n\nLe second.'),
}))
vi.mock('./lib/coach-ask.js', () => mocks)

const { exerciseDetailSheet, explainExerciseSheet } = await import('./sheets.jsx')

const mounted = []

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

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: structuredClone(DEF), user: null })
  document.body.innerHTML = ''
  mocks.askable.mockReturnValue(true)
  mocks.explainExercise.mockResolvedValue('Le premier paragraphe.\n\nLe second.')
})

afterEach(() => {
  act(() => { mounted.splice(0).forEach(root => root.unmount()) })
  vi.clearAllMocks()
})

describe('the button on the exercise sheet', () => {
  it('is offered when the club allows it', () => {
    exerciseDetailSheet(EXDB[0])
    expect(buttonSaying(renderTop(), /Explain this movement/)).toBeTruthy()
    expect(mocks.askable).toHaveBeenCalledWith('explain')
  })

  it('is gone when the club unticked it — and nothing else on the sheet moves', () => {
    mocks.askable.mockReturnValue(false)
    exerciseDetailSheet(EXDB[0])
    const host = renderTop()
    expect(buttonSaying(host, /Explain this movement/)).toBeFalsy()
    //: The rest of the sheet is untouched: a capability removes ITS button.
    expect(buttonSaying(host, /Add to my plan/)).toBeTruthy()
  })
})

describe('the explanation itself', () => {
  it('says it is being written, then renders it in paragraphs', async () => {
    let resolve
    mocks.explainExercise.mockReturnValue(new Promise(r => { resolve = r }))
    explainExerciseSheet(EXDB[0])
    const host = renderTop()
    expect(host.textContent).toContain('The Coach is writing')
    await act(async () => { resolve('Le premier paragraphe.\n\nLe second.') })
    expect(host.querySelectorAll('.coach-explain p')).toHaveLength(2)
    expect(host.textContent).toContain('Le premier paragraphe.')
    expect(host.textContent).not.toContain('The Coach is writing')
  })

  it('shows the refusal in the words the server used', async () => {
    mocks.explainExercise.mockRejectedValue(new Error('Your club has not enabled this from the AI coach.'))
    explainExerciseSheet(EXDB[0])
    let host
    await act(async () => { host = renderTop() })
    expect(host.textContent).toContain('Your club has not enabled this from the AI coach.')
    expect(host.querySelector('.coach-explain')).toBeFalsy()
  })

  it('asks for THIS exercise', () => {
    const ex = EXDB[3]
    explainExerciseSheet(ex)
    renderTop()
    expect(mocks.explainExercise).toHaveBeenCalledWith(ex)
  })
})
