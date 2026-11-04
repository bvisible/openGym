//// Neoffice — added file (no upstream equivalent).
import { describe, expect, it, vi } from 'vitest'

vi.mock('./i18n.js', () => ({
  t: (s, ...a) => a.reduce((out, v, i) => out.replaceAll('{' + i + '}', v), s),
  tn: (one, other, n, ...rest) => [n, ...rest].reduce((out, v, i) => out.replaceAll('{' + i + '}', v), n === 1 ? one : other),
  dateLocale: () => 'en-GB',
}))
vi.mock('./format.js', () => ({ fmtNum: n => String(Math.round(n * 10) / 10) }))

import { medalOf, medalName, tierState, amountOf, progressLine, nextLine, featuredBadges, fmtMoney, historyLines } from './badge-tiers.js'

const gold3 = (over = {}) => ({
  id: 'w', name: 'Total soulevé', metric: 'Weight Moved', levels: 3, thresholds: [20000, 40000, 60000],
  tier: 1, next: 40000, value: 31200, progress: 0.78, featured: true, earned: true, ...over,
})

describe('the medals', () => {
  it('a badge with three levels has bronze, silver, gold; one with a single level has no medal', () => {
    expect([1, 2, 3].map(n => medalOf(3, n))).toEqual(['bronze', 'silver', 'gold'])
    expect(medalOf(3, 0)).toBeNull()
    expect(medalOf(3, 4)).toBeNull()
    expect(medalOf(1, 1)).toBeNull()
    expect(medalName('silver')).toBe('Silver')
    expect(medalName(null)).toBe('')
  })
})

describe('tierState', () => {
  it('between two levels: the level held, the level to come, how far it is', () => {
    const st = tierState(gold3())
    expect(st).toMatchObject({ levels: 3, tier: 1, complete: false, next: 40000, medal: 'bronze', nextMedal: 'silver', pct: 78 })
    expect(st.remaining).toBe(8800)
  })

  it('every level reached: the ring is full and nothing is left', () => {
    const st = tierState(gold3({ tier: 3, next: null, progress: 1, value: 71000 }))
    expect(st).toMatchObject({ complete: true, progress: 1, pct: 100, medal: 'gold', nextMedal: null, next: null, remaining: 0 })
  })

  it('nothing reached yet: the first level is the one to come', () => {
    const st = tierState(gold3({ tier: 0, earned: false, next: 20000, value: 5000, progress: 0.25 }))
    expect(st).toMatchObject({ tier: 0, medal: null, nextMedal: 'bronze', pct: 25 })
  })

  it('a badge from a server that predates levels reads as one level, earned or not', () => {
    expect(tierState({ id: 'o', earned: true, progress: null })).toMatchObject({ levels: 1, tier: 1, complete: true, pct: 100, medal: null })
    expect(tierState({ id: 'o', earned: false, progress: 0.4 })).toMatchObject({ levels: 1, tier: 0, complete: false, pct: 40, nextMedal: null })
  })

  it('never leaves the 0 to 100 range, whatever the server said', () => {
    expect(tierState(gold3({ progress: 1.7 })).pct).toBe(100)
    expect(tierState(gold3({ progress: -1 })).pct).toBe(0)
    expect(tierState(gold3({ tier: 9 })).tier).toBe(3)
  })
})

describe('the words', () => {
  it('an amount takes the unit of what the badge measures', () => {
    expect(amountOf('Weight Moved', 8800)).toBe('8800 kg')
    expect(amountOf('Workout Count', 1)).toBe('1 workout')
    expect(amountOf('Workout Count', 0.2)).toBe('1 workout')      // what is left is rounded UP: a fifth of a session is still a session
    expect(amountOf('Week Streak', 6)).toBe('6 weeks')
    expect(amountOf('Class Attendance', 2)).toBe('2 classes')
    expect(amountOf('Active Minutes', 90)).toBe('90 min')
    expect(amountOf('Goals Reached', 1)).toBe('1 goal')
    expect(amountOf('Something New', 3)).toBe('3')
  })

  it('the progress line and the line under it', () => {
    const b = gold3()
    expect(progressLine(b)).toBe('31200 / 40000 kg')
    expect(nextLine(b)).toBe('Silver in 8800 kg')
    expect(nextLine(gold3({ tier: 3, next: null, progress: 1 }))).toBe('Gold reached')
    expect(progressLine(gold3({ tier: 3, next: null, progress: 1 }))).toBe('')
  })

  it('a one-level badge: nothing to say about a level while it is open (the progress line says it), then « Earned »', () => {
    const one = { id: 'o', metric: 'Workout Count', levels: 1, thresholds: [10], tier: 0, next: 10, value: 7, progress: 0.7, earned: false }
    expect(progressLine(one)).toBe('7 / 10 workouts')
    expect(nextLine(one)).toBe('')
    expect(nextLine({ ...one, tier: 1, next: null, progress: 1, earned: true })).toBe('Earned')
  })
})

