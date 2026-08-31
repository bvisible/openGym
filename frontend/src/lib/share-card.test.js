// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The share card. What is pinned is the promise made to the member and the
//// promise made to the club:
////   * nothing the member did not tick ends up on the image;
////   * an empty value is never drawn, because a card saying "0 kg" reads as a
////     failed session;
////   * the club's name and logo are NOT optional — the whole feature exists so
////     the member advertises the club;
////   * cancelling the share sheet is not an error.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { drawShareCard, shareCard, SHAREABLE } from './share-card.js'

const drawn = []
const ctx = new Proxy({}, {
  get: (_t, prop) => {
    if (prop === 'fillText') return (text) => drawn.push(String(text))
    if (prop === 'drawImage') return () => drawn.push('[image]')
    if (prop === 'measureText') return () => ({ width: 100 })
    return () => {}
  },
  set: () => true,
})

beforeEach(() => {
  drawn.length = 0
  global.HTMLCanvasElement.prototype.getContext = () => ctx
  global.HTMLCanvasElement.prototype.toBlob = function (cb) { cb(new Blob(['x'], { type: 'image/png' })) }
  global.Image = class { set src(_v) { setTimeout(() => this.onload && this.onload(), 0) } }
})
afterEach(() => { vi.restoreAllMocks() })

const LABELS = { done: 'Séance faite', duration: 'Durée', exercises: 'Exercices',
                 volume: 'Poids soulevé', sets: 'Séries', records: 'Records' }
const WORKOUT = { name: 'Haut du corps', date: '31 août', duration: '48 min',
                  exercises: 5, sets: 18, volume: 2400, records: 2 }
const CLUB = { name: 'Olympia Fitness', logo: null }

describe('share card', () => {
  it('draws only what the member ticked', async () => {
    await drawShareCard({ workout: WORKOUT, club: CLUB, picked: new Set(['duration']), labels: LABELS })
    expect(drawn).toContain('48 min')
    expect(drawn).not.toContain('18')      // sets not ticked
    expect(drawn.join(' ')).not.toContain('2400')
  })

  it('never draws an empty value, even when ticked', async () => {
    // A card announcing "0 kg" reads as a failed session.
    await drawShareCard({
      workout: { ...WORKOUT, volume: 0, records: 0 },
      club: CLUB, picked: new Set(SHAREABLE), labels: LABELS,
    })
    expect(drawn.join(' ')).not.toContain('0 kg')
    expect(drawn).not.toContain('0')
  })

  it('always carries the club, whatever the member ticked', async () => {
    // The whole point of the feature, in the client's framing.
    await drawShareCard({ workout: WORKOUT, club: CLUB, picked: new Set(), labels: LABELS })
    expect(drawn).toContain('Olympia Fitness')
    expect(drawn).toContain('Séance faite')
  })

  it('survives a club with no logo', async () => {
    const blob = await drawShareCard({ workout: WORKOUT, club: { name: 'X', logo: null },
                                       picked: new Set(['duration']), labels: LABELS })
    expect(blob).toBeTruthy()
  })
})

describe('handing the card over', () => {
  it('uses the system share sheet when there is one', async () => {
    global.navigator.canShare = () => true
    global.navigator.share = vi.fn(() => Promise.resolve())
    expect(await shareCard(new Blob(['x']), 'a.png', 'club')).toBe('shared')
  })

  it('reports a cancelled share as cancelled, not as a failure', async () => {
    // Somebody changing their mind must not be shown an error.
    global.navigator.canShare = () => true
    global.navigator.share = () => Promise.reject(Object.assign(new Error('x'), { name: 'AbortError' }))
    expect(await shareCard(new Blob(['x']), 'a.png', 'club')).toBe('cancelled')
  })

  it('falls back to a download when the browser cannot share files', async () => {
    global.navigator.canShare = undefined
    global.URL.createObjectURL = () => 'blob:x'
    global.URL.revokeObjectURL = () => {}
    expect(await shareCard(new Blob(['x']), 'a.png', 'club')).toBe('downloaded')
  })
})
