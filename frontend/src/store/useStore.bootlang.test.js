// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// The language a visitor is greeted in. The server sends `gym_boot.lang` for
//// the one moment a member does not exist yet — the sign-in screen — and the
//// store used to read only `gym_boot.user.language`, so that moment came out
//// in English at a French-speaking club. This pins the ladder: member first,
//// site second, English last.
import { describe, expect, it, beforeEach, vi } from 'vitest'

const load = async (boot) => {
  vi.resetModules()
  globalThis.window.gym_boot = boot
  const mod = await import('./useStore.js')
  return mod.DEF.lang
}

describe('the language the journal starts in', () => {
  beforeEach(() => { delete globalThis.window.gym_boot })

  it('is the member\'s, when there is one', async () => {
    expect(await load({ user: { language: 'de' }, lang: 'fr' })).toBe('de')
  })

  it('is the SITE\'s for a visitor — the sign-in screen', async () => {
    expect(await load({ user: null, lang: 'fr' })).toBe('fr')
  })

  it('falls back to English when neither is known', async () => {
    expect(await load({ user: null })).toBe('en')
  })

  it('never half-translates: an unknown locale falls back too', async () => {
    expect(await load({ user: null, lang: 'xx' })).toBe('en')
  })
})
