// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The share sheet (components/ShareSheet.jsx): ONE entry for the picture a member posts after a session — a Photo with their numbers
//// over it, a Numbers card, the Muscles card — with the choices kept on the device and the member's photo never stored nor sent.
//// The drawing itself has its own tests (lib/share/*.test.js); here the renderers are replaced by stand-ins that write down what they
//// were asked for, so the sheet's behaviour is what is checked: what it offers, what it asks the renderer, what it hands over.
import React, { act } from 'react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { createRoot } from 'react-dom/client'

const h = vi.hoisted(() => ({ ingest: null, decode: null, render: null, muscles: null, send: null, copy: null, canCopy: () => true }))
vi.mock('./lib/media-ingest.js', () => ({ ingestMediaFile: (...a) => h.ingest(...a), decodeImage: (...a) => h.decode(...a) }))
vi.mock('./lib/share/render.js', () => ({ renderShare: (...a) => h.render(...a), loadLogo: async () => null, textMeasure: () => () => 0, currentAccent: () => '#30d158' }))
vi.mock('./lib/share/muscles.js', () => ({ renderMuscles: (...a) => h.muscles(...a) }))
vi.mock('./lib/share/send.js', () => ({ sendImage: (...a) => h.send(...a), copyImage: (...a) => h.copy(...a), canCopyImage: () => h.canCopy() }))

import { DEF, useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { _setLangState } from './lib/i18n-core.js'
import { bindUI } from './components/ui.jsx'
import { shareWorkoutImageSheet, workoutDetailSheet } from './sheets.jsx'

bindUI(useUI)

const KEY = 'opengym.share.v1'
const mounted = []
const workout = {
  id: 'w1', d: '2026-09-07', name: 'Push', start: 1000, end: 1000 + 58 * 60000, vol: 4310, prs: ['0025'],
  entries: [{ id: '0025', target: { mode: 'reps' }, sets: [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }] }],
}
const club = { name: 'Riverside Gym', logo: '/files/logo.png', site: 'riverside.example', info: 'Rue du Lac 4' }

const tick = ms => act(async () => { await vi.advanceTimersByTimeAsync(ms) })
const settle = async () => { for (let i = 0; i < 8; i++) await tick(5) }
function renderTop() {
  const sheet = useUI.getState().sheets.at(-1)
  const host = document.createElement('div')
  document.body.appendChild(host)
  const root = createRoot(host)
  mounted.push([root, host])
  act(() => root.render(sheet.render(() => useUI.getState().closeSheet(sheet.id))))
  return host
}
async function open(w = workout) {
  act(() => { shareWorkoutImageSheet(w) })
  const host = renderTop()
  await tick(40)
  return host
}
const buttons = host => [...host.querySelectorAll('button')]
const byText = (host, text) => buttons(host).find(b => b.textContent.trim() === text)
const sw = (host, label) => host.querySelector(`button[role="switch"][aria-label="${label}"]`)
const pressed = host => buttons(host).filter(b => b.getAttribute('aria-pressed') === 'true').map(b => b.textContent.trim())
const lastRender = () => h.render.mock.calls.at(-1)[0]
const stored = () => JSON.parse(localStorage.getItem(KEY))
async function pickPhoto(host, file = new File(['x'], 'IMG_0001.jpg', { type: 'image/jpeg' })) {
  const input = host.querySelector('input[type="file"]:not([capture])')
  Object.defineProperty(input, 'files', { value: [file], configurable: true })
  act(() => { input.dispatchEvent(new Event('change', { bubbles: true })) })
  await settle()
}

let decoded
beforeEach(() => {
  vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] })
  globalThis.IS_REACT_ACT_ENVIRONMENT = true
  useUI.setState({ sheets: [], toastMsg: '' })
  useStore.setState({ S: { ...structuredClone(DEF), unit: 'kg', workouts: [workout], club }, user: null, config: null })
  _setLangState('en', null, null, null)
  localStorage.clear()
  document.body.innerHTML = ''
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:test/1'
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {}
  decoded = { source: { tag: 'photo' }, width: 4000, height: 3000, close: vi.fn() }
  h.render = vi.fn(async o => new Blob([`${o.template}|${o.scale}`], { type: o.type }))
  h.muscles = vi.fn(async () => new Blob(['muscles'], { type: 'image/png' }))
  h.send = vi.fn(async () => 'shared')
  h.copy = vi.fn(async () => 'copied')
  h.canCopy = () => true
  h.ingest = vi.fn(async () => ({ media: { kind: 'image', hash: 'h1' }, blobs: [{ hash: 'h1', blob: new Blob(['jpeg']), mime: 'image/jpeg' }], warnings: [] }))
  h.decode = vi.fn(async () => decoded)
})
afterEach(async () => {
  act(() => { mounted.splice(0).forEach(([root, host]) => { root.unmount(); host.remove() }) })
  vi.useRealTimers()
  vi.restoreAllMocks()
})

