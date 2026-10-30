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
  showsEffortSetting, showsIntensifier, showsRoutineSupersetLink, showsSupersetControl, showsWarmupRamp,
  showsSetIntensifierChips, showsInSessionWarmup, showsRestPauseSetting, showsWarmupRestSetting,
  showsFailureControl, showsBackoffControl, showsTripleProgression, showsOneRmFormula,
  showsSetPlanControl, showsPerSideControl, showsPlateLoading, showsProgressionControls,
  showsWarmupRestRow, showsBackupsRow, showsBodyweightSwitch, showsMuscleInfo, showsExerciseChips, showsPlanTools,
  showsSeasonalThemes, showsReports, showsHomeExtras,
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

//// v1.4: the four techniques upstream added.
describe('v1.4 controls — hidden for a beginner, never from under what is in use', () => {
  it('hides failure, back-off sets, triple progression and the 1RM formula at the simple level', () => {
    expect(showsFailureControl(SIMPLE, false)).toBe(false)
    expect(showsBackoffControl(SIMPLE, {})).toBe(false)
    expect(showsTripleProgression(SIMPLE, {})).toBe(false)
    expect(showsOneRmFormula(SIMPLE)).toBe(false)
  })

  it('offers failure, back-off sets and triple progression only at the full level', () => {
    for (const S of [SIMPLE, NORMAL]) {
      expect(showsFailureControl(S, false)).toBe(false)
      expect(showsBackoffControl(S, {})).toBe(false)
      expect(showsTripleProgression(S, {})).toBe(false)
    }
    expect(showsFailureControl(FULL, false)).toBe(true)
    expect(showsBackoffControl(FULL, {})).toBe(true)
    expect(showsTripleProgression(FULL, {})).toBe(true)
  })

  it('offers the 1RM formula from the normal level, like the estimate it feeds', () => {
    expect(showsOneRmFormula(NORMAL)).toBe(true)
    expect(showsOneRmFormula(FULL)).toBe(true)
  })

  it('keeps each control where it is already in use', () => {
    expect(showsFailureControl(SIMPLE, true)).toBe(true)
    expect(showsBackoffControl(SIMPLE, { backoff: true })).toBe(true)
    expect(showsBackoffControl(SIMPLE, { backoff: false })).toBe(false)
    expect(showsTripleProgression(SIMPLE, { prog: 'triple' })).toBe(true)
    expect(showsTripleProgression(SIMPLE, { prog: 'double' })).toBe(false)
    expect(showsOneRmFormula({ level: 'simple', oneRmFormula: 'brzycki' })).toBe(true)
  })
})

//// Neoffice — the four things taken out of an exercise's settings at Simple (12.10): « different reps
//// per set », « per side », plate loading and the progression section. They come back from Normal up, and stay for whoever uses them.
describe('simple level — the exercise settings carry reps, sets, weight, rest and bodyweight only', () => {
  it('hides the four controls on a plain exercise, shows them from Normal up', () => {
    expect(showsSetPlanControl(SIMPLE, false)).toBe(false)
    expect(showsPerSideControl(SIMPLE, false)).toBe(false)
    expect(showsPlateLoading(SIMPLE, '0009')).toBe(false)
    expect(showsProgressionControls(SIMPLE, {})).toBe(false)
    for (const S of [NORMAL, FULL]) {
      expect(showsSetPlanControl(S, false)).toBe(true)
      expect(showsPerSideControl(S, false)).toBe(true)
      expect(showsPlateLoading(S, '0009')).toBe(true)
      expect(showsProgressionControls(S, {})).toBe(true)
    }
  })

  it('a member who has set nothing sees the club\'s default, and the club\'s default is the whole screen', () => {
    // nothing chosen, nothing sent: upstream's full journal, as for every other gate
    for (const S of [{}, { level: null }, { perms: {} }]) {
      expect(showsSetPlanControl(S, false)).toBe(true)
      expect(showsProgressionControls(S, {})).toBe(true)
    }
    // a club whose default level is simple, and a member who never chose their own
    const club = { level: null, perms: { defaultLevel: 'simple' } }
    expect(showsPerSideControl(club, false)).toBe(false)
    expect(showsPerSideControl({ ...club, level: 'normal' }, false)).toBe(true)
  })

  it('hide the control, never the data: what an exercise already uses stays reachable at Simple', () => {
    expect(showsSetPlanControl(SIMPLE, true)).toBe(true)
    expect(showsPerSideControl(SIMPLE, true)).toBe(true)
    // plate loading: a bar weight of its own, or its own way of loading, for THAT exercise only
    expect(showsPlateLoading({ ...SIMPLE, barWeights: { '0009': 25 } }, '0009')).toBe(true)
    expect(showsPlateLoading({ ...SIMPLE, barWeights: { '0009': 0 } }, '0009')).toBe(true)
    expect(showsPlateLoading({ ...SIMPLE, loadKind: { '0009': { k: 'single', _ts: 1 } } }, '0009')).toBe(true)
    expect(showsPlateLoading({ ...SIMPLE, barWeights: { '0009': 25 } }, '0025')).toBe(false)
    expect(showsPlateLoading({ ...SIMPLE, barWeights: {}, loadKind: {} }, '0009')).toBe(false)
    expect(showsPlateLoading(SIMPLE, undefined)).toBe(false)
    // progression: a rule, a step, a deload, back-off sets, or a deload routine
    for (const config of [{ prog: 'double' }, { prog: 'off' }, { inc: 2.5 }, { deloadFactor: 0.8 }, { backoff: true }, { excludeFromProgression: true }]) {
      expect(showsProgressionControls(SIMPLE, config)).toBe(true)
    }
    for (const config of [{}, { inc: 0 }, { inc: -1 }, { prog: '' }, { backoff: false }, { excludeFromProgression: false }, null, undefined]) {
      expect(showsProgressionControls(SIMPLE, config)).toBe(false)
    }
  })
})

