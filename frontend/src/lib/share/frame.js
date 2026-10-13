//// Neoffice — added file (no upstream equivalent).
////
//// How a member's photo sits in the picture they share: cropped to fill the frame ("cover"), and moved under their finger to choose
//// what the crop keeps. Pure arithmetic, no canvas. `focus` is where the crop window sits inside the room the photo leaves it:
//// { x: 0, y: 0 } the top-left corner, { x: 1, y: 1 } the bottom-right, { x: .5, y: .5 } the middle.

// A little above the middle: a person in a photo stands in its upper part, and the numbers cover the lower one.
export const DEFAULT_FOCUS = Object.freeze({ x: 0.5, y: 0.4 })

const clamp01 = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)

/**
 * The part of a `srcW` × `srcH` photo that fills a `dstW` × `dstH` frame with no empty edge and no stretching, and how much of the
 * photo overflows the frame on each axis once it is scaled (`overflowX`, `overflowY`, in frame px: the room `focus` moves in).
 */
export function coverRect(srcW, srcH, dstW, dstH, focus = DEFAULT_FOCUS) {
  const k = Math.max(dstW / srcW, dstH / srcH)
  const sw = dstW / k
  const sh = dstH / k
  const fx = clamp01(focus?.x)
  const fy = clamp01(focus?.y)
  return { k, sx: (srcW - sw) * fx, sy: (srcH - sh) * fy, sw, sh, overflowX: srcW * k - dstW, overflowY: srcH * k - dstH }
}

/**
 * The focus after a drag of (`dx`, `dy`) frame px: dragging the photo to the right shows more of its left side. An axis with no
 * overflow (the photo exactly fits it) does not move.
 */
export function panFocus(focus, dx, dy, { overflowX, overflowY }) {
  const f = focus || DEFAULT_FOCUS
  return {
    x: overflowX > 0.5 ? clamp01(clamp01(f.x) - dx / overflowX) : clamp01(f.x),
    y: overflowY > 0.5 ? clamp01(clamp01(f.y) - dy / overflowY) : clamp01(f.y),
  }
}
