//// Neoffice — added file (no upstream equivalent).
//// The picture a member shares of a finished workout is signed with the club's name, not upstream's product name:
//// a shared card travels outside the app, and what it advertises is the club.
import { describe, expect, it } from 'vitest'
import { workoutCardModel, layoutWorkoutCard } from './workout-card.js'

// A fake measure stands in for the canvas: every character is half its font size wide.
const measure = (text, weight, size) => String(text).length * size * 0.5
const workout = { id: 'w1', d: '2026-09-03', start: 0, end: 58 * 60000, name: 'Push', vol: 1790, prs: [], entries: [] }
const nameOf = entry => entry.id
const footer = layout => layout.items.filter(item => item.kind === 'text').at(-1).text

describe('the footer of a shared workout card', () => {
  it('carries the club name when the server gives one', () => {
    const model = workoutCardModel(workout, { unit: 'kg', nameOf, brand: 'Riverside Gym' })
    expect(model.brand).toBe('Riverside Gym')
    expect(footer(layoutWorkoutCard(model, { measure }))).toBe('Riverside Gym')
  })

  it('keeps upstream\'s name when there is none (a build with no club behind it)', () => {
    expect(footer(layoutWorkoutCard(workoutCardModel(workout, { unit: 'kg', nameOf }), { measure }))).toBe('openGym')
    expect(footer(layoutWorkoutCard(workoutCardModel(workout, { unit: 'kg', nameOf, brand: '   ' }), { measure }))).toBe('openGym')
  })

  it('keeps a long club name on one line, inside the card', () => {
    const brand = 'A fitness and physical preparation centre whose name is far too long to fit on a single line of the card'
    const layout = layoutWorkoutCard(workoutCardModel(workout, { unit: 'kg', nameOf, brand }), { measure })
    const text = layout.items.filter(item => item.kind === 'text').at(-1)
    expect(measure(text.text, text.weight, text.size)).toBeLessThanOrEqual(layout.width - 88 * 2)
    expect(text.text.length).toBeLessThan(brand.length)
  })
})
