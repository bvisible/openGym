//// Neoffice — rewritten. Upstream talked to its own Node server (openGym's
//// api/server.js): a home-grown user directory in db.json, passkeys, and a
//// signed cookie of its own. On Neoffice the journal is served from the same
//// origin as Frappe, so the Frappe session cookie IS the authentication —
//// there is nothing to sign in to here, and /gym already bounced anonymous
//// visitors to /login before this code ever runs.
////
//// What that removes: passkeyRegister / passkeyLogin and the whole WebAuthn
//// dance (kept in git history, not in the bundle). What it adds: the CSRF
//// header Frappe requires on writes, and the {message: …} unwrapping every
//// Frappe endpoint applies to its return value.

// Boot data injected by neoffice_gym/www/gym.py — the page hands us who we are
// and the CSRF token, so the app never has to ask for either.
const BOOT = (typeof window !== 'undefined' && window.gym_boot) || {}

export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)

//// Neoffice — the endpoints. Everything the journal needs is behind
//// neoffice_gym.api.*, and every one of them resolves the member from the
//// session: no call carries a user id, on purpose.
const M = {
  stateGet: '/api/method/neoffice_gym.api.state.get',
  statePut: '/api/method/neoffice_gym.api.state.put',
  logout: '/api/method/logout',
}

/**
 * Call a Frappe endpoint.
 *
 * Frappe wraps every whitelisted return value in {message: …} and answers
 * errors with a JSON body carrying `exception` / `_server_messages`. Both are
 * unwrapped here so the rest of the app keeps seeing plain values and plain
 * Errors, exactly as it did against the old Node API.
 */
export async function api(path, opts = {}) {
  const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers)
  const method = (opts.method || 'GET').toUpperCase()
  //// Neoffice — Frappe rejects any write without this header. The token comes
  //// from the page boot; a session that outlived its token gets a 403 here,
  //// which the store already treats as "offline" and retries later.
  if (method !== 'GET' && BOOT.csrf_token) headers['X-Frappe-CSRF-Token'] = BOOT.csrf_token

  const r = await fetch(path, Object.assign({ credentials: 'same-origin' }, opts, { headers }))
  const data = await r.json().catch(() => ({}))
  if (!r.ok) {
    const e = new Error(serverMessage(data) || ('HTTP ' + r.status))
    e.status = r.status
    throw e
  }
  return 'message' in data ? data.message : data
}

/** Pull the human-readable half out of a Frappe error payload. */
function serverMessage(data) {
  if (!data) return ''
  if (data._server_messages) {
    try {
      const first = JSON.parse(data._server_messages)[0]
      const parsed = typeof first === 'string' ? JSON.parse(first) : first
      return (parsed && parsed.message) || ''
    } catch (e) { /* fall through to exc_type below */ }
  }
  return data.exc_type || data.exception || ''
}

//// Neoffice — the three calls the store makes. Named after what they do rather
//// than after a URL, so moving an endpoint never reaches into the store.
export const getState = () => api(M.stateGet)
export const putState = (state) => api(M.statePut, { method: 'POST', body: JSON.stringify({ state }) })
export const logout = () => api(M.logout, { method: 'POST', body: '{}' })

/** The signed-in member, straight from the page boot. */
export function currentUser() {
  const u = BOOT.user
  if (!u || !u.name || u.name === 'Guest') return null
  return { id: u.name, name: u.full_name || u.name, lang: u.language || null }
}
