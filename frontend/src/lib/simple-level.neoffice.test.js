//// Neoffice — added file (no upstream equivalent).
//// Two upstream modules that the Simple level reaches into (30.10): the seasonal layer (Halloween) and the workout screen's optional
//// controls. Simple takes them off by default; a member's own choice still wins.
import { describe, expect, it } from 'vitest'
import { themeOn, activeSeason } from './seasonal.js'
import { workoutControls } from './workout-controls.js'

const OCT_30 = new Date(2026, 9, 30)    // inside Halloween's weeks

describe('the seasonal layer at the Simple level', () => {
  it('is off in season for a beginner, on for everyone else', () => {
    expect(themeOn({ level: 'simple' }, 'halloween', OCT_30)).toBe(false)
    expect(activeSeason({ level: 'simple' }, OCT_30)).toBeNull()
    expect(themeOn({ level: 'normal' }, 'halloween', OCT_30)).toBe(true)
    expect(themeOn({}, 'halloween', OCT_30)).toBe(true)
  })
  it('a beginner who switched it ON keeps it, the club\'s default level counts', () => {
    expect(themeOn({ level: 'simple', seasonal: { halloween: 'on' } }, 'halloween', OCT_30)).toBe(true)
    expect(themeOn({ perms: { defaultLevel: 'simple' } }, 'halloween', OCT_30)).toBe(false)
  })
})

describe('the workout screen\'s controls at the Simple level', () => {
  it('no muscle figure in the header, the rest as upstream has it', () => {
    expect(workoutControls({ level: 'simple' }).muscleMap).toBe(false)
    expect(workoutControls({ level: 'simple' }).steppers).toBe(true)
    expect(workoutControls({ level: 'simple' }).exerciseChips).toBe(true)
    expect(workoutControls({ level: 'normal' }).muscleMap).toBe(true)
    expect(workoutControls({}).muscleMap).toBe(true)
  })
  it('the member\'s own choice wins', () => {
    expect(workoutControls({ level: 'simple', wc: { muscleMap: true } }).muscleMap).toBe(true)
  })
})
