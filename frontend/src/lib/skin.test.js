// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). The warm skin's switch (lib/skin.js).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'
import { SKIN, SKIN_BARS, SKIN_KEY, skinOff, startSkin } from './skin.js'

let root, doc, meta
beforeEach(() => {
  localStorage.removeItem(SKIN_KEY)
  doc = document
  root = document.documentElement
  delete root.dataset.skin
  delete root.dataset.theme
  meta = document.createElement('meta')
  meta.name = 'theme-color'
  meta.content = '#0c0e12'
  document.head.appendChild(meta)
})
afterEach(() => { meta.remove(); localStorage.removeItem(SKIN_KEY); delete root.dataset.skin; delete root.dataset.theme })

const tick = () => new Promise(r => setTimeout(r, 0))

describe('the warm skin switch', () => {
  it('puts the skin on the page root', () => {
    const stop = startSkin(root, doc)
    expect(root.dataset.skin).toBe(SKIN)
    stop()
  })

  it('takes it off again when told to stop', () => {
    startSkin(root, doc)()
    expect(root.dataset.skin).toBeUndefined()
  })

  it('does nothing on a device that turned it off', () => {
    localStorage.setItem(SKIN_KEY, 'off')
    expect(skinOff()).toBe(true)
    startSkin(root, doc)()
    expect(root.dataset.skin).toBeUndefined()
    expect(meta.content).toBe('#0c0e12')
  })

  it('paints the toolbar colour in the paper of the theme in use', async () => {
    root.dataset.theme = 'light'
    const stop = startSkin(root, doc)
    expect(meta.content).toBe(SKIN_BARS.light)
    // upstream's applyPrefs writes its own greys on every theme change: the skin overwrites them after it
    root.dataset.theme = 'dark'
    meta.content = '#000000'
    await tick()
    expect(meta.content).toBe(SKIN_BARS.dark)
    root.dataset.theme = 'light'
    meta.content = '#f2f2f7'
    await tick()
    expect(meta.content).toBe(SKIN_BARS.light)
    stop()
  })

  it('stops following the theme once stopped', async () => {
    const stop = startSkin(root, doc)
    stop()
    root.dataset.theme = 'light'
    meta.content = '#f2f2f7'
    await tick()
    expect(meta.content).toBe('#f2f2f7')
  })

  it('survives a page with no theme-color tag', () => {
    meta.remove()
    expect(() => startSkin(root, doc)()).not.toThrow()
  })
})