describe('the share sheet — what it opens on', () => {
  it('opens on the Photo picture, asks for a photo, and offers the camera and the library', async () => {
    const host = await open()
    expect(host.querySelector('h3').textContent).toBe('Share workout')
    expect(pressed(host)).toContain('Photo')
    expect(host.textContent).toContain('Add a photo to start')
    expect(byText(host, 'Take a photo')).toBeTruthy()
    expect(byText(host, 'Choose a photo')).toBeTruthy()
    expect(host.querySelector('input[type="file"][capture="user"]')).toBeTruthy()
    expect(host.textContent).toContain('Your photo stays on this phone: it is not saved anywhere.')
  })

  it('ticks the duration, the exercises with their loads and the records, and leaves the sets and the total weight to whoever wants them', async () => {
    const host = await open()
    for (const label of ['Duration', 'Exercises', 'Loads', 'Personal records']) expect(sw(host, label).getAttribute('aria-checked'), label).toBe('true')
    for (const label of ['Sets', 'Weight moved']) expect(sw(host, label).getAttribute('aria-checked'), label).toBe('false')
  })

  it('draws the Photo on the feed shape, with the club\'s foot, and asks for no photo yet', async () => {
    await open()
    const call = lastRender()
    expect(call).toMatchObject({ template: 'photo', format: 'feed', photo: null, club })
    expect([...call.picks].sort()).toEqual(['duration', 'exercises', 'records', 'weights'])
  })

  it('draws a small preview first and the full-size picture a moment after the last change', async () => {
    await open()
    expect(h.render.mock.calls[0][0].scale).toBe(0.5)
    expect(h.render.mock.calls.some(([o]) => o.scale === 1)).toBe(false)
    await tick(600)
    const full = h.render.mock.calls.find(([o]) => o.scale === 1)[0]
    expect(full).toMatchObject({ type: 'image/png', template: 'photo' })
  })

  it('keeps only the latest of the changes made while a preview is being drawn and draws it right after: the photo follows the finger', async () => {
    const gates = []
    h.render = vi.fn(o => (o.scale === 0.5 && gates.length === 0
      ? new Promise(resolve => gates.push(() => resolve(new Blob(['first'], { type: o.type }))))
      : Promise.resolve(new Blob(['x'], { type: o.type }))))
    const previews = () => h.render.mock.calls.filter(([o]) => o.scale === 0.5)
    act(() => { shareWorkoutImageSheet(workout) })
    const host = renderTop()
    await tick(5)
    expect(previews()).toHaveLength(1)
    act(() => sw(host, 'Sets').click())
    act(() => sw(host, 'Weight moved').click())
    act(() => sw(host, 'Duration').click())
    await tick(5)
    expect(previews()).toHaveLength(1)   // nothing starts while one is under way
    await act(async () => { gates[0]() })
    await tick(5)
    expect(previews()).toHaveLength(2)   // not four: the changes in between were folded into one
    expect([...previews()[1][0].picks].sort()).toEqual(['exercises', 'records', 'sets', 'volume', 'weights'])
  })

  it('has a Share button, kept off until the preview is there', async () => {
    act(() => { shareWorkoutImageSheet(workout) })
    const host = renderTop()
    expect(byText(host, 'Share').disabled).toBe(true)
    await tick(40)
    expect(byText(host, 'Share').disabled).toBe(false)
  })

  it('reads the club\'s name from the page when the server gave none', async () => {
    useStore.setState(s => ({ S: { ...s.S, club: undefined } }))
    window.gym_boot = { app_title: 'Fallback Gym' }
    await open()
    expect(lastRender().club).toEqual({ name: 'Fallback Gym', logo: '', site: '', info: '' })
    delete window.gym_boot
  })
})

