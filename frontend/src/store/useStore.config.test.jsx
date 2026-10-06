// @vitest-environment happy-dom
//// Neoffice — rewritten. Upstream's `config` comes from GET /api/config on its
//// Node server (invite-only, guest mode, whether the Coach is on). Here the
//// instance's capabilities travel in the boot blob the page already carries
//// (window.gym_boot, written by www/gym.py): BOOT.coach is present only when
//// the club switched the AI coach on in Gym Settings. Same field, same readers
//// (coachAvailable), no request. What is pinned: the cache, the re-read, and
//// that a boot without `coach` yields `coach: null` (since the v1.3.9 merge).
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useStore } from './useStore.js'

beforeEach(() => { useStore.setState({ config: null }); delete window.gym_boot })
afterEach(() => { useStore.setState({ config: null }); delete window.gym_boot })

describe('instance config, from the boot blob', () => {
  it('loadConfig reads the boot once and then answers from the cache', async () => {
    window.gym_boot = { coach: { enabled: true, provider: 'nora' } }
    expect(await useStore.getState().loadConfig()).toEqual({ invite_only: true, allow_guest: false, coach: { enabled: true, provider: 'nora' }, default_lang: 'en' })
    window.gym_boot = {}
    expect(await useStore.getState().loadConfig()).toMatchObject({ coach: { enabled: true } })
  })

  it('refreshConfig re-reads the boot, so a Coach switched on after boot is seen on the next load', async () => {
    window.gym_boot = {}
    await useStore.getState().loadConfig()
    expect(useStore.getState().config.coach).toBeNull()

    window.gym_boot = { coach: { enabled: true, provider: 'nora' } }
    await useStore.getState().refreshConfig()
    expect(useStore.getState().config.coach.enabled).toBe(true)
  })

  //// Neoffice — `coach` is always a key now (null without the Coach): upstream's
  //// setUser re-asks for a config that lacks the key, and ours is a read of the
  //// page, so it must never look like one fetched without a session.
  it('a boot without the coach key yields coach: null — never a crash, never a re-ask', async () => {
    delete window.gym_boot
    const c = await useStore.getState().refreshConfig()
    expect(c).toEqual({ invite_only: true, allow_guest: false, coach: null, default_lang: 'en' })
    expect(useStore.getState().config.coach).toBeNull()
  })

  //// Neoffice — the language a copy that never chose one is shown in (upstream #303,
  //// lib/default-lang.js) is the member's, then the site's: the page boot carries both.
  it('the default language is the member’s, then the site’s', async () => {
    window.gym_boot = { lang: 'fr' }
    expect((await useStore.getState().refreshConfig()).default_lang).toBe('fr')
    window.gym_boot = { lang: 'fr', user: { language: 'de' } }
    expect((await useStore.getState().refreshConfig()).default_lang).toBe('de')
  })

  //// Neoffice — photos and videos stay on the member's phone (Jérémy, 06.10): no
  //// `media` block, so the journal never offers to add one (CustomMediaField).
  it('the config never offers media', async () => {
    window.gym_boot = { coach: { enabled: true } }
    expect(await useStore.getState().refreshConfig()).not.toHaveProperty('media')
  })
})
