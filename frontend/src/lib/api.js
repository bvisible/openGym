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
export const BOOT = (typeof window !== 'undefined' && window.gym_boot) || {}

export const IS_APPLE = /iPhone|iPad|iPod|Macintosh/.test(navigator.userAgent)
export const IS_ANDROID = /Android/.test(navigator.userAgent)

//// Neoffice — the endpoints. Everything the journal needs is behind
//// neoffice_gym.api.*, and every one of them resolves the member from the
//// session: no call carries a user id, on purpose.
const M = {
  stateGet: '/api/method/neoffice_gym.api.state.get',
  statePut: '/api/method/neoffice_gym.api.state.put',
  logout: '/api/method/logout',
  //// Neoffice — programs written by a coach. The journal asks what's
  //// waiting for it, merges it ITSELF (mergePlan is upstream and tested
  //// upstream, and it's the phone that owns the offline state), then replies.
  programInbox: '/api/method/neoffice_gym.api.program.inbox',
  programAccept: '/api/method/neoffice_gym.api.program.accept',
  programDecline: '/api/method/neoffice_gym.api.program.decline',
  //// Neoffice — group classes. A facade over Booking, not a second
  //// module: capacity, waitlist and cancellation fees remain Booking's own.
  classesWeek: '/api/method/neoffice_gym.api.classes.week',
  classesMine: '/api/method/neoffice_gym.api.classes.mine',
  classBook: '/api/method/neoffice_gym.api.classes.book',
  classCancel: '/api/method/neoffice_gym.api.classes.cancel',
  payStart: '/api/method/neoffice_gym.api.wallet.start',
  payWith: '/api/method/neoffice_gym.api.wallet.pay_with',
  payState: '/api/method/neoffice_gym.api.wallet.state',
  //// Neoffice — signing in. `login` is FRAPPE's own endpoint: lockout
  //// after failures, IP restriction, expired password and two-factor live
  //// there, and apply no matter who calls it. The other two are ours and
  //// never touch a password.
  login: '/api/method/login',
  rememberMe: '/api/method/neoffice_gym.api.session.remember_me',
  forgotPassword: '/api/method/neoffice_gym.api.session.forgot_password',
  //// Neoffice — physical assessments. Read-only on the member's side: it's
  //// the coach who measures, the journal only displays.
  assessmentsMine: '/api/method/neoffice_gym.api.assessment.mine',
  assessmentTrend: '/api/method/neoffice_gym.api.assessment.trend',
  //// Neoffice — goals. Read-only: it's the coach who sets them, and a
  //// member who could move their own target would no longer have a goal.
  goalsMine: '/api/method/neoffice_gym.neoffice_gym.doctype.gym_goal.gym_goal.mine',
  //// Neoffice — the club's challenges. The leaderboard is requested
  //// separately and NEVER comes with the list: it shows how often other
  //// people train, which counts as health data under Swiss data
  //// protection law (LPD). It's only loaded for a challenge you've joined.
  challengesMine: '/api/method/neoffice_gym.api.challenges.mine',
  challengeJoin: '/api/method/neoffice_gym.api.challenges.join',
  challengeLeave: '/api/method/neoffice_gym.api.challenges.leave',
  challengeBoard: '/api/method/neoffice_gym.api.challenges.leaderboard',
  //// Neoffice — the club's noticeboard. Nothing is pushed: the member
  //// reads it when they open their journal.
  announcements: '/api/method/neoffice_gym.api.challenges.announcements',
  //// Neoffice — the routines the club has explicitly opened up. Its
  //// library stays closed: it opens what it decides to open.
  openRoutines: '/api/method/neoffice_gym.api.challenges.open_routines',
  //// Neoffice — reaching your coach. The messaging is Raven; these two
  //// endpoints only route to the right conversation.
  myCoach: '/api/method/neoffice_gym.api.contact.my_coach',
  openChat: '/api/method/neoffice_gym.api.contact.open_chat',
  //// Neoffice — the member's session pack. Returns an empty response as
  //// long as the club doesn't sell any: the journal shows "no pack"
  //// without having to handle a special case.
  wallet: '/api/method/neoffice_gym.api.wallet.balance',
  //// Neoffice — the club's floor plan. `floorWhereIs` answers "where do I do
  //// this exercise": the club maps its machines once, and a member stops
  //// wandering the room looking for one. Both return an empty answer when the
  //// club has drawn nothing, so the journal simply shows no plan.
  floorPlan: '/api/method/neoffice_gym.api.floor.for_member',
  floorWhereIs: '/api/method/neoffice_gym.api.floor.where_is',
  //// Neoffice — badges, points and what they buy. Answers
  //// `{enabled: false}` for a club that has not turned them on, so the
  //// journal shows nothing rather than an empty trophy case.
  badges: '/api/method/neoffice_gym.api.badges.mine',
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

//// Neoffice — the three coaching calls. `accept` fires AFTER the merge:
//// if the merge fails on the phone, the offer must still be there on the
//// next launch. Accepting first would lose a program on a crash.
export const programInbox = () => api(M.programInbox)
export const programAccept = (assignment) =>
  api(M.programAccept, { method: 'POST', body: JSON.stringify({ assignment }) })
export const programDecline = (assignment, reason) =>
  api(M.programDecline, { method: 'POST', body: JSON.stringify({ assignment, reason }) })

//// Neoffice — classes. `book` handles the "full" case itself by signing
//// up to the waitlist: the journal doesn't need to know the rule, it just
//// displays what the server answers.
export const classesWeek = () => api(M.classesWeek)
export const classesMine = () => api(M.classesMine)
export const classBook = (session) =>
  api(M.classBook, { method: 'POST', body: JSON.stringify({ session }) })
export const classCancel = (booking, reason) =>
  api(M.classCancel, { method: 'POST', body: JSON.stringify({ booking, reason }) })

//// Neoffice — assessments. No write endpoint: a member doesn't measure
//// themselves in this module, and giving them the means to would create
//// two truths about the same body composition.
export const assessmentsMine = () => api(M.assessmentsMine)
export const assessmentTrend = (test) =>
  api(M.assessmentTrend + '?test=' + encodeURIComponent(test))

//// Neoffice — what the member is aiming for, and where they stand.
export const goalsMine = () => api(M.goalsMine)

//// Neoffice — challenges. `join` IS the member's consent to be ranked:
//// there is no endpoint that signs up someone else.
export const challengesMine = () => api(M.challengesMine)
export const challengeJoin = (challenge) =>
  api(M.challengeJoin, { method: 'POST', body: JSON.stringify({ challenge }) })
export const challengeLeave = (challenge) =>
  api(M.challengeLeave, { method: 'POST', body: JSON.stringify({ challenge }) })
export const challengeBoard = (challenge) =>
  api(M.challengeBoard + '?challenge=' + encodeURIComponent(challenge))
export const announcements = () => api(M.announcements)
export const openRoutines = () => api(M.openRoutines)
export const myCoach = () => api(M.myCoach)
export const openChat = () =>
  api(M.openChat, { method: 'POST', body: '{}' })
export const wallet = () => api(M.wallet)
export const floorPlan = () => api(M.floorPlan)
export const floorWhereIs = exercise => api(M.floorWhereIs + '?exercise=' + encodeURIComponent(exercise))
export const myBadges = () => api(M.badges)

//// Neoffice — signing in WITHOUT leaving the journal. `signIn` posts the
//// credentials to Frappe, as-is: none of them are checked here.
//// ⚠️ `usr`/`pwd` are the names `LoginManager` expects — not `email`.
export const signIn = (usr, pwd) =>
  api(M.login, { method: 'POST', body: JSON.stringify({ usr, pwd }) })
export const rememberMe = () => api(M.rememberMe, { method: 'POST', body: '{}' })
export const forgotPassword = (email) =>
  api(M.forgotPassword, { method: 'POST', body: JSON.stringify({ email }) })

//// Neoffice — paying for a class WITHOUT leaving the journal.
//// `payStart` holds the slot and raises the invoice in one go: the member
//// sees the amount and the methods on the SAME screen as the class.
//// `payWith` opens payment, `payState` says where it stands.
export const payStart = (session) =>
  api(M.payStart, { method: 'POST', body: JSON.stringify({ session }) })
//// `payWith` takes the BOOKING, not an invoice: none exists yet. It's
//// choosing the method that raises it — see `wallet.pay_with`.
export const payWith = (booking, method) =>
  api(M.payWith, { method: 'POST', body: JSON.stringify({ booking, method }) })
export const payState = ({ intent, invoice }) =>
  api(M.payState + '?' + new URLSearchParams(intent ? { intent } : { invoice }))

//// Neoffice — kept from upstream because other files import them, but INERT here.
//// Upstream's mobile shell can pair with a Node server by code; our journal is
//// served by the very instance it talks to (same origin, Frappe session), so
//// there is no second server to point at. Exporting no-ops rather than deleting
//// keeps `lib/remote.js` and `store/useStore.js` mergeable at the next upstream
//// merge — the same choice already made for push (`pushSupported()` is false).
export function setRemoteAuth() { /* no remote server here */ }
export async function pairRedeem() {
  throw new Error('Pairing is not available: this journal is served by your club instance.')
}

//// Neoffice — kept REAL: these only report what the browser supports, and
//// Settings hides the whole passkey section anyway (the session is Frappe's).
//// Upstream fixed a false negative on Chrome for iOS here; no reason to lose it.
export const BIO = IS_APPLE ? 'Face ID / Touch ID' : IS_ANDROID ? 'fingerprint or face unlock' : 'your fingerprint, face or PIN'
export const VAULT = IS_APPLE ? 'iCloud Keychain' : IS_ANDROID ? 'Google Password Manager' : 'your password manager'
// PublicKeyCredential is the WebAuthn-specific capability signal. Do not also gate the UI on
// navigator.credentials: some browsers expose WebAuthn while that generic Credential Management
// API check produces a false negative (notably Chrome on iOS). The real create/get calls still run
// only after the user chooses a passkey action and surface any genuine browser error there.
export const webauthnOK = () => typeof window.PublicKeyCredential !== 'undefined'
