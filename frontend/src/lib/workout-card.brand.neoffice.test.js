//// Neoffice — added file (no upstream equivalent).
//// The picture a member shares of a finished workout is signed with the club's name, not upstream's product name:
//// a shared card travels outside the app, and what it advertises is the club.
import { describe, expect, it } from 'vitest'
import { workoutCardModel, layoutWorkoutCard } from './workout-card.js'
import { drawBrand } from './card-draw.js'

// A fake measure stands in for the canvas: every character is half its font size wide.
const measure = (text, weight, size) => String(text).length * size * 0.5
const workout = { id: 'w1', d: '2026-09-03', start: 0, end: 58 * 60000, name: 'Push', vol: 1790, prs: [], entries: [] }
const nameOf = entry => entry.id
// Upstream (v1.4.4) lays the footer out as one 'brand' item and draws it (card-draw.js drawBrand); the club's name rides on that item.
const brandItem = layout => layout.items.find(item => item.kind === 'brand')
// A fake canvas context that records what is written and measures 20 px a character.
const fakeCtx = () => {
  const drawn = []
  return {
    drawn, font: '', fillStyle: '', textAlign: '', direction: '',
    measureText: text => ({ width: String(text).length * 20 }),
    fillText(text, x, y) { drawn.push({ text, x, y, align: this.textAlign }) },
    fillRect() {}, save() {}, restore() {}, translate() {}, scale() {}, beginPath() {}, moveTo() {}, arcTo() {}, closePath() {}, fill() {},
  }
}
const colors = { acc: '#c2723f', label: '#111', label2: '#666' }

describe('the footer of a shared workout card', () => {
  it('carries the club name when the server gives one', () => {
    const model = workoutCardModel(workout, { unit: 'kg', nameOf, brand: 'Riverside Gym' })
    expect(model.brand).toBe('Riverside Gym')
    expect(brandItem(layoutWorkoutCard(model, { measure })).name).toBe('Riverside Gym')
  })

  it('keeps upstream\'s footer when there is none (a build with no club behind it)', () => {
    expect(brandItem(layoutWorkoutCard(workoutCardModel(workout, { unit: 'kg', nameOf }), { measure })).name).toBe('')
    expect(brandItem(layoutWorkoutCard(workoutCardModel(workout, { unit: 'kg', nameOf, brand: '   ' }), { measure })).name).toBe('')
    const ctx = fakeCtx()
    drawBrand(ctx, { x: 88, y: 900, width: 904, colors, family: 'sans-serif', size: 40, name: '' })
    expect(ctx.drawn.map(d => d.text).slice(0, 2)).toEqual(['open', 'Gym'])  // the product's own mark, then its site at the other end
    expect(ctx.drawn).toHaveLength(3)
  })

  it('draws the club name instead of the mark and the product name', () => {
    const ctx = fakeCtx()
    drawBrand(ctx, { x: 88, y: 900, width: 904, colors, family: 'sans-serif', size: 40, name: 'Riverside Gym' })
    expect(ctx.drawn).toEqual([{ text: 'Riverside Gym', x: 88, y: 900, align: 'left' }])
  })

  it('keeps a long club name on one line, inside the card', () => {
    const name = 'A fitness and physical preparation centre whose name is far too long to fit on a single line of the card'
    const ctx = fakeCtx()
    drawBrand(ctx, { x: 88, y: 900, width: 904, colors, family: 'sans-serif', size: 40, name })
    expect(ctx.drawn).toHaveLength(1)
    const text = ctx.drawn[0].text
    expect(text.endsWith('…')).toBe(true)
    expect(text.length).toBeLessThan(name.length)
    expect(ctx.measureText(text.slice(0, -1)).width).toBeLessThanOrEqual(904)
  })
})
