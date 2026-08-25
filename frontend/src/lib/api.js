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
  //// Neoffice — programmes écrits par un coach. Le carnet demande ce qui
  //// l'attend, fusionne LUI-MÊME (mergePlan est amont et testé amont, et
  //// c'est le téléphone qui possède l'état hors ligne), puis répond.
  programInbox: '/api/method/neoffice_gym.api.program.inbox',
  programAccept: '/api/method/neoffice_gym.api.program.accept',
  programDecline: '/api/method/neoffice_gym.api.program.decline',
  //// Neoffice — les cours collectifs. Une façade sur Booking, pas un second
  //// module : capacité, liste d'attente et frais d'annulation restent les siens.
  classesWeek: '/api/method/neoffice_gym.api.classes.week',
  classesMine: '/api/method/neoffice_gym.api.classes.mine',
  classBook: '/api/method/neoffice_gym.api.classes.book',
  classCancel: '/api/method/neoffice_gym.api.classes.cancel',
  payStart: '/api/method/neoffice_gym.api.wallet.start',
  payWith: '/api/method/neoffice_gym.api.wallet.pay_with',
  payState: '/api/method/neoffice_gym.api.wallet.state',
  //// Neoffice — les évaluations physiques. Lecture seule côté membre : c'est
  //// le coach qui mesure, le carnet ne fait que montrer.
  assessmentsMine: '/api/method/neoffice_gym.api.assessment.mine',
  assessmentTrend: '/api/method/neoffice_gym.api.assessment.trend',
  //// Neoffice — les objectifs. Lecture seule : c'est le coach qui les pose,
  //// et un membre qui déplacerait sa propre cible n'aurait plus d'objectif.
  goalsMine: '/api/method/neoffice_gym.neoffice_gym.doctype.gym_goal.gym_goal.mine',
  //// Neoffice — les défis du club. Le classement se demande à part et
  //// n'arrive JAMAIS dans la liste : il montre à quelle fréquence les
  //// autres s'entraînent, ce qui est de la donnée de santé (LPD). On ne
  //// le charge que pour un défi qu'on a rejoint.
  challengesMine: '/api/method/neoffice_gym.api.challenges.mine',
  challengeJoin: '/api/method/neoffice_gym.api.challenges.join',
  challengeLeave: '/api/method/neoffice_gym.api.challenges.leave',
  challengeBoard: '/api/method/neoffice_gym.api.challenges.leaderboard',
  //// Neoffice — le panneau d'affichage du club. Rien n'est envoyé : le
  //// membre le lit quand il ouvre son carnet.
  announcements: '/api/method/neoffice_gym.api.challenges.announcements',
  //// Neoffice — les routines que le club a explicitement ouvertes. Sa
  //// bibliothèque reste fermée : il ouvre ce qu'il décide d'ouvrir.
  openRoutines: '/api/method/neoffice_gym.api.challenges.open_routines',
  //// Neoffice — joindre son coach. La messagerie est Raven ; ces deux
  //// endpoints ne font qu'aiguiller vers la bonne conversation.
  myCoach: '/api/method/neoffice_gym.api.contact.my_coach',
  openChat: '/api/method/neoffice_gym.api.contact.open_chat',
  //// Neoffice — le carnet de séances du membre. Rend une réponse vide
  //// tant que le club n'en vend pas : le carnet affiche « pas de
  //// carnet » sans avoir à traiter un cas particulier.
  wallet: '/api/method/neoffice_gym.api.wallet.balance',
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

//// Neoffice — les trois appels du coaching. `accept` part APRÈS la fusion :
//// si la fusion échoue sur le téléphone, l'offre doit encore être là au
//// prochain lancement. Accepter d'abord perdrait un programme sur un plantage.
export const programInbox = () => api(M.programInbox)
export const programAccept = (assignment) =>
  api(M.programAccept, { method: 'POST', body: JSON.stringify({ assignment }) })
export const programDecline = (assignment, reason) =>
  api(M.programDecline, { method: 'POST', body: JSON.stringify({ assignment, reason }) })

//// Neoffice — les cours. `book` gère lui-même le cas « complet » en inscrivant
//// sur la liste d'attente : le carnet n'a pas à connaître la règle, il affiche
//// ce que le serveur répond.
export const classesWeek = () => api(M.classesWeek)
export const classesMine = () => api(M.classesMine)
export const classBook = (session) =>
  api(M.classBook, { method: 'POST', body: JSON.stringify({ session }) })
export const classCancel = (booking, reason) =>
  api(M.classCancel, { method: 'POST', body: JSON.stringify({ booking, reason }) })

//// Neoffice — les évaluations. Aucun endpoint d'écriture : un membre ne se
//// mesure pas lui-même dans ce module, et lui en donner le moyen créerait deux
//// vérités sur la même composition corporelle.
export const assessmentsMine = () => api(M.assessmentsMine)
export const assessmentTrend = (test) =>
  api(M.assessmentTrend + '?test=' + encodeURIComponent(test))

//// Neoffice — ce que le membre vise, et où il en est.
export const goalsMine = () => api(M.goalsMine)

//// Neoffice — les défis. `join` EST le consentement du membre à être
//// classé : il n'existe pas d'endpoint qui inscrive quelqu'un d'autre.
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

//// Neoffice — payer un cours SANS quitter le carnet.
//// `payStart` tient le créneau et lève la facture d'un coup : le membre voit
//// le montant et les moyens sur le MÊME écran que le cours. `payWith` ouvre
//// le paiement, `payState` dit où il en est.
export const payStart = (session) =>
  api(M.payStart, { method: 'POST', body: { session } })
export const payWith = (invoice, method) =>
  api(M.payWith, { method: 'POST', body: { invoice, method } })
export const payState = ({ intent, invoice }) =>
  api(M.payState + '?' + new URLSearchParams(intent ? { intent } : { invoice }))
