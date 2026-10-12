// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The club's picks (S.clubPicks, « Featured by the club » at the desk) lead the exercise picker's list, in the unfiltered list and in a
//// search alike, and the rest keeps its order. The picks' own chip and the member's own lists are left alone.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { createRoot } from 'react-dom/client'
import { EXDB } from './lib/exercises.js'
import { exerciseNameFor } from './lib/i18n.js'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { exercisePicker } from './sheets.jsx'
import { bindUI } from './components/ui.jsx'

const mounted = []
function openPicker() {
  exercisePicker(() => {})
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
const closeAll = () => { act(() => { mounted.splice(0).forEach(([root, h]) => { root.unmount(); h.remove() }) }); useUI.setState({ sheets: [] }) }
const rows = host => [...host.querySelectorAll('.item')].filter(r => r.querySelector('.tt') && !r.classList.contains('ex-new')).map(r => r.querySelector('.tt').textContent)
const search = (host, q) => act(() => {
  const input = host.querySelector('input')
  Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(input, q)
  input.dispatchEvent(new Event('input', { bubbles: true }))
})
const setPicks = clubPicks => useStore.setState(s => ({ S: { ...s.S, clubPicks } }))
const nameOf = id => exerciseNameFor(EXDB.find(e => e.id === id))

// exercises far down the catalogue: nothing but the club's say would put them first
const catalogue = EXDB.filter(e => !e.custom)
const picks = [catalogue.at(-1).id, catalogue.at(-40).id, catalogue.at(-90).id]

beforeEach(() => {
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  bindUI(useUI)
  useUI.setState({ sheets: [] })
  document.body.innerHTML = ''
  useStore.setState(s => ({ S: { ...s.S, unit: 'kg', level: 'full', routines: [], workouts: [], favEx: [], customEx: [], equipProfiles: [], clubPicks: [] } }))
})
afterEach(closeAll)

describe('exercise picker — the club\'s picks first', () => {
  it('the unfiltered list starts with the picks, and the rest keeps the order it had', () => {
    const plain = rows(openPicker())
    expect(plain.length).toBeGreaterThan(20)
    for (const id of picks) expect(plain.slice(0, 50)).not.toContain(nameOf(id))    // nothing else would show them first
    closeAll()
    setPicks(picks)
    const led = rows(openPicker())
    expect(new Set(led.slice(0, 3))).toEqual(new Set(picks.map(nameOf)))
    expect(led.slice(3, 40)).toEqual(plain.slice(0, 37))
  })

  it('a search lists a matching pick before the other matches', () => {
    const q = 'press'
    const pick = catalogue.filter(e => /press/i.test(exerciseNameFor(e))).at(-1).id          // the last « press » of the catalogue
    let host = openPicker()
    search(host, q)
    const plain = rows(host)
    expect(plain.length).toBeGreaterThan(5)
    expect(plain[0]).not.toBe(nameOf(pick))
    closeAll()
    setPicks([pick])
    host = openPicker()
    search(host, q)
    const led = rows(host)
    expect(led[0]).toBe(nameOf(pick))
    expect(led.slice(1, 20)).toEqual(plain.filter(n => n !== nameOf(pick)).slice(0, 19))
  })

  it('the picks\' own chip still lists them and nothing else', () => {
    setPicks(picks)
    const host = openPicker()
    const chip = [...host.querySelectorAll('button.chip')].find(b => b.querySelector('.icn') && /Recommended/.test(b.textContent))
    expect(chip).toBeTruthy()
    act(() => { chip.click() })
    expect(new Set(rows(host))).toEqual(new Set(picks.map(nameOf)))
  })
})
