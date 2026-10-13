// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
//// Handing the finished picture over (lib/share/send.js): the phone's share sheet, a download when there is none, the clipboard for the sticker.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { sendImage, copyImage, canCopyImage } from './send.js'

const png = () => new Blob(['png'], { type: 'image/png' })
const setNavigator = (key, value) => Object.defineProperty(navigator, key, { value, configurable: true, writable: true })

beforeEach(() => {
  if (typeof URL.createObjectURL !== 'function') URL.createObjectURL = () => 'blob:test/1'
  if (typeof URL.revokeObjectURL !== 'function') URL.revokeObjectURL = () => {}
})
afterEach(() => {
  delete globalThis.ClipboardItem
  for (const key of ['share', 'canShare', 'clipboard']) { try { delete navigator[key] } catch { setNavigator(key, undefined) } }
  vi.restoreAllMocks()
})

describe('sendImage', () => {
  it('hands the file to the phone\'s share sheet when the browser can share files', async () => {
    const share = vi.fn(async () => {})
    setNavigator('canShare', () => true)
    setNavigator('share', share)
    expect(await sendImage(png(), 'workout-2026-09-07.png', 'Push')).toBe('shared')
    const [data] = share.mock.calls[0]
    expect(data.files[0]).toBeInstanceOf(File)
    expect(data.files[0].name).toBe('workout-2026-09-07.png')
    expect(data.files[0].type).toBe('image/png')
    expect(data.title).toBe('Push')
  })

  it('keeps the picture\'s own type for the file: a JPEG stays a JPEG', async () => {
    const share = vi.fn(async () => {})
    setNavigator('canShare', () => true)
    setNavigator('share', share)
    await sendImage(new Blob(['jpg'], { type: 'image/jpeg' }), 'workout.jpg', 'Push')
    expect(share.mock.calls[0][0].files[0].type).toBe('image/jpeg')
  })

  it('calls a closed share sheet « cancelled », not a failure', async () => {
    setNavigator('canShare', () => true)
    setNavigator('share', vi.fn(async () => { throw Object.assign(new Error('closed'), { name: 'AbortError' }) }))
    expect(await sendImage(png(), 'a.png', 'x')).toBe('cancelled')
  })

  it('saves the picture as a download when the browser cannot share a file, or refuses for another reason', async () => {
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    setNavigator('canShare', undefined)
    expect(await sendImage(png(), 'a.png', 'x')).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(1)
    setNavigator('canShare', () => true)
    setNavigator('share', vi.fn(async () => { throw new Error('NotAllowedError') }))
    expect(await sendImage(png(), 'a.png', 'x')).toBe('downloaded')
    expect(click).toHaveBeenCalledTimes(2)
  })
})

describe('copyImage', () => {
  const withClipboard = write => {
    globalThis.ClipboardItem = class { constructor(items) { this.items = items } }
    setNavigator('clipboard', { write })
  }

  it('says whether the browser can put a picture on the clipboard', () => {
    expect(canCopyImage()).toBe(false)
    withClipboard(vi.fn())
    expect(canCopyImage()).toBe(true)
    delete globalThis.ClipboardItem
    expect(canCopyImage()).toBe(false)
  })

  it('writes the picture under its own type, so that a sticker keeps its transparency', async () => {
    const write = vi.fn(async () => {})
    withClipboard(write)
    const blob = png()
    expect(await copyImage(blob)).toBe('copied')
    const [items] = write.mock.calls[0]
    expect(items).toHaveLength(1)
    expect(items[0].items).toEqual({ 'image/png': blob })
  })

  it('starts the write at once, before any wait: a browser lets the clipboard be written inside the tap only', () => {
    const write = vi.fn(() => new Promise(() => {}))
    withClipboard(write)
    copyImage(png())
    expect(write).toHaveBeenCalledTimes(1)
  })

  it('answers « unsupported » without trying when the browser cannot', async () => {
    expect(await copyImage(png())).toBe('unsupported')
  })

  it('answers « failed » when the browser refuses (no permission, no focus)', async () => {
    withClipboard(vi.fn(async () => { throw new Error('NotAllowedError') }))
    expect(await copyImage(png())).toBe('failed')
  })
})