describe('the share sheet — what the member chooses', () => {
  it('draws again with what the member ticks, and keeps the choice on the device', async () => {
    const host = await open()
    act(() => sw(host, 'Sets').click())
    await tick(40)
    expect([...lastRender().picks]).toContain('sets')
    expect(stored().picks).toContain('sets')
    act(() => sw(host, 'Duration').click())
    await tick(40)
    expect([...lastRender().picks]).not.toContain('duration')
    expect(stored().picks).not.toContain('duration')
  })

  it('offers the loads only while the exercises are on', async () => {
    const host = await open()
    expect(sw(host, 'Loads')).toBeTruthy()
    act(() => sw(host, 'Exercises').click())
    await tick(40)
    expect(sw(host, 'Loads')).toBeNull()
  })

  it('offers only what this workout can fill: no records row for a workout with no new best', async () => {
    const plain = { ...workout, prs: [] }
    useStore.setState(s => ({ S: { ...s.S, workouts: [plain] } }))
    const host = await open(plain)
    expect(sw(host, 'Personal records')).toBeNull()
    expect(sw(host, 'Exercises')).toBeTruthy()
  })

  it('switches to the Numbers card: the photo\'s buttons go, the shape stays', async () => {
    const host = await open()
    act(() => byText(host, 'Numbers').click())
    await tick(40)
    expect(lastRender().template).toBe('numbers')
    expect(byText(host, 'Take a photo')).toBeUndefined()
    expect(host.textContent).not.toContain('Your photo stays on this phone')
    expect(host.textContent).toContain('Story')
    expect(stored().template).toBe('numbers')
  })

  it('switches to the story shape', async () => {
    const host = await open()
    act(() => byText(host, 'Story 9:16').click())
    await tick(40)
    expect(lastRender().format).toBe('story')
    expect(stored().format).toBe('story')
  })

  it('switches to the Muscles card: no shape, no list of numbers, the muscle map as the one choice', async () => {
    const host = await open()
    act(() => byText(host, 'Muscles').click())
    await tick(40)
    expect(h.muscles).toHaveBeenCalled()
    expect(h.muscles.mock.calls.at(-1)[0]).toMatchObject({ map: true, club })
    expect(host.textContent).not.toContain('Feed 4:5')
    expect(host.textContent).not.toContain('What appears')
    expect(sw(host, 'Muscle map')).toBeTruthy()
    act(() => sw(host, 'Muscle map').click())
    await tick(40)
    expect(h.muscles.mock.calls.at(-1)[0].map).toBe(false)
  })

  it('opens the next time on the picture, the shape and the numbers it was left on', async () => {
    let host = await open()
    act(() => byText(host, 'Numbers').click())
    act(() => byText(host, 'Story 9:16').click())
    act(() => sw(host, 'Personal records').click())
    await tick(40)
    act(() => { mounted.splice(0).forEach(([root, el]) => { root.unmount(); el.remove() }) })
    useUI.setState({ sheets: [] })
    host = await open()
    expect(pressed(host)).toEqual(expect.arrayContaining(['Numbers', 'Story 9:16']))
    expect(lastRender()).toMatchObject({ template: 'numbers', format: 'story' })
    expect([...lastRender().picks]).not.toContain('records')
  })
})

