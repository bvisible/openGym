//// Neoffice — added file (no upstream equivalent).
//// What these tests protect: translating the names MUTATES the shared EXDB
//// objects. That is efficient and it is risky — a language round trip that
//// translated a translation would make the library unreadable without a single
//// error being raised.

import { describe, it, expect, beforeEach } from 'vitest'
import { EXDB, EXIDX, applyExerciseNames, applyClubMedia, matchesExercise, imgSrc, gifSrc } from './exercises.js'

const ID = EXDB[0].id
const EN = EXDB[0].n

describe('applyExerciseNames', () => {
  beforeEach(() => applyExerciseNames(null))

  it('translates what the pack covers and leaves English for the rest', () => {
    applyExerciseNames({ [ID]: 'Nom français' })   // a French name, on purpose
    expect(EXIDX[ID].n).toBe('Nom français')
    const other = EXDB.find(e => e.id !== ID)
    expect(other.n).toBe(other.en)
  })

  it('NEVER translates a translation — two passes stay stable', () => {
    applyExerciseNames({ [ID]: 'Premier' })
    applyExerciseNames({ [ID]: 'Second' })
    expect(EXIDX[ID].n).toBe('Second')
    expect(EXIDX[ID].en).toBe(EN)
  })

  it('falls back to English when a language has no pack', () => {
    applyExerciseNames({ [ID]: 'Français' })
    applyExerciseNames(null)
    expect(EXIDX[ID].n).toBe(EN)
  })

  it('keeps the English name reachable for the search', () => {
    applyExerciseNames({ [ID]: 'Développé couché à la barre' })
    expect(EXIDX[ID].en).toBe(EN)
  })
})

describe('matchesExercise', () => {
  beforeEach(() => applyExerciseNames({ [ID]: 'Développé couché à la barre' }))

  it('finds by the translated name', () => {
    expect(matchesExercise(EXIDX[ID], 'développé')).toBe(true)
  })

  it('finds by the English name TOO — a member coming from another app', () => {
    expect(matchesExercise(EXIDX[ID], EN.toLowerCase().slice(0, 6))).toBe(true)
  })

  it('does not match just anything', () => {
    expect(matchesExercise(EXIDX[ID], 'zzzznonexistent')).toBe(false)
  })

  it('an empty search lets everything through', () => {
    expect(matchesExercise(EXIDX[ID], '')).toBe(true)
  })
})

//// Neoffice — the club's media. Same risk as with the names: we mutate shared
//// objects, and a malformed URL would render a broken image with no error.
describe('applyClubMedia', () => {
  it('replaces the image and the animation of a library exercise', () => {
    applyClubMedia({ [ID]: { img: '/files/machine.jpg', gif: '/files/machine.gif' } })
    expect(EXIDX[ID].img).toBe('/files/machine.jpg')
    expect(imgSrc(EXIDX[ID])).toBe('/files/machine.jpg')
    expect(gifSrc(EXIDX[ID])).toBe('/files/machine.gif')
  })

  it('leaves everything else on the sheet alone', () => {
    const before = EXIDX[ID].n
    applyClubMedia({ [ID]: { img: '/files/x.jpg' } })
    expect(EXIDX[ID].n).toBe(before)
  })

  it('ignores an id the library does not know', () => {
    expect(() => applyClubMedia({ 'zzz-unknown': { img: '/files/x.jpg' } })).not.toThrow()
  })

  it('a bare file name stays a library one', () => {
    const lib = EXDB.find(e => e.img && !e.img.startsWith('/'))
    expect(imgSrc(lib)).toContain('/assets/opengym/media/img/')
  })

  it('null breaks nothing — an instance with no club media', () => {
    expect(() => applyClubMedia(null)).not.toThrow()
  })
})
