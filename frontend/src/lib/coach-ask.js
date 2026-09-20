//// Neoffice — added file (no upstream equivalent).
//// One-shot questions to the club's Nora, beside the program pipeline.
////
//// Upstream's pipeline exists to produce a VALIDATED PROGRAM: it asks for
//// JSON, carries a schema, validates the shape and spends a repair round when
//// the answer is wrong. Two of the things a club can tick are not programs —
//// explaining a movement, and helping a member word a question for their human
//// coach — and pushing them through it would mean asking a model for JSON in
//// order to render prose, with a validator that has nothing to validate.
////
//// So they take the same endpoint, the same `X-Coach-Kind` header, the same
//// club switches and the same accounting, and nothing else: one request, one
//// paragraph of text back.
import { BOOT } from './api.js'
import { NORA_CHAT_PATH, unwrap, frappeError, noraFetch } from './coach-nora.js'
import { t, getLang, exerciseNameFor } from './i18n.js'
import { MUSCLE_NAME } from './muscles.js'

//: What the club lets the Coach do. Absent — an older server, the demo, a
//: mobile build — reads as ALLOWED: the club's answer is what removes
//: something, never our not knowing. The server refuses regardless.
export const may = capability => {
  const can = (BOOT.coach && BOOT.coach.can) || {}
  return can[capability] !== false
}

/** Is the Coach this club's Nora at all? A question has nowhere to go otherwise. */
export const askable = capability => !!(BOOT.coach && BOOT.coach.enabled) && may(capability)

const MODEL_LANGUAGE = { fr: 'French', de: 'German', it: 'Italian', es: 'Spanish', pt: 'Portuguese', en: 'English' }

/** The language to answer in, named for the model rather than as a code. */
const answerLanguage = () => MODEL_LANGUAGE[(getLang() || 'en').slice(0, 2)] || 'English'

/**
 * One question, one answer, in plain text.
 *
 * `kind` is what the club's switch is keyed on and what the call is counted
 * under; the server REFUSES a request that does not name one, so it is never
 * optional here either.
 */
export async function askNora(kind, { system, prompt, maxTokens = 500 }) {
  if (!kind) throw new Error(t('This question does not say what it is for.'))
  const res = await noraFetch(NORA_CHAT_PATH, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(BOOT.csrf_token ? { 'X-Frappe-CSRF-Token': BOOT.csrf_token } : {}),
      'X-Coach-Kind': kind,
    },
    body: JSON.stringify({
      messages: [
        { role: 'system', content: system },
        { role: 'user', content: prompt },
      ],
      temperature: 0,
      max_tokens: maxTokens,
    }),
  })
  let data = null
  try { data = await res.json() } catch { data = null }
  const body = unwrap(data)
  if (!res.ok || (body && body.error)) {
    //: The club's refusal and the provider's outage read differently and the
    //: member deserves the difference: one is an answer, the other a hiccup.
    const said = frappeError(data) || (body && body.error && (body.error.message || body.error)) || ''
    throw new Error(String(said) || t('The Coach could not be reached. Try again in a moment.'))
  }
  const choice = ((body && body.choices) || [])[0]
  const text = (choice && choice.message && choice.message.content) || ''
  if (!text.trim()) throw new Error(t('The Coach answered nothing this time.'))
  return text.trim()
}

const EXPLAIN_SYSTEM = [
  'You are a fitness coach explaining ONE exercise to the member who is about to do it.',
  'Four short paragraphs at most, no headings and no lists: how the movement is performed,',
  'what people most often get wrong, how to breathe, and one way to make it easier or harder.',
  'Say nothing about sets, weights, or their programme — they did not ask for that.',
  'If you do not know this movement, say so plainly rather than inventing it.',
].join(' ')

/** What we actually know about the movement, so the model has no room to invent it. */
const exerciseFacts = ex => {
  const named = list => (list || []).map(m => MUSCLE_NAME[m] || m).filter(Boolean)
  const primary = named(ex.primaries && ex.primaries.length ? ex.primaries : (ex.tg ? [ex.tg] : []))
  const secondary = named(ex.secondaries)
  return [
    `Exercise: ${exerciseNameFor(ex)}`,
    ex.bp ? `Body part: ${ex.bp}` : '',
    ex.eq ? `Equipment: ${ex.eq}` : '',
    primary.length ? `Primary muscles: ${primary.join(', ')}` : '',
    secondary.length ? `Secondary muscles: ${secondary.join(', ')}` : '',
  ].filter(Boolean).join('\n')
}

//: The same movement explained twice is the same answer, and a member taps
//: around. A club pays per call and the member has a daily allowance, so an
//: explanation already given is kept for the rest of the session — in memory
//: only: it is not the member's data, and a stale one would outlive a club
//: that changed its mind about the Coach.
const explained = new Map()

/** « Expliquer un exercice » — the club's `explain` switch. */
export async function explainExercise(ex) {
  const key = `${ex.id}:${getLang()}`
  if (explained.has(key)) return explained.get(key)
  const text = await askNora('explain', {
    system: `${EXPLAIN_SYSTEM} Answer in ${answerLanguage()}.`,
    prompt: exerciseFacts(ex),
  })
  explained.set(key, text)
  return text
}

/** For the tests, and for a language change: nothing else should call it. */
export const forgetExplanations = () => explained.clear()

const MESSAGE_SYSTEM = [
  'A gym member wants to ask their human coach something and is not sure how to put it.',
  'Rewrite what they typed as ONE short message the coach can act on: what they want to know,',
  'and the one fact about themselves that lets the coach answer.',
  'Write it as the member, in the first person. No greeting, no sign-off, no preamble of your own.',
  'Answer with the message itself and nothing else.',
  'Do not answer their question and do not give training advice — a human is going to read this.',
].join(' ')

/** « Aider à écrire au coach » — the club's `messageCoach` switch. */
export const wordItForCoach = draft => askNora('message', {
  system: `${MESSAGE_SYSTEM} Write it in ${answerLanguage()}.`,
  prompt: String(draft || '').slice(0, 1500),
  maxTokens: 300,
})
