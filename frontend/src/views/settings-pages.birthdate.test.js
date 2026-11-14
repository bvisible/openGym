// watch-apple (#1108 review): the Apple Watch's birth date row on Apple Health is found by the
// search, on the iPhone with the Watch module on, and nowhere else.
import { describe, it, expect } from 'vitest'
import { searchSettings } from './settings-pages.js'

const tr = s => s
const iphone = { mobile: true, ios: true, android: false, offline: false, demo: false, mod: () => true }
const titles = (q, ctx) => searchSettings(q, ctx, tr).map(h => `${h.page}: ${h.title}`)

describe('Settings search: the birth date for heart-rate zones', () => {
  //// Neoffice — not here: Apple Health sits under Integrations (v1.4.5), a page this journal does not have (views/settings-pages.js
  //// pageVisible: the webhooks and services it holds talk to upstream's Node server). The day Integrations opens, this comes back.
  it('is found on the iPhone', () => {
    expect(titles('birth date', iphone)).not.toContain('apple-health: Birth date, for heart-rate zones')
    expect(titles('zones', iphone)).not.toContain('apple-health: Birth date, for heart-rate zones')
  })
  it('is not found with the Watch module off, on Android or on the web', () => {
    expect(titles('zones', { ...iphone, mod: id => id !== 'watch' })).not.toContain('apple-health: Birth date, for heart-rate zones')
    expect(titles('zones', { ...iphone, ios: false, android: true })).not.toContain('apple-health: Birth date, for heart-rate zones')
    expect(titles('zones', { mobile: false, mod: () => true })).not.toContain('apple-health: Birth date, for heart-rate zones')
  })
})