describe('the share sheet — the member\'s photo', () => {
  it('reads the photo through the app\'s own ingest and draws the numbers over it', async () => {
    const host = await open()
    await pickPhoto(host)
    expect(h.ingest).toHaveBeenCalledTimes(1)
    expect(h.decode).toHaveBeenCalledTimes(1)
    expect(lastRender().photo).toBe(decoded)
    await tick(40)
    expect(host.textContent).not.toContain('Add a photo to start')
    expect(host.textContent).toContain('Move the photo with a finger, zoom with two fingers or the slider.')
  })

  it('never stores the photo and never sends it anywhere', async () => {
    const fetchSpy = vi.fn()
    vi.stubGlobal('fetch', fetchSpy)
    const xhr = vi.spyOn(XMLHttpRequest.prototype, 'send')
    const host = await open()
    await pickPhoto(host)
    act(() => sw(host, 'Sets').click())   // a change of choice is what writes the preferences: they must hold the choices and nothing else
    await tick(700)
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(xhr).not.toHaveBeenCalled()
    expect(Object.keys(stored()).sort()).toEqual(['format', 'picks', 'template'])
    for (let i = 0; i < localStorage.length; i++) {
      const value = localStorage.getItem(localStorage.key(i))
      expect(value).not.toMatch(/IMG_0001|data:image|blob:|base64/)
    }
    expect(JSON.stringify(useStore.getState().S)).not.toContain('IMG_0001')
    vi.unstubAllGlobals()
  })

  it('lets go of the photo when the sheet closes', async () => {
    const host = await open()
    await pickPhoto(host)
    act(() => { mounted.splice(0).forEach(([root, el]) => { root.unmount(); el.remove() }) })
    expect(decoded.close).toHaveBeenCalled()
  })

  it('lets go of the first photo when another one replaces it', async () => {
    const host = await open()
    await pickPhoto(host)
    const first = decoded
    decoded = { source: { tag: 'second' }, width: 3000, height: 4000, close: vi.fn() }
    await pickPhoto(host)
    expect(first.close).toHaveBeenCalled()
    expect(lastRender().photo).toBe(decoded)
  })

  it('refuses a video: a photo is wanted, the member is told, and the picture stays as it was', async () => {
    h.ingest = vi.fn(async () => ({ media: { kind: 'video', hash: 'v1' }, blobs: [], warnings: [] }))
    const host = await open()
    await pickPhoto(host, new File(['x'], 'clip.mov', { type: 'video/quicktime' }))
    expect(h.decode).not.toHaveBeenCalled()
    expect(useUI.getState().toastMsg).toMatch(/file type/i)
    expect(host.textContent).toContain('Add a photo to start')
  })

  it('tells the member when the browser cannot read the file, and keeps going', async () => {
    h.ingest = vi.fn(async () => { throw Object.assign(new Error('boom'), { code: 'decode' }) })
    const host = await open()
    await pickPhoto(host)
    expect(useUI.getState().toastMsg).toMatch(/cannot read/i)
    expect(byText(host, 'Take a photo').disabled).toBe(false)
  })

  it('moves the photo under the finger: dragging right shows more of its left, and the picture is drawn again', async () => {
    const host = await open()
    await pickPhoto(host)
    await tick(40)
    const frame = host.querySelector('.share-card')
    frame.querySelector('img').getBoundingClientRect = () => ({ width: 270, height: 337, left: 0, top: 0, right: 270, bottom: 337, x: 0, y: 0 })
    const before = lastRender().focus
    const fire = (type, x, y) => act(() => { frame.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: 1 })) })
    fire('pointerdown', 100, 100); fire('pointermove', 160, 100); fire('pointerup', 160, 100)
    await tick(40)
    expect(lastRender().focus.x).toBeLessThan(before.x)
    expect(lastRender().focus.y).toBeCloseTo(before.y, 6)   // dragged sideways only
  })

  it('offers a zoom once there is a photo, and the picture is drawn again at the zoom chosen (the club asked to frame the photo)', async () => {
    const host = await open()
    expect(host.querySelector('.share-zoom')).toBeNull()
    await pickPhoto(host)
    await tick(40)
    const slider = host.querySelector('.share-zoom input[type="range"]')
    expect(slider).toBeTruthy()
    expect(slider.getAttribute('aria-label')).toBe('Zoom')
    expect([slider.min, slider.max]).toEqual(['1', '4'])
    expect(lastRender().focus.zoom ?? 1).toBe(1)
    const set = v => act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, String(v))
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    set(2.5)
    await tick(40)
    expect(lastRender().focus.zoom).toBeCloseTo(2.5, 6)
  })

  it('moves a zoomed photo on both axes, where a photo that only fills the frame moves on one', async () => {
    decoded = { source: { tag: 'portrait' }, width: 3000, height: 4000, close: vi.fn() }
    const host = await open()
    await pickPhoto(host)
    await tick(40)
    const frame = host.querySelector('.share-card')
    frame.querySelector('img').getBoundingClientRect = () => ({ width: 270, height: 337, left: 0, top: 0, right: 270, bottom: 337, x: 0, y: 0 })
    const fire = (type, x, y, id = 1) => act(() => { frame.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: id })) })
    const sideways = () => { const b = lastRender().focus.x; fire('pointerdown', 100, 100); fire('pointermove', 160, 100); fire('pointerup', 160, 100); return b }
    const before = sideways()
    await tick(40)
    expect(lastRender().focus.x).toBeCloseTo(before, 6)           // a portrait photo has no room sideways at 1×
    const slider = host.querySelector('.share-zoom input[type="range"]')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider, '2')
      slider.dispatchEvent(new Event('input', { bubbles: true }))
    })
    await tick(40)
    const zoomed = lastRender().focus.x
    sideways()
    await tick(40)
    expect(lastRender().focus.x).toBeLessThan(zoomed)             // …and some once it is zoomed
    expect(lastRender().focus.zoom).toBe(2)                       // dragging keeps the zoom
  })

  it('zooms with two fingers', async () => {
    const host = await open()
    await pickPhoto(host)
    await tick(40)
    const frame = host.querySelector('.share-card')
    frame.querySelector('img').getBoundingClientRect = () => ({ width: 270, height: 337, left: 0, top: 0, right: 270, bottom: 337, x: 0, y: 0 })
    const fire = (type, x, y, id) => act(() => { frame.dispatchEvent(new PointerEvent(type, { bubbles: true, clientX: x, clientY: y, pointerId: id })) })
    fire('pointerdown', 100, 100, 1); fire('pointerdown', 140, 100, 2)       // 40 px apart
    fire('pointermove', 80, 100, 1); fire('pointermove', 160, 100, 2)        // 80 px apart: twice as close
    await tick(40)
    expect(lastRender().focus.zoom).toBeCloseTo(2, 3)
    fire('pointerup', 80, 100, 1); fire('pointerup', 160, 100, 2)
    await tick(40)
    expect(lastRender().focus.zoom).toBeCloseTo(2, 3)                        // lifting the fingers keeps it
  })

  it('goes back to no zoom with a new photo', async () => {
    const host = await open()
    await pickPhoto(host)
    await tick(40)
    const slider = () => host.querySelector('.share-zoom input[type="range"]')
    act(() => {
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value').set.call(slider(), '3')
      slider().dispatchEvent(new Event('input', { bubbles: true }))
    })
    await tick(40)
    expect(lastRender().focus.zoom).toBeCloseTo(3, 6)
    await pickPhoto(host)
    await tick(40)
    expect(lastRender().focus.zoom ?? 1).toBe(1)
    expect(slider().value).toBe('1')
  })

  it('keeps the sheet from being pulled down while the photo can be moved (its pull-to-dismiss would take every downward drag)', async () => {
    const host = await open()
    const frame = () => host.querySelector('.share-card')
    // Nothing to move yet: pulling on the preview still dismisses the sheet, as on any other sheet.
    expect(frame().hasAttribute('data-nodrag')).toBe(false)
    await pickPhoto(host)
    await tick(40)
    expect(frame().classList.contains('movable')).toBe(true)
    expect(frame().hasAttribute('data-nodrag')).toBe(true)
    act(() => byText(host, 'Numbers').click())
    await tick(40)
    expect(frame().hasAttribute('data-nodrag')).toBe(false)
  })

  it('keeps the photo off the Numbers card', async () => {
    const host = await open()
    await pickPhoto(host)
    act(() => byText(host, 'Numbers').click())
    await tick(40)
    expect(lastRender()).toMatchObject({ template: 'numbers', photo: null })
    act(() => byText(host, 'Photo').click())
    await tick(40)
    expect(lastRender().photo).toBe(decoded)
  })
})

