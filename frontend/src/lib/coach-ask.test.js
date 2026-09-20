// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). Tests for the one-shot
//// questions to the club's Coach: what the club allows, what leaves on the
//// wire, and what a refusal says to the member.
import { beforeEach, describe, expect, it, vi } from 'vitest'

const load = async () => await import('./coach-ask.js')

const answer = text => ({
  ok: true,
  status: 200,
  json: async () => ({ message: { choices: [{ message: { content: text } }] } }),
})

const refusal = (status, message) => ({
  ok: false,
  status,
  json: async () => ({
    exc_type: 'PermissionError',
    _server_messages: JSON.stringify([JSON.stringify({ message })]),
  }),
})

const SQUAT = { id: 'squat', n: 'Back squat', bp: 'legs', eq: 'barbell', primaries: ['quadriceps'], secondaries: ['glutes'] }

let calls

beforeEach(async () => {
  vi.resetModules()
  calls = []
  window.gym_boot = { csrf_token: 'tok', coach: { enabled: true, provider: 'nora', can: {} } }
  global.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return answer('Par.\n\nDeux.') })
  const { forgetExplanations } = await load()
  forgetExplanations()
})

describe('what the club allows', () => {
  it('reads an absent answer as allowed — an older server must not empty the screen', async () => {
    const { may, askable } = await load()
    expect(may('explain')).toBe(true)
    expect(may('messageCoach')).toBe(true)
    expect(askable('explain')).toBe(true)
  })

  it('hides it only on an explicit false', async () => {
    window.gym_boot.coach.can = { explain: false, messageCoach: true }
    const { may, askable } = await load()
    expect(may('explain')).toBe(false)
    expect(askable('explain')).toBe(false)
    expect(may('messageCoach')).toBe(true)
  })

  it('has nowhere to ask when the club has no Coach at all', async () => {
    window.gym_boot.coach = { enabled: false }
    const { askable } = await load()
    expect(askable('explain')).toBe(false)
  })
})

describe('what leaves on the wire', () => {
  it('names the kind, because the server refuses a call that does not', async () => {
    const { explainExercise } = await load()
    await explainExercise(SQUAT)
    expect(calls[0].init.headers['X-Coach-Kind']).toBe('explain')
    expect(calls[0].init.headers['X-Frappe-CSRF-Token']).toBe('tok')
  })

  it('refuses to ask at all without a kind', async () => {
    const { askNora } = await load()
    await expect(askNora('', { system: 's', prompt: 'p' })).rejects.toThrow()
    expect(calls).toHaveLength(0)
  })

  it('sends ONE system message — the gateway answers 400 to a second one', async () => {
    const { explainExercise } = await load()
    await explainExercise(SQUAT)
    const sent = JSON.parse(calls[0].init.body)
    expect(sent.messages.map(m => m.role)).toEqual(['system', 'user'])
  })

  it('hands the model what we know about the movement, so it invents nothing', async () => {
    const { explainExercise } = await load()
    await explainExercise(SQUAT)
    const sent = JSON.parse(calls[0].init.body)
    expect(sent.messages[1].content).toContain('Back squat')
    expect(sent.messages[1].content).toContain('barbell')
    expect(sent.messages[1].content).toContain('Quads')  //: MUSCLE_NAME's own word for it, the one the member reads
    expect(sent.messages[0].content).toContain('rather than inventing it')
  })

  it('asks for the message to be worded, not answered', async () => {
    const { wordItForCoach } = await load()
    await wordItForCoach('jai mal au dos quand je souleve')
    const sent = JSON.parse(calls[0].init.body)
    expect(calls[0].init.headers['X-Coach-Kind']).toBe('message')
    expect(sent.messages[0].content).toContain('Do not answer their question')
    expect(sent.messages[1].content).toBe('jai mal au dos quand je souleve')
  })
})

describe('the same movement is not paid for twice', () => {
  it('keeps an explanation for the session', async () => {
    const { explainExercise } = await load()
    expect(await explainExercise(SQUAT)).toBe('Par.\n\nDeux.')
    expect(await explainExercise(SQUAT)).toBe('Par.\n\nDeux.')
    expect(calls).toHaveLength(1)
  })

  it('but asks again for another movement', async () => {
    const { explainExercise } = await load()
    await explainExercise(SQUAT)
    await explainExercise({ ...SQUAT, id: 'bench', n: 'Bench press' })
    expect(calls).toHaveLength(2)
  })

  it('and never keeps a failure', async () => {
    global.fetch = vi.fn(async (url, init) => { calls.push({ url, init }); return refusal(403, 'Your club has not enabled this from the AI coach.') })
    const { explainExercise } = await load()
    await expect(explainExercise(SQUAT)).rejects.toThrow()
    await expect(explainExercise(SQUAT)).rejects.toThrow()
    expect(calls).toHaveLength(2)
  })
})

describe('what a refusal says', () => {
  it('repeats the club’s own words rather than a generic failure', async () => {
    global.fetch = vi.fn(async () => refusal(403, 'Your club has not enabled this from the AI coach.'))
    const { explainExercise } = await load()
    await expect(explainExercise(SQUAT)).rejects.toThrow('Your club has not enabled this from the AI coach.')
  })

  it('says the daily allowance is spent, in the server’s words', async () => {
    global.fetch = vi.fn(async () => refusal(429, 'The coach is resting — you have used today’s 10 runs.'))
    const { explainExercise } = await load()
    await expect(explainExercise(SQUAT)).rejects.toThrow(/today/)
  })

  it('does not present an empty answer as an explanation', async () => {
    global.fetch = vi.fn(async () => answer('   '))
    const { explainExercise } = await load()
    await expect(explainExercise(SQUAT)).rejects.toThrow()
  })
})
