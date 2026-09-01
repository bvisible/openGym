// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// THE SERVICE WORKER MUST NOT CACHE A SIGNED-OUT SHELL.
////
//// Reported 2026-09-01: *"ce matin j'ai relancé l'application et j'étais à
//// nouveau déconnecté"*, from the installed PWA.
////
//// The session itself was never the problem, and that was measured before
//// touching anything: the cookie carries Max-Age=2592000 after remember_me,
//// and the session survived clear-cache, a session purge, three concurrent
//// logins and a bench restart. What signs a member out is the CACHE.
////
//// /gym is rendered by Frappe and carries the boot payload — the member's name
//// and the CSRF token, or `"user": null` for a guest. The worker cached it like
//// any other page. So a launch that happens to render signed-out (an expired
//// session, a bad moment) writes a signed-out shell into the cache, and the
//// next launch that starts before the network is up — a phone waking on Wi-Fi,
//// every single morning — is served that shell and shows the app signed out
//// while the cookie is perfectly valid.
////
//// This tests the decision function directly rather than the worker: `fetch`
//// events in a SW scope cannot be driven from vitest, and a mock of that scope
//// would be testing the mock. The rule is what matters and the rule is here.

import { describe, expect, it, beforeEach, vi } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const SW = readFileSync(
  join(dirname(fileURLToPath(import.meta.url)), '../public/sw.js'), 'utf8')

//// Pull cacheIfUsable out of the worker source and run it against a fake
//// `caches`. Reading the shipped file rather than a copy is the point: a test
//// against a re-typed rule proves the re-typing.
const load = () => {
  const body = SW.slice(SW.indexOf('async function cacheIfUsable'))
  const fn = body.slice(0, body.indexOf('\n}\n') + 3)
  // eslint-disable-next-line no-new-func
  //: CACHE is a module-level constant in the worker; the extracted function
  //: closes over it, so it has to be handed in too.
  const name = (SW.match(/const CACHE = '([^']+)'/) || [])[1]
  return new Function('caches', 'CACHE', `${fn}; return cacheIfUsable`)(globalThis.caches, name)
}

const html = body => new Response(body, { headers: { 'content-type': 'text/html' } })

let put

beforeEach(() => {
  put = vi.fn()
  globalThis.caches = { open: async () => ({ put }) }
})

describe('the app shell is cached only when somebody is signed in', () => {
  it('refuses a shell rendered for a guest', async () => {
    //// The exact shape Frappe prints for a guest. This is the whole bug.
    const guest = html('<html><script>frappe.boot = {"user": null};</script></html>')
    await load()('/gym', guest)
    expect(put, 'a signed-out shell was cached').not.toHaveBeenCalled()
  })

  it('refuses it whatever the spacing', async () => {
    // `"user":null` and `"user":  null` are the same page to a member.
    for (const body of ['{"user":null}', '{"user":   null}', '{"user":\n  null}']) {
      put.mockClear()
      await load()('/gym', html(body))
      expect(put, `not caught: ${JSON.stringify(body)}`).not.toHaveBeenCalled()
    }
  })

  it('caches a shell that carries a signed-in member', async () => {
    const signedIn = html('<html><script>frappe.boot = {"user": {"name": "marie@club.fr"}};</script></html>')
    await load()('/gym', signedIn)
    expect(put, 'a usable shell was NOT cached — offline would have nothing').toHaveBeenCalled()
  })

  it('still caches everything that is not a page', async () => {
    // Scripts, styles and images carry no session and must keep being cached,
    // or the fix would trade a sign-out bug for an app that cannot start
    // offline at all.
    const js = new Response('export const a = 1', {
      headers: { 'content-type': 'application/javascript' },
    })
    await load()('/assets/index-abc.js', js)
    expect(put).toHaveBeenCalled()
  })
})

describe('the shipped worker', () => {
  it('never caches API responses', () => {
    // A stale session or a stale workout is worse than no answer.
    expect(SW).toMatch(/url\.pathname\.startsWith\('\/api\/'\)\)\s*return/)
  })

  it('changed its cache name, so what is already on phones is dropped', () => {
    //// The activate handler deletes every cache whose name is not the current
    //// one. Without a new name the fix ships and the symptom stays: the
    //// signed-out shells already sitting on members' phones keep being served.
    expect(SW).toMatch(/const CACHE = 'opengym-rt-v2'/)
  })
})
