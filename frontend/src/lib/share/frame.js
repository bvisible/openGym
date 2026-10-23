//// Neoffice — added file (no upstream equivalent).
////
//// How a member's photo sits in the picture they share: cropped to fill the frame ("cover"), zoomed in if they want a tighter crop, and
//// moved under their finger to choose what the crop keeps. Pure arithmetic, no canvas. `focus` is where the crop window sits inside the
//// room the photo leaves it: { x: 0, y: 0 } the top-left corner, { x: 1, y: 1 } the bottom-right, { x: .5, y: .5 } the middle; its
//// optional `zoom` (1 to 4, 1 = the photo just fills the frame) enlarges the photo, which gives the window room on both axes.

// A little above the middle: a person in a photo stands in its upper part, and the numbers cover the lower one.
export const DEFAULT_FOCUS = Object.freeze({ x: 0.5, y: 0.4 })

const clamp01 = v => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0.5)

//// Neoffice — the zoom (the pilot club, 17.10, asked to be able to frame the photo: it could only be moved up and down): a photo
//// that only fills the frame leaves room on ONE axis, so a portrait photo could only be moved up and down. Zooming in leaves room on both.
export const ZOOM_MIN = 1
export const ZOOM_MAX = 4
/** A zoom within [ZOOM_MIN, ZOOM_MAX]; anything that is not a number is no zoom at all. */
export const clampZoom = z => (Number.isFinite(z) ? Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, z)) : ZOOM_MIN)

/**
 * The part of a `srcW` × `srcH` photo that fills a `dstW` × `dstH` frame with no empty edge and no stretching, and how much of the
 * photo overflows the frame on each axis once it is scaled (`overflowX`, `overflowY`, in frame px: the room `focus` moves in).
 */
export function coverRect(srcW, srcH, dstW, dstH, focus = DEFAULT_FOCUS) {
  const k = Math.max(dstW / srcW, dstH / srcH) * clampZoom(focus?.zoom)
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
    ...(f.zoom === undefined ? {} : { zoom: clampZoom(f.zoom) }),
  }
}

/**
 * `focus` with its zoom changed to `zoom`, the point of the photo that was in the middle of the frame staying in the middle (as far as
 * the photo allows): zooming looks like looking closer at the same spot, not like the picture sliding away.
 */
export function zoomFocus(srcW, srcH, dstW, dstH, focus, zoom) {
  const f = focus || DEFAULT_FOCUS
  const to = clampZoom(zoom)
  const before = coverRect(srcW, srcH, dstW, dstH, f)
  const cx = before.sx + before.sw / 2
  const cy = before.sy + before.sh / 2
  const after = coverRect(srcW, srcH, dstW, dstH, { ...f, zoom: to })
  const roomX = srcW - after.sw
  const roomY = srcH - after.sh
  return {
    x: roomX > 1e-6 ? clamp01((cx - after.sw / 2) / roomX) : 0.5,
    y: roomY > 1e-6 ? clamp01((cy - after.sh / 2) / roomY) : 0.5,
    zoom: to,
  }
}
