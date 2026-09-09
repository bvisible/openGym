// @vitest-environment happy-dom
//// Neoffice — rewritten. Upstream's `config` comes from GET /api/config on its
//// Node server (invite-only, guest mode, whether the Coach is on). Here the
//// instance's capabilities travel in the boot blob the page already carries
//// (window.gym_boot, written by www/gym.py): BOOT.coach is present only when
//// the club switched the AI coach on in Gym Settings. Same field, same readers
//// (coachAvailable), no request. What is pinned: the cache, the re-read, and
//// that a boot without `coach` yields a config without it.
import { afterEach, beforeEach, describe, expect, it } from 'vitest'

import { useStore } from './useStore.js'

beforeEach(() => { useStore.setState({ config: null }); delete window.gym_boot })
afterEach(() => { useStore.setState({ config: null }); delete window.gym_boot })

describe('instance config, from the boot blob', () => {
  it('loadConfig reads the boot once and then answers from the cache', async () => {
    window.gym_boot = { coach: { enabled: true, provider: 'nora' } }
    expect(await useStore.getState().loadConfig()).toEqual({ invite_only: true, allow_guest: false, coach: { enabled: true, provider: 'nora' } })
    window.gym_boot = {}
    expect(await useStore.getState().loadConfig()).toMatchObject({ coach: { enabled: true } })
  })

  it('refreshConfig re-reads the boot, so a Coach switched on after boot is seen on the next load', async () => {
    window.gym_boot = {}
    await useStore.getState().loadConfig()
    expect(useStore.getState().config.coach).toBeUndefined()

    window.gym_boot = { coach: { enabled: true, provider: 'nora' } }
    await useStore.getState().refreshConfig()
    expect(useStore.getState().config.coach.enabled).toBe(true)
  })

  it('a boot without the coach key yields a config without it — never a crash', async () => {
    delete window.gym_boot
    const c = await useStore.getState().refreshConfig()
    expect(c).toEqual({ invite_only: true, allow_guest: false })
    expect(useStore.getState().config.coach).toBeUndefined()
  })
})
