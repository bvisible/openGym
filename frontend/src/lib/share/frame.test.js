//// Neoffice — added file (no upstream equivalent).
//// How a member's photo sits in the picture they share, and how dragging moves it (lib/share/frame.js).
import { describe, expect, it } from 'vitest'
import { coverRect, panFocus, DEFAULT_FOCUS } from './frame.js'

describe('coverRect — the photo fills the frame, never stretched, never with an empty edge', () => {
  it('crops the sides of a landscape photo for a portrait frame and keeps its full height', () => {
    const r = coverRect(4000, 3000, 1080, 1350, { x: 0.5, y: 0.5 })
    expect(r.k).toBeCloseTo(0.45, 6)
    expect(r.sh).toBeCloseTo(3000, 6)
    expect(r.sw).toBeCloseTo(2400, 6)
    expect(r.sx).toBeCloseTo(800, 6)
    expect(r.sy).toBeCloseTo(0, 6)
    expect(r.overflowX).toBeCloseTo(720, 6)
    expect(r.overflowY).toBeCloseTo(0, 6)
  })

  it('crops the top and the bottom of a photo taller than the frame', () => {
    const r = coverRect(1000, 3000, 1080, 1350, { x: 0.5, y: 0.5 })
    expect(r.sw).toBeCloseTo(1000, 6)
    expect(r.sh).toBeCloseTo(1250, 6)
    expect(r.sy).toBeCloseTo(875, 6)
    expect(r.overflowX).toBeCloseTo(0, 6)
  })

  it('has nothing to move when the photo is exactly the frame\'s shape', () => {
    const r = coverRect(2160, 2700, 1080, 1350)
    expect(r.overflowX).toBeCloseTo(0, 6)
    expect(r.overflowY).toBeCloseTo(0, 6)
    expect(r.sx).toBeCloseTo(0, 6)
    expect(r.sy).toBeCloseTo(0, 6)
  })

  it('keeps the crop window inside the photo at both ends of the focus', () => {
    for (const fx of [0, 0.25, 1]) {
      for (const fy of [0, 0.4, 1]) {
        const r = coverRect(4000, 3000, 1080, 1920, { x: fx, y: fy })
        expect(r.sx).toBeGreaterThanOrEqual(-1e-6)
        expect(r.sy).toBeGreaterThanOrEqual(-1e-6)
        expect(r.sx + r.sw).toBeLessThanOrEqual(4000 + 1e-6)
        expect(r.sy + r.sh).toBeLessThanOrEqual(3000 + 1e-6)
      }
    }
    expect(coverRect(4000, 3000, 1080, 1350, { x: 0, y: 0 }).sx).toBe(0)
    const end = coverRect(4000, 3000, 1080, 1350, { x: 1, y: 1 })
    expect(end.sx + end.sw).toBeCloseTo(4000, 6)
  })

  it('never stretches: the crop has the frame\'s shape', () => {
    const r = coverRect(3333, 2222, 1080, 1920)
    expect(r.sw / r.sh).toBeCloseTo(1080 / 1920, 6)
  })

  it('reads a missing or a broken focus as the middle', () => {
    const middle = coverRect(4000, 3000, 1080, 1350, { x: 0.5, y: 0.5 })
    expect(coverRect(4000, 3000, 1080, 1350, { x: NaN, y: Infinity })).toEqual({ ...middle, sy: middle.sy })
    expect(coverRect(4000, 3000, 1080, 1350, { x: -3, y: 9 }).sx).toBe(0)
    expect(coverRect(4000, 3000, 1080, 1350, null).sx).toBeCloseTo(middle.sx, 6)
  })

  it('starts a little above the middle, where a person stands in a photo', () => {
    expect(DEFAULT_FOCUS).toEqual({ x: 0.5, y: 0.4 })
    expect(Object.isFrozen(DEFAULT_FOCUS)).toBe(true)
  })
})

describe('panFocus — dragging the picture moves the photo under the numbers', () => {
  const geom = { overflowX: 720, overflowY: 0 }

  it('shows more of the left of the photo when it is dragged to the right, and the other way round', () => {
    expect(panFocus({ x: 0.5, y: 0.4 }, 72, 0, geom).x).toBeCloseTo(0.4, 6)
    expect(panFocus({ x: 0.5, y: 0.4 }, -72, 0, geom).x).toBeCloseTo(0.6, 6)
  })

  it('stops at the photo\'s edges', () => {
    expect(panFocus({ x: 0.1, y: 0.4 }, 9999, 0, geom).x).toBe(0)
    expect(panFocus({ x: 0.9, y: 0.4 }, -9999, 0, geom).x).toBe(1)
  })

  it('does not move an axis the photo exactly fits', () => {
    expect(panFocus({ x: 0.5, y: 0.4 }, 0, 500, geom).y).toBe(0.4)
    expect(panFocus({ x: 0.5, y: 0.4 }, 500, 500, { overflowX: 0, overflowY: 0 })).toEqual({ x: 0.5, y: 0.4 })
  })

  it('moves a drag of the full overflow from one end of the photo to the other', () => {
    expect(panFocus({ x: 1, y: 0.4 }, 720, 0, geom).x).toBe(0)
  })

  it('starts from the default focus when it has none', () => {
    expect(panFocus(null, 0, 0, geom)).toEqual({ x: 0.5, y: 0.4 })
    expect(panFocus(undefined, 0, 0, { overflowX: 0, overflowY: 100 }).y).toBeCloseTo(0.4, 6)
  })
})