describe('the share sheet — handing the picture over', () => {
  it('hands the finished picture to the phone\'s share sheet and closes', async () => {
    const host = await open()
    await tick(600)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.send).toHaveBeenCalledTimes(1)
    const [blob, name, title] = h.send.mock.calls[0]
    expect(blob).toBeInstanceOf(Blob)
    expect(name).toBe('workout-2026-09-07.png')
    expect(title).toBe('Push')
    expect(useUI.getState().sheets).toHaveLength(0)
  })

  it('hands over the full-size picture, ready before the tap when the member waited', async () => {
    const host = await open()
    await tick(600)
    const before = h.render.mock.calls.length
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.render.mock.calls.length).toBe(before)
    expect(h.send.mock.calls[0][0].size).toBeGreaterThan(0)
  })

  it('makes the full-size picture on the spot when the member did not wait', async () => {
    const host = await open()
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.render.mock.calls.some(([o]) => o.scale === 1)).toBe(true)
    expect(h.send).toHaveBeenCalledTimes(1)
  })

  it('names a photo picture .jpg and the others .png', async () => {
    const host = await open()
    await pickPhoto(host)
    await tick(600)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.send.mock.calls[0][1]).toBe('workout-2026-09-07.jpg')
    expect(h.send.mock.calls[0][0].type).toBe('image/jpeg')
  })

  it('stays open when the member closes the phone\'s share sheet without choosing', async () => {
    h.send = vi.fn(async () => 'cancelled')
    const host = await open()
    await tick(600)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(useUI.getState().sheets).toHaveLength(1)
    expect(byText(host, 'Share').disabled).toBe(false)
  })

  it('says the image was saved when the browser could only download it', async () => {
    h.send = vi.fn(async () => 'downloaded')
    const host = await open()
    await tick(600)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(useUI.getState().toastMsg).toBe('Image saved')
  })

  it('tells the member when the picture could not be made', async () => {
    h.render = vi.fn(async () => null)
    const host = await open()
    expect(host.textContent).toContain('Could not create the image')
    expect(byText(host, 'Share').disabled).toBe(true)
  })

  it('makes the Muscles card as a PNG', async () => {
    const host = await open()
    act(() => byText(host, 'Muscles').click())
    await tick(40)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.send.mock.calls.at(-1)[1]).toBe('workout-2026-09-07.png')
  })
})

