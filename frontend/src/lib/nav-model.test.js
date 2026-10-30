//// Neoffice — added file (no upstream equivalent). What the bottom bar holds and which place a screen lights (lib/nav-model.js).
import { describe, expect, it } from 'vitest'
import { ACCOUNT_SCREENS, BAR_PLACES, barModel, classesPlaces, litPlace } from './nav-model.js'

describe('the places of the bar', () => {
  it('holds Home and Plan on the left, a library and Stats on the right, by default', () => {
    expect(barModel()).toEqual({ left: ['home', 'plan'], right: ['library', 'stats'] })
  })

  it('calls the second place Planning when the club has classes', () => {
    expect(barModel({ classes: true }).left).toEqual(['home', 'planning'])
  })

  it('puts Coach where the library was when there is a coach or Nora', () => {
    expect(barModel({ coach: true }).right).toEqual(['coach', 'stats'])
  })

  it('drops the library place, and only it, when the level has none (Simple)', () => {
    expect(barModel({ library: false })).toEqual({ left: ['home', 'plan'], right: ['stats'] })
    expect(barModel({ library: false, coach: true }).right).toEqual(['coach', 'stats'])
  })

  it('never puts the account in the bar', () => {
    for (const opts of [{}, { classes: true }, { coach: true }, { classes: true, coach: true, library: false }]) {
      const m = barModel(opts)
      expect([...m.left, ...m.right]).not.toContain('account')
    }
  })

  it('gives every place of the bar a route and a glyph', () => {
    for (const id of ['home', 'plan', 'planning', 'coach', 'library', 'stats']) {
      expect(BAR_PLACES[id].path).toMatch(/^\//)
      expect(BAR_PLACES[id].icon).toBeTruthy()
    }
    // Plan and Planning are one route: the same screen, named for what is in it.
    expect(BAR_PLACES.planning.path).toBe(BAR_PLACES.plan.path)
  })
})

describe('the club’s classes', () => {
  it('are in the bar unless the club has none, the build has no server, or the member took them out', () => {
    expect(classesPlaces({})).toEqual({ club: true, bar: true })
    expect(classesPlaces({ perms: { classes: false } })).toEqual({ club: false, bar: false })
    expect(classesPlaces({ mobile: true })).toEqual({ club: false, bar: false })
    expect(classesPlaces({ demo: true })).toEqual({ club: false, bar: false })
    expect(classesPlaces({ classesTab: false })).toEqual({ club: true, bar: false })
  })

  it('count as wanted while the state has not arrived (a missing setting is not a no)', () => {
    expect(classesPlaces({ perms: undefined, classesTab: undefined }).bar).toBe(true)
  })
})

describe('the place a screen lights', () => {
  it('lights its own place', () => {
    expect(litPlace('home')).toBe('home')
    expect(litPlace('plan')).toBe('plan')
    expect(litPlace('stats')).toBe('stats')
    expect(litPlace('coach-hub')).toBe('coach')
    expect(litPlace('library')).toBe('library')
  })

  it('lights Plan for the classes, which live inside it', () => {
    expect(litPlace('classes')).toBe('plan')
  })

  it('lights the place a screen was opened from, or its parent', () => {
    expect(litPlace('history')).toBe('stats')
    expect(litPlace('measurements')).toBe('stats')
    expect(litPlace('checkin')).toBe('home')
    expect(litPlace('muscles')).toBe('library')
    expect(litPlace('muscles', { coach: true })).toBe('plan')
    expect(litPlace('muscles', { fromStats: true })).toBe('stats')
  })

  it('lights nothing for the account screens and the ones a place does not own', () => {
    expect(litPlace('settings')).toBe(null)
    expect(litPlace('membership')).toBe(null)
    expect(litPlace('nowhere')).toBe(null)
  })

  it('shows the library under Plan once Coach has taken the library’s place', () => {
    expect(litPlace('library', { coach: true })).toBe('plan')
  })
})

describe('the screens that carry the account button', () => {
  it('are the places of the bar, by exact path', () => {
    expect([...ACCOUNT_SCREENS].sort()).toEqual(['/coach-hub', '/home', '/library', '/plan', '/stats'])
    // A routine being edited has its own back button and header: it carries none.
    expect(ACCOUNT_SCREENS.has('/plan/r/one')).toBe(false)
  })
})
