//// Neoffice — added file (no upstream equivalent).
//// How a member's photo sits in the picture they share, and how dragging moves it (lib/share/frame.js).
import { describe, expect, it } from 'vitest'
import { coverRect, panFocus, zoomFocus, clampZoom, ZOOM_MIN, ZOOM_MAX, DEFAULT_FOCUS } from './frame.js'

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

describe('zoom — a tighter crop, with room to move on both axes', () => {
  it('reads no zoom as 1, and keeps the zoom within its limits', () => {
    expect([ZOOM_MIN, ZOOM_MAX]).toEqual([1, 4])
    for (const bad of [undefined, null, NaN, Infinity, 'big', 0, -2, 0.3]) expect(clampZoom(bad), String(bad)).toBe(1)
    expect(clampZoom(2.5)).toBe(2.5)
    expect(clampZoom(40)).toBe(4)
  })

  it('shows half the width and half the height of the photo at 2×, and does not change the shape of the crop', () => {
    const one = coverRect(3000, 4000, 1080, 1350, { x: 0.5, y: 0.5 })
    const two = coverRect(3000, 4000, 1080, 1350, { x: 0.5, y: 0.5, zoom: 2 })
    expect(two.sw).toBeCloseTo(one.sw / 2, 6)
    expect(two.sh).toBeCloseTo(one.sh / 2, 6)
    expect(two.sw / two.sh).toBeCloseTo(1080 / 1350, 6)
    expect(two.k).toBeCloseTo(one.k * 2, 6)
  })

  it('gives a portrait photo room to move sideways once it is zoomed (it had none at 1×)', () => {
    const flat = coverRect(3000, 4000, 1080, 1350, { x: 0.5, y: 0.5 })
    expect(flat.overflowX).toBeCloseTo(0, 6)
    const zoomed = coverRect(3000, 4000, 1080, 1350, { x: 0.5, y: 0.5, zoom: 2 })
    expect(zoomed.overflowX).toBeCloseTo(1080, 6)
    expect(zoomed.overflowY).toBeGreaterThan(1000)
  })

  it('keeps the crop window inside the photo at every zoom and both ends of the focus', () => {
    for (const zoom of [1, 1.5, 2, 4]) for (const fx of [0, 0.5, 1]) for (const fy of [0, 0.4, 1]) {
      const r = coverRect(4000, 3000, 1080, 1920, { x: fx, y: fy, zoom })
      expect(r.sx).toBeGreaterThanOrEqual(-1e-6)
      expect(r.sy).toBeGreaterThanOrEqual(-1e-6)
      expect(r.sx + r.sw).toBeLessThanOrEqual(4000 + 1e-6)
      expect(r.sy + r.sh).toBeLessThanOrEqual(3000 + 1e-6)
    }
  })

  it('panFocus moves a zoomed photo on both axes and keeps its zoom', () => {
    const g = coverRect(3000, 4000, 1080, 1350, { x: 0.5, y: 0.4, zoom: 2 })
    const moved = panFocus({ x: 0.5, y: 0.4, zoom: 2 }, -216, -135, g)
    expect(moved.zoom).toBe(2)
    expect(moved.x).toBeCloseTo(0.5 + 216 / g.overflowX, 6)
    expect(moved.y).toBeCloseTo(0.4 + 135 / g.overflowY, 6)
  })

  it('panFocus adds no zoom to a focus that had none', () => {
    expect(Object.keys(panFocus({ x: 0.5, y: 0.4 }, 0, 0, { overflowX: 0, overflowY: 0 })).sort()).toEqual(['x', 'y'])
  })

  it('zoomFocus keeps the point that was in the middle of the frame in the middle', () => {
    const f = { x: 0.3, y: 0.6 }
    const before = coverRect(3000, 4000, 1080, 1350, f)
    const next = zoomFocus(3000, 4000, 1080, 1350, f, 2)
    const after = coverRect(3000, 4000, 1080, 1350, next)
    expect(next.zoom).toBe(2)
    expect(after.sx + after.sw / 2).toBeCloseTo(before.sx + before.sw / 2, 3)
    expect(after.sy + after.sh / 2).toBeCloseTo(before.sy + before.sh / 2, 3)
  })

  it('zoomFocus goes back to the middle of an axis that has no room left, and clamps the zoom it is given', () => {
    expect(zoomFocus(3000, 4000, 1080, 1350, { x: 0.9, y: 0.4, zoom: 3 }, 1).x).toBe(0.5)
    expect(zoomFocus(3000, 4000, 1080, 1350, { x: 0.5, y: 0.4 }, 99).zoom).toBe(4)
    expect(zoomFocus(3000, 4000, 1080, 1350, null, NaN).zoom).toBe(1)
  })

  it('zooming in and out again lands on the same crop (when the centre is not pushed against an edge)', () => {
    const start = { x: 0.5, y: 0.5, zoom: 1 }
    const there = zoomFocus(4000, 3000, 1080, 1350, start, 2)
    const back = zoomFocus(4000, 3000, 1080, 1350, there, 1)
    const a = coverRect(4000, 3000, 1080, 1350, start)
    const b = coverRect(4000, 3000, 1080, 1350, back)
    expect(b.sx).toBeCloseTo(a.sx, 3)
    expect(b.sy).toBeCloseTo(a.sy, 3)
  })
})
