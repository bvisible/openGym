//// Neoffice — added file (no upstream equivalent).
////
//// The image a member posts after a session.
////
//// Asked for by Olympia on 2026-08-31, and framed by them as COMMERCIAL, not
//// as a gadget: *"c'est le membre qui fait la promotion du club"*. Which is
//// why the club's name and logo are not decoration here — they are the point,
//// and they are the only things the member cannot switch off.
////
//// Jérémy chose the shape on 31.08: THE MEMBER PICKS what appears. Everything
//// else is opt-in, and the card is built from whatever survives that choice.

const W = 1080
const H = 1350   // 4:5 — the tallest a feed shows without cropping.

/** What can be put on the card, in the order it reads. */
export const SHAREABLE = ['duration', 'exercises', 'volume', 'sets', 'records']

const round = (ctx, x, y, w, h, r) => {
  ctx.beginPath()
  ctx.moveTo(x + r, y)
  ctx.arcTo(x + w, y, x + w, y + h, r)
  ctx.arcTo(x + w, y + h, x, y + h, r)
  ctx.arcTo(x, y + h, x, y, r)
  ctx.arcTo(x, y, x + w, y, r)
  ctx.closePath()
}

const loadImage = (src) => new Promise((resolve) => {
  if (!src) return resolve(null)
  const img = new Image()
  //// The logo is served from the club's own instance, same origin as the
  //// journal. crossOrigin stays unset on purpose: setting it would make the
  //// browser demand CORS headers the instance does not send, and the load
  //// would fail for a file that is right there.
  img.onload = () => resolve(img)
  img.onerror = () => resolve(null)   // a missing logo must not lose the card
  img.src = src
})

/**
 * Draw the card and return it as a Blob.
 *
 * `picked` is the set of fields the member ticked. Nothing is drawn for a field
 * that is absent OR empty: a card announcing "0 kg" reads as a failed session.
 */
export async function drawShareCard({ workout, club, picked, unit = 'kg', labels }) {
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const ctx = canvas.getContext('2d')

  // Ground: the journal's own dark, so the card looks like the app it came from.
  ctx.fillStyle = '#0c0e12'
  ctx.fillRect(0, 0, W, H)

  const accent = '#e9ff3d'
  let y = 120

  const logo = await loadImage(club && club.logo)
  if (logo) {
    //// Contain, never stretch: a club logo distorted to fill a square is
    //// worse than no logo — it is the club's identity, drawn wrong.
    const box = 150
    const scale = Math.min(box / logo.width, box / logo.height)
    const lw = logo.width * scale
    const lh = logo.height * scale
    ctx.drawImage(logo, (W - lw) / 2, y, lw, lh)
    y += box + 30
  }

  if (club && club.name) {
    ctx.fillStyle = '#ffffff'
    ctx.font = '600 46px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(club.name, W / 2, y)
    y += 70
  }

  ctx.fillStyle = accent
  ctx.font = '700 96px system-ui, -apple-system, sans-serif'
  ctx.fillText(labels.done, W / 2, y + 60)
  y += 150

  if (workout.name) {
    ctx.fillStyle = '#c9cdd6'
    ctx.font = '400 40px system-ui, -apple-system, sans-serif'
    ctx.fillText(workout.name, W / 2, y)
    y += 70
  }

  // The stats the member kept, two per row.
  const stats = []
  const add = (key, value, label) => {
    if (!picked.has(key) || value === null || value === undefined || value === 0 || value === '') return
    stats.push([String(value), label])
  }
  add('duration', workout.duration, labels.duration)
  add('exercises', workout.exercises, labels.exercises)
  add('volume', workout.volume ? `${workout.volume} ${unit}` : 0, labels.volume)
  add('sets', workout.sets, labels.sets)
  add('records', workout.records, labels.records)

  y += 30
  const cw = (W - 3 * 60) / 2
  stats.forEach(([value, label], i) => {
    const col = i % 2
    const row = Math.floor(i / 2)
    const x = 60 + col * (cw + 60)
    const ty = y + row * 200
    ctx.fillStyle = 'rgba(255,255,255,.06)'
    round(ctx, x, ty, cw, 170, 24)
    ctx.fill()
    ctx.fillStyle = '#ffffff'
    ctx.font = '700 64px system-ui, -apple-system, sans-serif'
    ctx.textAlign = 'center'
    ctx.fillText(value, x + cw / 2, ty + 90)
    ctx.fillStyle = '#8f96a3'
    ctx.font = '500 30px system-ui, -apple-system, sans-serif'
    ctx.fillText(label.toUpperCase(), x + cw / 2, ty + 132)
  })

  if (workout.date) {
    ctx.fillStyle = '#6b7280'
    ctx.font = '400 32px system-ui, -apple-system, sans-serif'
    ctx.fillText(workout.date, W / 2, H - 70)
  }

  return new Promise((resolve) => canvas.toBlob(resolve, 'image/png'))
}

/**
 * Hand the card to the member: the system share sheet if the browser has one,
 * a download otherwise.
 *
 * Returns 'shared' | 'downloaded' | 'cancelled'. The caller needs to tell them
 * apart: a cancelled share is not a failure and must not raise an error at
 * somebody who simply changed their mind.
 */
export async function shareCard(blob, filename, text) {
  const file = new File([blob], filename, { type: 'image/png' })
  if (navigator.canShare && navigator.canShare({ files: [file] })) {
    try {
      await navigator.share({ files: [file], text })
      return 'shared'
    } catch (e) {
      //// AbortError is the member closing the share sheet. Anything else and
      //// we fall through to the download, which always works.
      if (e && e.name === 'AbortError') return 'cancelled'
    }
  }
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  a.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
  return 'downloaded'
}
