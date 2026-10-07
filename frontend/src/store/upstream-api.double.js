//// Neoffice — added file (no upstream equivalent). The lib/api.js double of upstream's store tests.
////
//// Upstream's store calls api() with its server's paths; ours calls named helpers (lib/api.js:
//// getState, getRev, putState, logout, currentUser…) that speak to Frappe's whitelisted methods.
//// Upstream's tests mock api() alone, so in our store the helpers came back undefined and every
//// sync failed into its own catch: a test then read "kept the local copy" for the wrong reason.
//// This double gives the helpers back, each one delegating to the test's api() with upstream's
//// path, verb and body, so an assertion written against '/api/data', 'PUT' and `baseRev` holds
//// unchanged. The body is what OUR client sends: the state and the revision it read, no write id
//// (the club's server keeps none), and `stamped: true` because the club's server never stamps a
//// device's own changes (neoffice_gym api/journal_stamps.py stamps only the desk's).
export function upstreamApi(api, { user = () => null } = {}) {
  return {
    api,
    setRemoteAuth: () => {},
    getState: () => api('/api/data'),
    getRev: () => api('/api/data/rev'),
    putState: (state, baseRev) => api('/api/data', {
      method: 'PUT',
      body: JSON.stringify(baseRev == null ? { state, stamped: true } : { state, stamped: true, baseRev }),
    }),
    logout: () => api('/api/logout', { method: 'POST', body: '{}' }),
    currentUser: user,
    sessionMark: () => null,
    pageSignedIn: () => true,
    reloadJournal: () => {},
  }
}