describe('featuredBadges', () => {
  const mk = (id, over) => gold3({ id, name: id, ...over })
  it('only what the club featured, the closest to the next level first', () => {
    const list = [mk('a', { progress: 0.3 }), mk('b', { progress: 0.9 }), mk('c', { featured: false, progress: 0.99 }), mk('d', { progress: 0.6 })]
    expect(featuredBadges(list).map(b => b.id)).toEqual(['b', 'd', 'a'])
  })

  it('at most three, and the latest earned ones fill what is left', () => {
    const done = (id, on) => mk(id, { tier: 3, next: null, progress: 1, tierEarnedOn: on })
    const list = [mk('open', { progress: 0.5 }), done('old', '2026-08-01'), done('new', '2026-10-20'), done('mid', '2026-09-10')]
    expect(featuredBadges(list).map(b => b.id)).toEqual(['open', 'new', 'mid'])
    expect(featuredBadges(list, 2).map(b => b.id)).toEqual(['open', 'new'])
  })

  it('nothing when the club featured none, or when there is nothing at all', () => {
    expect(featuredBadges([mk('a', { featured: false })])).toEqual([])
    expect(featuredBadges(undefined)).toEqual([])
    expect(featuredBadges([])).toEqual([])
  })
})

describe("the club's loyalty measures", () => {
  it('each one has its unit, singular and plural', () => {
    expect(amountOf('Class Sign-Ups', 10)).toBe('10 classes')
    expect(amountOf('Club Visits', 1)).toBe('1 visit')
    expect(amountOf('Club Visits', 75)).toBe('75 visits')
    expect(amountOf('Off-Peak Visits', 30)).toBe('30 visits')
    expect(amountOf('Weeks With Visits', 25)).toBe('25 weeks')
    expect(amountOf('Paying Referrals', 1)).toBe('1 referral')
    expect(amountOf('Paying Referrals', 4)).toBe('4 referrals')
  })

  it('a regularity badge reads like the others: where it stands and what the next level takes', () => {
    const b = { id: 'r', name: 'Régularité', metric: 'Club Visits', levels: 3, thresholds: [30, 75, 150], tier: 1, next: 75, value: 41, progress: 41 / 75, earned: true }
    expect(progressLine(b)).toBe('41 / 75 visits')
    expect(nextLine(b)).toBe('Silver in 34 visits')
  })
})

describe('money', () => {
  it('whole francs lose their cents, others keep two', () => {
    expect(fmtMoney(5, 'CHF')).toMatch(/^CHF.?5$|^5.?CHF$/)
    expect(fmtMoney(7.5, 'CHF')).toMatch(/7[.,]50/)
    expect(fmtMoney(0, 'CHF')).toMatch(/0/)
  })

  it('a currency the runtime does not know falls back to the plain number and the code', () => {
    expect(fmtMoney(5, 'not a currency')).toBe('5 not a currency')
  })
})

describe('the years gone by', () => {
  it('a badge with three levels names its medal, a single-level one says earned, newest year first as the server sends them', () => {
    const lines = historyLines([
      { id: 'r', name: 'Régularité', year: 2025, tier: 3, levels: 3 },
      { id: 'c', name: 'Cours', year: 2025, tier: 1, levels: 1 },
      { id: 'r', name: 'Régularité', year: 2024, tier: 2, levels: 3 },
    ])
    expect(lines.map(l => l.text)).toEqual(['Régularité · Gold · 2025', 'Cours · Earned · 2025', 'Régularité · Silver · 2024'])
    expect(lines.map(l => l.key)).toEqual(['r:2025', 'c:2025', 'r:2024'])
    expect(historyLines(null)).toEqual([])
  })
})
