// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The visibility rules of the simple level, and above all THE ONE that is
//// easy to get wrong: hide the control, never the data.
////
//// Getting it wrong is not a cosmetic bug — it traps a member with a setting
//// they can no longer reach (a drop-set they cannot remove, a superset they
//// cannot unlink, an equipment filter they cannot switch off).

import { describe, expect, it } from 'vitest'
import {
  showsBodyMap, showsEffortHistogram, showsEquipmentProfiles, showsEstimated1RM,
  showsEffortSetting, showsIntensifier, showsSupersetControl, showsWarmupRamp,
} from './level-visibility.js'

const FULL = { level: 'full' }
const SIMPLE = { level: 'simple' }

describe('simple level — what is hidden', () => {
  it('hides the technical readings a beginner has not asked for', () => {
    expect(showsBodyMap(SIMPLE)).toBe(false)
    expect(showsEffortHistogram(SIMPLE)).toBe(false)
    expect(showsEstimated1RM(SIMPLE)).toBe(false)
  })

  it('hides the intensity techniques on a plain exercise', () => {
    expect(showsIntensifier(SIMPLE, {})).toBe(false)
    expect(showsWarmupRamp(SIMPLE, {})).toBe(false)
    expect(showsSupersetControl(SIMPLE, false)).toBe(false)
    expect(showsEquipmentProfiles(SIMPLE)).toBe(false)
    expect(showsEffortSetting(SIMPLE)).toBe(false)
  })

  it('shows everything at the full level', () => {
    for (const fn of [showsBodyMap, showsEffortHistogram, showsEstimated1RM, showsEquipmentProfiles]) {
      expect(fn(FULL)).toBe(true)
    }
    expect(showsIntensifier(FULL, {})).toBe(true)
    expect(showsWarmupRamp(FULL, {})).toBe(true)
    expect(showsSupersetControl(FULL, false)).toBe(true)
  })
})

describe('simple level — hide the control, never the data', () => {
  it('keeps the intensifier visible when the exercise already has one', () => {
    expect(showsIntensifier(SIMPLE, { intensifier: { type: 'dropset' } })).toBe(true)
    expect(showsIntensifier(SIMPLE, { intensifier: { type: 'restpause' } })).toBe(true)
    // …but an empty intensifier object is not "already has one".
    expect(showsIntensifier(SIMPLE, { intensifier: {} })).toBe(false)
  })

  it('keeps the warm-up stepper when the exercise already plans a ramp', () => {
    expect(showsWarmupRamp(SIMPLE, { warmupSets: 2 })).toBe(true)
    expect(showsWarmupRamp(SIMPLE, { warmupSets: 0 })).toBe(false)
  })

  it('keeps the superset button on a row that is already linked', () => {
    // Otherwise the member cannot UNLINK what the coach chained for them.
    expect(showsSupersetControl(SIMPLE, true)).toBe(true)
  })

  it('keeps the effort picker for a member who already logs RIR or RPE', () => {
    // Hiding the setting while the column is still asked for on every set is
    // the worst of both: the question stays, the way to stop it is gone.
    expect(showsEffortSetting({ ...SIMPLE, effort: 'rir' })).toBe(true)
    expect(showsEffortSetting({ ...SIMPLE, effort: 'rpe' })).toBe(true)
    expect(showsEffortSetting({ ...SIMPLE, effort: 'none' })).toBe(false)
  })

  it('keeps the equipment section for a member who already has a profile', () => {
    // Otherwise an active equipment filter becomes impossible to switch off.
    expect(showsEquipmentProfiles({ ...SIMPLE, equipProfiles: [{ id: 'home' }] })).toBe(true)
    expect(showsEquipmentProfiles({ ...SIMPLE, equipProfiles: [] })).toBe(false)
  })
})

describe('simple level — never simplifies by accident', () => {
  it('treats an unset or unknown level as the full journal', () => {
    for (const S of [{}, { level: null }, { level: '' }, { level: 'whatever' }, { perms: {} }]) {
      expect(showsBodyMap(S)).toBe(true)
      expect(showsIntensifier(S, {})).toBe(true)
    }
  })

  it('follows the club default when the member has not chosen', () => {
    const clubSimple = { level: null, perms: { defaultLevel: 'simple' } }
    expect(showsBodyMap(clubSimple)).toBe(false)
    // …and the member can still override it.
    expect(showsBodyMap({ ...clubSimple, level: 'full' })).toBe(true)
  })
})
