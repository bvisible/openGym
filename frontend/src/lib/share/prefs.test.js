//// Neoffice — added file (no upstream equivalent).
//// What a member chose the last time they shared, kept on the device (lib/share/prefs.js).
import { describe, expect, it } from 'vitest'
import { readPrefs, loadPrefs, savePrefs, DEFAULT_PREFS, TEMPLATES } from './prefs.js'
import { DEFAULT_PICKS } from './model.js'

const memory = (initial = {}) => {
  const data = { ...initial }
  return { data, getItem: k => (k in data ? data[k] : null), setItem: (k, v) => { data[k] = String(v) } }
}
const KEY = 'opengym.share.v1'

describe('readPrefs', () => {
  it('opens on the photo, the feed and the usual picks the first time, and nothing stored changes nothing', () => {
    const p = readPrefs(null)
    expect(p).toEqual({ template: 'photo', format: 'feed', picks: [...DEFAULT_PICKS] })
    expect(DEFAULT_PREFS.template).toBe('photo')
    expect(TEMPLATES).toEqual(['photo', 'numbers', 'muscles', 'sticker'])
  })

  it('does not hand out the shared default array: a change to one result must not change the next', () => {
    const a = readPrefs(null)
    a.picks.push('sets')
    expect(readPrefs(null).picks).toEqual([...DEFAULT_PICKS])
  })

  it('reads back valid choices as they were stored', () => {
    const raw = JSON.stringify({ template: 'numbers', format: 'story', picks: ['duration', 'sets', 'volume'] })
    expect(readPrefs(raw)).toEqual({ template: 'numbers', format: 'story', picks: ['duration', 'sets', 'volume'] })
  })

  it('knows the sticker', () => {
    expect(readPrefs({ template: 'sticker' }).template).toBe('sticker')
    expect(readPrefs(JSON.stringify({ template: 'sticker', format: 'story', picks: ['duration'] }))).toEqual({ template: 'sticker', format: 'story', picks: ['duration'] })
  })

  it('falls back to the default for a picture or a shape it does not know', () => {
    expect(readPrefs({ template: 'hologram', format: 'cinema', picks: ['duration'] })).toEqual({ template: 'photo', format: 'feed', picks: ['duration'] })
    expect(readPrefs({ format: 'constructor' }).format).toBe('feed')
  })

  it('drops the picks it does not know and puts the others in the sheet\'s order', () => {
    expect(readPrefs({ picks: ['records', 'selfie', 'duration'] }).picks).toEqual(['duration', 'records'])
  })

  it('keeps an empty list of picks: a member who switched everything off meant it', () => {
    expect(readPrefs({ picks: [] }).picks).toEqual([])
  })

  it('survives garbage', () => {
    for (const raw of ['{not json', '42', 'null', '"x"', '[]', undefined]) {
      expect(readPrefs(raw)).toMatchObject({ template: 'photo', format: 'feed' })
    }
  })
})

describe('loadPrefs / savePrefs', () => {
  it('keeps the choices on the device and finds them next time', () => {
    const storage = memory()
    savePrefs({ template: 'muscles', format: 'story', picks: ['exercises', 'weights'] }, storage)
    expect(Object.keys(storage.data)).toEqual([KEY])
    expect(loadPrefs(storage)).toEqual({ template: 'muscles', format: 'story', picks: ['exercises', 'weights'] })
  })

  it('stores nothing but the three choices', () => {
    const storage = memory()
    savePrefs({ template: 'photo', format: 'feed', picks: ['duration'], photo: 'data:image/jpeg;base64,AAAA', focus: { x: 1, y: 1 } }, storage)
    expect(JSON.parse(storage.data[KEY])).toEqual({ template: 'photo', format: 'feed', picks: ['duration'] })
    expect(storage.data[KEY]).not.toMatch(/data:|base64|focus/)
  })

  it('opens on the defaults when the storage refuses, and does not throw when it cannot save', () => {
    const refusing = { getItem() { throw new Error('denied') }, setItem() { throw new Error('quota') } }
    expect(loadPrefs(refusing)).toEqual({ template: 'photo', format: 'feed', picks: [...DEFAULT_PICKS] })
    expect(() => savePrefs({ template: 'photo', format: 'feed', picks: [] }, refusing)).not.toThrow()
    expect(loadPrefs(null)).toMatchObject({ template: 'photo' })
  })
})
