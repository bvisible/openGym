//// Neoffice — added file (no upstream equivalent).
//// What the picture a member shares SAYS (lib/share/model.js): every exercise as a line of a training log, built from the history's own
//// set labels, and only the numbers the member ticked.
import { describe, expect, it } from 'vitest'
import { exerciseDetail, shareModel, shareChoices, PICKS, DEFAULT_PICKS } from './model.js'
import { setLabel } from '../history.js'
import { fmtDate } from '../format.js'

const names = { bench: 'barbell bench press', curl: 'dumbbell curl', squat: 'squat', row: 'cable row', run: 'treadmill' }
const nameOf = entry => names[entry.id] || entry.id
const base = { unit: 'kg', speedUnit: 'km/h' }
const reps = (id, sets, extra = {}) => ({ id, target: { mode: 'reps' }, sets, ...extra })

describe('exerciseDetail — one exercise as a line', () => {
  it('says « 4 × 8 · 80 kg » when every work set was the same', () => {
    const e = reps('bench', Array.from({ length: 4 }, () => ({ w: 80, r: 8, done: true })))
    expect(exerciseDetail(e, base)).toBe('4 × 8 · 80 kg')
  })

  it('leaves out the warm-ups and the sets that were never ticked', () => {
    const e = reps('bench', [
      { w: 40, r: 10, done: true, phase: 'warmup' },
      { w: 80, r: 8, done: true }, { w: 80, r: 8, done: true },
      { w: 80, r: 8, done: false },
    ])
    expect(exerciseDetail(e, base)).toBe('2 × 8 · 80 kg')
  })

  it('does not tell the effort of a set (RIR) nor how it ended: sets at different effort are still the same sets', () => {
    const e = reps('bench', [{ w: 80, r: 8, done: true, rir: 3 }, { w: 80, r: 8, done: true, rir: 1 }, { w: 80, r: 8, done: true }])
    expect(exerciseDetail(e, base)).toBe('3 × 8 · 80 kg')
    expect(exerciseDetail(e, base)).not.toMatch(/RIR|\(/)
  })

  it('keeps a decimal load as the journal writes it and the unit of the profile', () => {
    const e = reps('bench', [{ w: 82.5, r: 5, done: true }, { w: 82.5, r: 5, done: true }])
    expect(exerciseDetail(e, base)).toBe('2 × 5 · 82.5 kg')
    expect(exerciseDetail(e, { ...base, unit: 'lb' })).toBe('2 × 5 · 82.5 lb')
  })

  it('writes one set as one set', () => {
    expect(exerciseDetail(reps('curl', [{ w: 14, r: 12, done: true }]), base)).toBe('1 × 12 · 14 kg')
  })

  it('shows sets that differ side by side while there are at most four (a pyramid)', () => {
    const e = reps('bench', [{ w: 60, r: 10, done: true }, { w: 70, r: 8, done: true }, { w: 80, r: 6, done: true }])
    expect(exerciseDetail(e, base)).toBe('60×10 · 70×8 · 80×6')
  })

  it('counts them and tells the heaviest beyond four', () => {
    const e = reps('bench', [60, 65, 70, 75, 80].map(w => ({ w, r: 5, done: true })))
    expect(exerciseDetail(e, base)).toBe('5 sets · max 80 kg')
  })

  it('writes a bodyweight exercise by its reps, with no load to hide', () => {
    const e = { id: 'pushup', target: { mode: 'reps', bw: true }, sets: [{ r: 15, done: true }, { r: 15, done: true }, { r: 15, done: true }] }
    const got = exerciseDetail(e, base)
    expect(got).toMatch(/^3 × 15$/)
  })

  it('writes a timed exercise by its time', () => {
    const e = { id: 'plank', target: { mode: 'time' }, sets: [{ sec: 45, done: true }, { sec: 45, done: true }, { sec: 45, done: true }] }
    expect(exerciseDetail(e, base)).toBe('3 × 0:45')
  })

  it('reads a cardio exercise the way the history reads it, and keeps it whatever the member chose for the loads', () => {
    const e = { id: 'run', target: { mode: 'cardio' }, sets: [{ min: 30, speed: 10, done: true }] }
    expect(exerciseDetail(e, base)).toBe(setLabel('run', e.sets[0], e.target, 'km/h'))
    expect(exerciseDetail(e, { ...base, weights: false })).toBe(setLabel('run', e.sets[0], e.target, 'km/h'))
  })

  it('drops every load when the member does not want them, and keeps the sets and the reps', () => {
    const same = reps('bench', Array.from({ length: 4 }, () => ({ w: 80, r: 8, done: true })))
    expect(exerciseDetail(same, { ...base, weights: false })).toBe('4 × 8')
    const pyramid = reps('bench', [{ w: 60, r: 10, done: true }, { w: 70, r: 8, done: true }, { w: 80, r: 6, done: true }])
    const bare = exerciseDetail(pyramid, { ...base, weights: false })
    expect(bare).toBe('3 sets')
    expect(bare).not.toMatch(/\d{2}/)
  })

  it('never prints « 0 kg »', () => {
    const e = reps('bench', [{ w: 0, r: 8, done: true }, { w: 0, r: 8, done: true }])
    expect(exerciseDetail(e, base)).toBe('2 × 8')
  })

  it('is null for an exercise with no work set done, so that it takes no line', () => {
    expect(exerciseDetail(reps('bench', [{ w: 80, r: 8, done: false }]), base)).toBeNull()
    expect(exerciseDetail(reps('bench', [{ w: 40, r: 8, done: true, phase: 'warmup' }]), base)).toBeNull()
    expect(exerciseDetail(reps('bench', []), base)).toBeNull()
    expect(exerciseDetail({ id: 'bench' }, base)).toBeNull()
  })

  it('reads a set logged per side without losing either side', () => {
    const e = { id: 'curl', target: { mode: 'reps', side: true }, sets: [{ r: 8, done: true, sides: { L: { w: 12, r: 8, done: true }, R: { w: 12, r: 7, done: true } } }] }
    const got = exerciseDetail(e, base)
    expect(got).toContain('12×8')
    expect(got).toContain('12×7')
  })
})

describe('shareModel', () => {
  const w = {
    id: 'w1', d: '2026-09-03', start: 0, end: 58 * 60000, name: '  Push   day ', vol: 4310,
    prs: ['bench', 'curl', 'bench'],
    entries: [
      reps('bench', [{ w: 40, r: 8, done: true, phase: 'warmup' }, { w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }, { w: 80, r: 6, done: true }]),
      reps('curl', [{ w: 14, r: 10, done: true }, { w: 14, r: 10, done: true }]),
      reps('squat', [{ w: 100, r: 5, done: false }]),
    ],
  }
  const club = { name: ' Riverside  Gym ', logo: '/files/logo.png', site: 'riverside.example', info: 'Rue du Lac 4' }
  const picks = ['duration', 'sets', 'volume', 'exercises', 'weights', 'records']
  const make = (p, extra = {}) => shareModel({ ...w, ...extra }, { ...base, nameOf, picks: p, club })

  it('names the session, tidied, and dates its day', () => {
    const m = make(picks)
    expect(m.title).toBe('Push day')
    expect(m.date).toBe(fmtDate('2026-09-03', true, true))
  })

  it('has a figure for each number ticked and none for the others, in the sheet\'s order', () => {
    const m = make(picks)
    expect(m.figures.map(f => f.key)).toEqual(['duration', 'sets', 'volume'])
    expect(m.figures.map(f => f.value)).toEqual(['58 min', '5', '4,310 kg'])
    expect(make(['volume']).figures.map(f => f.key)).toEqual(['volume'])
    expect(make([]).figures).toEqual([])
  })

  it('counts the work sets only: no warm-up, no unticked set', () => {
    expect(make(['sets']).figures[0].value).toBe('5')
  })

  it('takes picks as a Set as well as an array', () => {
    expect(make(new Set(['duration'])).figures.map(f => f.key)).toEqual(['duration'])
  })

  it('has a line per exercise with a work set done, in order, and none for an exercise never done', () => {
    const m = make(picks)
    expect(m.lines.map(l => l.name)).toEqual(['Barbell Bench Press', 'Dumbbell Curl'])
    expect(m.lines[1].detail).toBe('2 × 10 · 14 kg')
  })

  it('flags the new bests on their lines, once each, and only when the member ticked the records', () => {
    expect(make(picks).lines.map(l => l.pr)).toEqual([true, true])
    expect(make(picks).recordCount).toBe(2)
    expect(make(['exercises', 'weights']).lines.map(l => l.pr)).toEqual([false, false])
  })

  it('shows the records by themselves when the member wants them without the exercise list', () => {
    const m = make(['records'])
    expect(m.lines).toEqual([
      { name: 'Barbell Bench Press', detail: '', pr: true },
      { name: 'Dumbbell Curl', detail: '', pr: true },
    ])
  })

  it('leaves out a duration it does not know and a volume of nothing', () => {
    const m = make(picks, { start: undefined, end: undefined, vol: 0, entries: [] })
    expect(m.figures.map(f => f.key)).toEqual([])
  })

  it('hides the loads on every line when they are not ticked', () => {
    const m = make(['exercises'])
    // The bench sets differ (8, 8, 6 reps): with no load to tell them apart they are counted; the curl sets are the same.
    expect(m.lines.map(l => l.detail)).toEqual(['3 sets', '2 × 10'])
    expect(m.lines.every(l => !/kg/.test(l.detail))).toBe(true)
  })

  it('carries the proportions of the club\'s logo when it knows them, and only then', () => {
    expect(make(picks).club.logoAspect).toBeUndefined()
    const known = shareModel(w, { ...base, nameOf, picks, club: { ...club, logoAspect: 4.7 } })
    expect(known.club.logoAspect).toBe(4.7)
    for (const bad of [0, -1, NaN, Infinity, 'wide', null]) {
      expect(shareModel(w, { ...base, nameOf, picks, club: { ...club, logoAspect: bad } }).club.logoAspect, String(bad)).toBeUndefined()
    }
  })

  it('tidies the club it is given and tolerates none', () => {
    expect(make(picks).club).toEqual({ name: 'Riverside Gym', logo: '/files/logo.png', site: 'riverside.example', info: 'Rue du Lac 4' })
    expect(shareModel(w, { ...base, nameOf, picks, club: null }).club).toEqual({ name: '', logo: '', site: '', info: '' })
  })

  it('carries the words the layout needs, with a plural for « + N more »', () => {
    const m = make(picks)
    expect(m.labels.done).toBe('Session done')
    expect(m.labels.more(1)).toBe('+ 1 more exercise')
    expect(m.labels.more(3)).toBe('+ 3 more exercises')
  })
})

describe('shareChoices — what the sheet offers for this workout', () => {
  const w = {
    id: 'w1', d: '2026-09-03', start: 0, end: 58 * 60000, name: 'Push', vol: 4310, prs: ['bench'],
    entries: [reps('bench', [{ w: 80, r: 8, done: true }, { w: 80, r: 8, done: true }])],
  }

  it('offers every choice this workout can fill, in the order of PICKS, with what each holds', () => {
    const c = shareChoices(w, { ...base, nameOf })
    expect(c.keys).toEqual(PICKS.filter(k => c.keys.includes(k)))
    expect(c.keys).toEqual(['duration', 'sets', 'volume', 'exercises', 'weights', 'records'])
    expect(c.values).toMatchObject({ duration: '58 min', sets: '2', volume: '4,310 kg', exercises: '1', records: '1' })
  })

  it('offers no choice that could only disappoint: no duration, no records, no volume, no loads', () => {
    const bare = { id: 'w2', d: '2026-09-03', name: 'Stretch', vol: 0, prs: [], entries: [] }
    const c = shareChoices(bare, { ...base, nameOf })
    expect(c.keys).toEqual([])
  })

  it('is ticked by default on the duration, the exercises with their loads and the records — not on the sets nor the total weight', () => {
    expect([...DEFAULT_PICKS]).toEqual(['duration', 'exercises', 'weights', 'records'])
    expect(PICKS.every(k => typeof k === 'string')).toBe(true)
  })
})