describe('the link of the routine editor', () => {
  it('is offered at every level, while the live session keeps its own rule', () => {
    for (const S of [SIMPLE, NORMAL, FULL, {}]) expect(showsRoutineSupersetLink(S)).toBe(true)
    // The pair buttons of a session in progress are still a technique of the full level.
    expect(showsSupersetControl(SIMPLE, false)).toBe(false)
  })
})

describe('the rest between warm-ups (upstream v1.4.2)', () => {
  it('goes with the warm-up sets: from the full level up', () => {
    expect(showsWarmupRestSetting(FULL)).toBe(true)
    expect(showsWarmupRestSetting({})).toBe(true)             // an unset level is the full journal
    expect(showsWarmupRestSetting(SIMPLE)).toBe(false)
    expect(showsWarmupRestSetting(NORMAL)).toBe(false)
  })

  it('stays for a member who already moved it off « like the work sets », « no timer » included', () => {
    expect(showsWarmupRestSetting({ ...SIMPLE, warmupRestSec: 30 })).toBe(true)
    expect(showsWarmupRestSetting({ ...NORMAL, warmupRestSec: 0 })).toBe(true)
    expect(showsWarmupRestSetting({ ...SIMPLE, warmupRestSec: null })).toBe(false)
    expect(showsWarmupRestSetting({ ...SIMPLE, warmupRestSec: undefined })).toBe(false)
  })
})

//// 30.10 — « de gros bébé ». What Simple keeps is what a person does in front of a machine; the rest comes back at Normal (or Full).
describe('simple level, 30.10 — one screen, one job', () => {
  it('hides the readings and the tools a beginner never asked for', () => {
    for (const fn of [showsMuscleInfo, showsExerciseChips, showsPlanTools, showsReports, showsHomeExtras, showsBackupsRow, showsBodyweightSwitch]) {
      expect(fn(SIMPLE), fn.name).toBe(false)
      expect(fn(NORMAL), fn.name).toBe(true)
      expect(fn(FULL), fn.name).toBe(true)
    }
    expect(showsSeasonalThemes(SIMPLE, 'halloween')).toBe(false)
    expect(showsSeasonalThemes(NORMAL, 'halloween')).toBe(true)
  })

  it('the rest between warm-ups is a Full control, kept when the exercise already carries warm-ups', () => {
    expect(showsWarmupRestRow(SIMPLE, {})).toBe(false)
    expect(showsWarmupRestRow(NORMAL, {})).toBe(false)
    expect(showsWarmupRestRow(FULL, {})).toBe(true)
    expect(showsWarmupRestRow(SIMPLE, { warmupSets: 2 })).toBe(true)
    expect(showsWarmupRestRow(SIMPLE, { warmupRestSec: 30 })).toBe(true)
    expect(showsWarmupRestRow(SIMPLE, { warmupRestOff: true })).toBe(true)
  })

  it('hide the control, never the data: what an exercise already carries keeps its control', () => {
    expect(showsBackupsRow(SIMPLE, { subs: ['0001'] })).toBe(true)
    expect(showsBackupsRow(SIMPLE, { subs: [] })).toBe(false)
    expect(showsBodyweightSwitch(SIMPLE, true)).toBe(true)
    // a member who switched a season ON keeps it; Off or Auto is not a choice to keep
    expect(showsSeasonalThemes({ ...SIMPLE, seasonal: { halloween: 'on' } }, 'halloween')).toBe(true)
    expect(showsSeasonalThemes({ ...SIMPLE, seasonal: { halloween: 'auto' } }, 'halloween')).toBe(false)
  })
})

