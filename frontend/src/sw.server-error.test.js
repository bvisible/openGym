// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent).
////
//// A SERVER THAT ANSWERS WITH AN ERROR IS NO BETTER THAN NO NETWORK.
////
//// Seen 2026-10-06 on an iPhone (simulator): the installed app, opened while
//// the server restarted, showed the proxy's 502 page in full screen, with no
//// address bar and no reload button, until the app was killed. The worker went
//// to the network first and fell back to its cache only when the network
//// failed outright; a 502 is an answer, so it was handed to the page.
////
//// Like sw.session.test.js, this runs the worker's own functions, pulled out of
//// BOTH copies (the one Frappe serves and the standalone build's), against a
//// fake `caches`: a re-typed rule would only prove the re-typing.

import { describe, expect, it } from 'vitest'
import { readFileSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const WORKERS = {
  //: What Frappe serves on Neoffice — the one that reaches phones.
  'opengym/www/gym_sw.js': readFileSync(join(HERE, '../../opengym/www/gym_sw.js'), 'utf8'),
  //: The standalone build's copy.
  'frontend/public/sw.js': readFileSync(join(HERE, '../public/sw.js'), 'utf8'),
}

const pick = (SW, head) => {
  const at = SW.indexOf(head)
  if (at < 0) throw new Error(`${head} is missing from this worker`)
  const body = SW.slice(at)
  return body.slice(0, body.indexOf('\n}\n') + 3)
}

//// The worker's fromCache and passOrFallBack, closed over a fake cache that
//// holds `cached(shell)`: { url: Response }.
const load = (SW, cached) => {
  const shell = (SW.match(/const SHELL = '([^']+)'/) || [])[1]
  const store = cached(shell)
  const caches = { match: async request => store[typeof request === 'string' ? request : request.url] }
  const src = pick(SW, 'async function fromCache') + pick(SW, 'async function passOrFallBack')
  // eslint-disable-next-line no-new-func
  return new Function('caches', 'SHELL', `${src}; return { fromCache, passOrFallBack }`)(caches, shell)
}

const page = url => ({ url, mode: 'navigate' })
const asset = url => ({ url, mode: 'cors' })
const answer = (status, body = '') => new Response(body, { status })

describe.each(Object.entries(WORKERS))('%s — a server error is answered like no network', (_file, SW) => {
  it('opens the cached app when the server answers the page with a 502', async () => {
    const { passOrFallBack } = load(SW, shell => ({ [shell]: answer(200, 'the app') }))
    const res = await passOrFallBack(page('https://club.example/gym'), answer(502, 'Sorry! We will be back soon.'))
    expect(res.status).toBe(200)
    expect(await res.text()).toBe('the app')
  })

  it('prefers the exact page when it is cached', async () => {
    const { passOrFallBack } = load(SW, shell => ({
      [shell]: answer(200, 'the app'),
      'https://club.example/gym/stats': answer(200, 'the stats page'),
    }))
    const res = await passOrFallBack(page('https://club.example/gym/stats'), answer(503))
    expect(await res.text()).toBe('the stats page')
  })

  it("keeps the server's answer when nothing is cached", async () => {
    const { passOrFallBack } = load(SW, () => ({}))
    const res = await passOrFallBack(page('https://club.example/gym'), answer(502, 'Sorry!'))
    expect(res.status).toBe(502)
  })

  it('lets a 4xx through: it is the real answer, not a server down', async () => {
    const { passOrFallBack } = load(SW, shell => ({ [shell]: answer(200, 'the app') }))
    const res = await passOrFallBack(page('https://club.example/gym/nowhere'), answer(404, 'Not found'))
    expect(res.status).toBe(404)
  })

  it('never answers a script or a picture with the app', async () => {
    const { passOrFallBack } = load(SW, shell => ({ [shell]: answer(200, 'the app') }))
    const res = await passOrFallBack(asset('https://club.example/assets/index-abc.js'), answer(500))
    expect(res.status).toBe(500)
  })

  it('hands a good answer over untouched', async () => {
    const { passOrFallBack } = load(SW, shell => ({ [shell]: answer(200, 'the app') }))
    const fresh = answer(200, 'fresh')
    expect(await passOrFallBack(page('https://club.example/gym'), fresh)).toBe(fresh)
  })

  it('routes every network answer through the rule, and a failed network through the cache', () => {
    //// Defining the rule is not the same as calling it.
    expect(SW).toMatch(/return passOrFallBack\(e\.request, res\)/)
    expect(SW).toMatch(/\.catch\(\(\) => fromCache\(e\.request\)\)\)/)
  })
})
