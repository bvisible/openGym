//// Neoffice — added file (no upstream equivalent).
//// The Coach through the club's Nora.
////
//// Upstream runs the Coach either on its Node server or on the phone with the
//// member's own API key (lib/coach-local.js). Neither exists here: the journal is
//// served by a Frappe instance, and the club — not the member — pays for the
//// model. So the pipeline runs where the BYOK one runs, in the browser (payload,
//// prompt, parsing, validation, the repair round: all upstream's), and the one
//// HTTP call goes to a whitelisted endpoint of the instance that forwards it to
//// Nora's model, counts the call and never exposes a key.
////
//// Same request shape as OpenAI's Chat Completions (what Nora's gateway serves);
//// the only differences are the path, the CSRF header a Frappe write needs, and
//// the `{"message": …}` envelope Frappe puts around every whitelisted answer.
import { httpAdapter } from '../../../api/coach/core/adapters/http.js'
import { chatCompletionsSpec } from '../../../api/coach/core/adapters/openai.js'
import { BOOT } from './api.js'

export const NORA_CHAT_PATH = '/api/method/neoffice_gym.api.coach_ai.chat_completions'
export const NORA_MODELS_PATH = '/api/method/neoffice_gym.api.coach_ai.models'

const base = chatCompletionsSpec('nora', { maxTokensField: 'max_tokens', temperature: 0 })

/** Frappe answers `{"message": <the provider's JSON>}`; an error answers `{"exception": …, "_server_messages": …}`. */
export const unwrap = data => (data && typeof data === 'object' && data.message && typeof data.message === 'object') ? data.message : data

const frappeError = data => {
  if (!data || typeof data !== 'object') return null
  if (data._server_messages) {
    try {
      const first = JSON.parse(data._server_messages)[0]
      const parsed = typeof first === 'string' ? JSON.parse(first) : first
      if (parsed && parsed.message) return String(parsed.message).replace(/<[^>]+>/g, '')
    } catch { /* fall through */ }
  }
  return data.exception || data.exc_type || null
}

export const noraSpec = {
  ...base,
  path: () => NORA_CHAT_PATH,
  modelsPath: NORA_MODELS_PATH,
  headers: () => (BOOT.csrf_token ? { 'X-Frappe-CSRF-Token': BOOT.csrf_token } : {}),
  errorMessage: data => base.errorMessage(unwrap(data)) || frappeError(data),
  readText: data => base.readText(unwrap(data)),
  readModels: data => base.readModels(unwrap(data)),
}

export const noraAdapter = httpAdapter(noraSpec)

/** The page's own origin: the endpoint is on the instance that served the journal. */
export const noraCfg = () => ({ provider: 'nora', providerOptions: { nora: { baseUrl: (typeof window !== 'undefined' && window.location && window.location.origin) || 'http://localhost' } } })

/** The session cookie is the credential — sent, never read. */
export const noraFetch = (url, init) => fetch(url, { ...init, credentials: 'same-origin' })

/** Is this journal's Coach the club's Nora? Read from the boot, which is static for the page. */
export const noraConfigured = () => {
  const c = BOOT && BOOT.coach
  return !!(c && c.enabled && c.provider === 'nora')
}