describe('the share sheet — the sticker', () => {
  const openSticker = async () => {
    const host = await open()
    act(() => byText(host, 'Sticker').click())
    await tick(40)
    return host
  }

  it('is a fourth picture, kept for the next time', async () => {
    const host = await openSticker()
    expect(pressed(host)).toContain('Sticker')
    expect(lastRender()).toMatchObject({ template: 'sticker', photo: null })
    expect(stored().template).toBe('sticker')
  })

  it('has no shape to choose and no photo to add, a hint about its transparent background, and the numbers to tick', async () => {
    const host = await openSticker()
    expect(host.textContent).not.toContain('Feed 4:5')
    expect(byText(host, 'Take a photo')).toBeUndefined()
    expect(host.textContent).toContain('Transparent background: paste it onto a photo or a story.')
    expect(sw(host, 'Duration')).toBeTruthy()
    expect(sw(host, 'Exercises')).toBeTruthy()
  })

  it('draws its preview as a PNG, on a chequerboard, so that the transparent surround shows', async () => {
    const host = await openSticker()
    const preview = h.render.mock.calls.filter(([o]) => o.template === 'sticker' && o.scale === 0.5).at(-1)[0]
    expect(preview.type).toBe('image/png')
    expect(host.querySelector('.share-card').classList.contains('checker')).toBe(true)
  })

  it('shares a PNG named .png, never a JPEG', async () => {
    const host = await openSticker()
    await tick(600)
    await act(async () => { byText(host, 'Share').click() })
    await settle()
    expect(h.send.mock.calls.at(-1)[1]).toBe('workout-2026-09-07.png')
    expect(h.send.mock.calls.at(-1)[0].type).toBe('image/png')
  })

  it('offers « Copy image » and puts the picture on the clipboard', async () => {
    const host = await openSticker()
    await tick(600)
    const before = h.render.mock.calls.length
    await act(async () => { byText(host, 'Copy image').click() })
    await settle()
    expect(h.copy).toHaveBeenCalledTimes(1)
    expect(h.copy.mock.calls[0][0]).toBeInstanceOf(Blob)
    expect(h.copy.mock.calls[0][0].type).toBe('image/png')
    expect(h.render.mock.calls.length).toBe(before)   // the picture made after the last change was used, none made on the tap
    expect(useUI.getState().toastMsg).toBe('Copied')
    expect(useUI.getState().sheets).toHaveLength(1)   // copying does not close the sheet: the member goes on to paste it
  })

  it('says so when the browser refuses to copy', async () => {
    h.copy = vi.fn(async () => 'failed')
    const host = await openSticker()
    await tick(600)
    await act(async () => { byText(host, 'Copy image').click() })
    await settle()
    expect(useUI.getState().toastMsg).toBe('Could not copy')
  })

  it('offers no « Copy image » where the browser cannot copy a picture, nor on the other pictures', async () => {
    h.canCopy = () => false
    const host = await openSticker()
    expect(byText(host, 'Copy image')).toBeUndefined()
    h.canCopy = () => true
    act(() => byText(host, 'Numbers').click())
    await tick(40)
    expect(byText(host, 'Copy image')).toBeUndefined()
  })
})

describe('Share is one entry, wherever it is reached from', () => {
  it('is a single « Share » button in a workout\'s detail, with no « Share this session » or « Share as image » beside it', async () => {
    act(() => { workoutDetailSheet(workout) })
    const host = renderTop()
    const texts = buttons(host).map(b => b.textContent.trim())
    expect(texts.filter(x => x === 'Share')).toHaveLength(1)
    expect(texts).not.toContain('Share this session')
    expect(texts).not.toContain('Share as image')
  })

  it('opens the share sheet from that button', async () => {
    act(() => { workoutDetailSheet(workout) })
    const detail = renderTop()
    act(() => byText(detail, 'Share').click())
    expect(useUI.getState().sheets).toHaveLength(2)
    const host = renderTop()
    expect(host.querySelector('h3').textContent).toBe('Share workout')
  })
})
