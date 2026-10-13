//// Neoffice — added file (no upstream equivalent).
////
//// The muscle card's picture (lib/workout-card.js lays it out), made for the share sheet. It used to live in sheets.jsx as
//// `workoutCardImage`; it moved here with the other pictures, and gained the club's foot (logo, name, address, line of information)
//// that every shared picture carries.
import { workoutCardModel, layoutWorkoutCard, drawWorkoutCard, viewAspect, CARD_FONT } from '../workout-card.js'
import { loadLogo, aspectOf } from './render.js'

/**
 * `map`: whether the card carries the silhouette; `body` the profile's body ('male' | 'female'); `club` = { name, logo, site, info }.
 * Painted in the theme and accent the app is showing right now, as before. Resolves a PNG Blob, or null.
 */
export async function renderMuscles({ w, nameOf, unit, club, map, body }) {
  // The logo first: the foot is laid out for its proportions (an icon in a square, a wordmark in its own shape).
  const logo = await loadLogo(club?.logo)
  const model = workoutCardModel(w, { unit, nameOf, brand: club?.name || '', club: club ? { ...club, logoAspect: logo ? aspectOf(logo.img) : undefined } : club })
  const root = getComputedStyle(document.documentElement)
  const css = (name, fallback) => root.getPropertyValue(name).trim() || fallback
  const colors = { bg: css('--bg', '#000'), surface: css('--surface', '#1c1c1e'), tile: css('--surface-2', '#2c2c2e'), label: css('--label', '#fff'), label2: css('--label-2', '#999'), acc: css('--acc', '#30d158') }
  // The body geometry is ~90 KB and lazy everywhere else too (components/BodyMap.jsx).
  const geometry = map && model.levels ? (await import('../body-paths.js')).default : null
  const shape = geometry && (geometry[body] || geometry.male)
  const make = withLogo => {
    const canvas = document.createElement('canvas')
    const ctx = canvas.getContext('2d')
    if (!ctx) return Promise.resolve(null)
    const measure = (text, weight, size) => { ctx.font = `${weight} ${size}px ${CARD_FONT}`; return ctx.measureText(text).width }
    const layout = layoutWorkoutCard(model, { measure, rtl: document.documentElement.dir === 'rtl', map: shape ? { aspect: viewAspect(shape.front) } : null })
    canvas.width = layout.width
    canvas.height = layout.height
    drawWorkoutCard(ctx, layout, colors, shape ? { body: shape, levels: model.levels } : null, CARD_FONT, { logo: withLogo })
    return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
  }
  try { return await make(logo) } catch (e) { return make(null) }
}
