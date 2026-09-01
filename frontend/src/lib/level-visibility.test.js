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
  showsSetIntensifierChips, showsInSessionWarmup, showsRestPauseSetting,
} from './level-visibility.js'

const FULL = { level: 'full' }
const NORMAL = { level: 'normal' }
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


describe('the middle level — where most members sit', () => {
  it('gives back the readings you can use without a vocabulary lesson', () => {
    // A body map is a picture; an estimated 1RM says "estimated".
    expect(showsBodyMap(NORMAL)).toBe(true)
    expect(showsEstimated1RM(NORMAL)).toBe(true)
    expect(showsEquipmentProfiles(NORMAL)).toBe(true)
  })

  it('still hides what has to be taught before it means anything', () => {
    // RIR/RPE is a scale you must be told about; drop-sets, ramps and supersets
    // are techniques, not gestures.
    expect(showsEffortHistogram(NORMAL)).toBe(false)
    expect(showsEffortSetting(NORMAL)).toBe(false)
    expect(showsIntensifier(NORMAL, {})).toBe(false)
    expect(showsWarmupRamp(NORMAL, {})).toBe(false)
    expect(showsSupersetControl(NORMAL, false)).toBe(false)
  })

  it('keeps the "already in use" exception at every level', () => {
    expect(showsIntensifier(NORMAL, { intensifier: { type: 'dropset' } })).toBe(true)
    expect(showsSupersetControl(NORMAL, true)).toBe(true)
    expect(showsWarmupRamp(SIMPLE, { warmupSets: 2 })).toBe(true)
  })
})

//// Neoffice — the LIVE session screen, added after finding the leak on osiris.
////
//// The rules above cover the config sheet and Settings, and I had stopped
//// there. On screen at the Normal level, on a workout whose exercises carried
//// nothing, "+ Drop", "+ Burst" and "Add warm-up set" were under every set:
//// the jargon came straight back on the screen a member spends their session
//// on — the one that matters most. Nothing in the suite noticed, because
//// nothing tested the rules WHERE THEY ARE APPLIED.
describe('the live session screen follows the same rules', () => {
  it('hides the in-session intensifier chips below the full level', () => {
    expect(showsSetIntensifierChips(SIMPLE, false)).toBe(false)
    expect(showsSetIntensifierChips(NORMAL, false)).toBe(false)
    expect(showsSetIntensifierChips(FULL, false)).toBe(true)
  })

  it('hides the in-session warm-up button below the full level', () => {
    expect(showsInSessionWarmup(SIMPLE, false)).toBe(false)
    expect(showsInSessionWarmup(NORMAL, false)).toBe(false)
    expect(showsInSessionWarmup(FULL, false)).toBe(true)
  })

  it('keeps both visible on a row that already carries them', () => {
    // Same exception as everywhere else, and it matters more here than
    // anywhere: this is mid-set. A member must never be left with drops they
    // cannot match or warm-up rows they cannot extend.
    expect(showsSetIntensifierChips(SIMPLE, true)).toBe(true)
    expect(showsInSessionWarmup(NORMAL, true)).toBe(true)
  })
})

describe('the rest-pause setting', () => {
  it('is hidden below the full level', () => {
    // It carried the words "rest-pause" onto a beginner's Settings screen for
    // a technique nothing else at their level offers.
    expect(showsRestPauseSetting(SIMPLE)).toBe(false)
    expect(showsRestPauseSetting(NORMAL)).toBe(false)
    expect(showsRestPauseSetting(FULL)).toBe(true)
  })

  it('stays once the member has moved it off the default', () => {
    // Same exception as everywhere: they changed it, so they know what it is.
    expect(showsRestPauseSetting({ ...SIMPLE, restPauseSec: 30 })).toBe(true)
    expect(showsRestPauseSetting({ ...SIMPLE, restPauseSec: 15 })).toBe(false)
  })
})
