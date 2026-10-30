//// Neoffice — added file (no upstream equivalent).
////
//// The warm skin's switch (src/skin-neoffice.css). The stylesheet does nothing until the page root says `data-skin="neoffice"`; this puts it there, and keeps the
//// browser's toolbar colour (`meta[name=theme-color]`) in the skin's paper colours, which upstream's `applyPrefs` (App.jsx) paints in its own greys each time the theme
//// changes. We watch the `data-theme` attribute instead of editing `applyPrefs`: nothing of upstream's changes, and the merge has nothing to resolve.
////
//// OFF: `localStorage.gym_skin = 'off'` on a device (to compare, or to rule the skin out of a report), or delete the `startSkin()` call in main.jsx for everybody.
export const SKIN = 'neoffice'
export const SKIN_KEY = 'gym_skin'
/** The paper colour of each theme: the page background, so the toolbar and the page are one surface. */
export const SKIN_BARS = { light: '#FAF3EA', dark: '#15140F' }

export function skinOff() {
  try { return localStorage.getItem(SKIN_KEY) === 'off' } catch { return false }
}

/** Puts the skin on `root` and follows the theme. Returns a function that takes it off again (tests, hot reload). */
export function startSkin(root = document.documentElement, doc = document) {
  if (skinOff()) return () => {}
  root.dataset.skin = SKIN
  const bars = () => {
    const meta = doc.querySelector('meta[name="theme-color"]')
    if (meta) meta.content = root.dataset.theme === 'light' ? SKIN_BARS.light : SKIN_BARS.dark
  }
  bars()
  const watch = typeof MutationObserver === 'function' ? new MutationObserver(bars) : null
  watch?.observe(root, { attributes: true, attributeFilter: ['data-theme'] })
  return () => { watch?.disconnect(); delete root.dataset.skin }
}
