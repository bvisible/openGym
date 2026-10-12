//// Neoffice — added file (no upstream equivalent).
//// Takes the translation agents' answers (steps-answers-NN.json, desc-answers-NN.json) back into the language's
//// packs, after checking them against the batches they answer (translation-batches.mjs).
////
////   node scripts/translation-merge.mjs <lang> <dir>          check, and write instr/<lang>.js + exercise-desc/<lang>.js
////   node scripts/translation-merge.mjs <lang> <dir> --check  check only
////   node scripts/translation-merge.mjs <lang> <dir> --only=steps   (or --only=desc) leave the other kind alone, e.g. while
////                                                    its batches are still being written
////
//// Hard failures (nothing is written): an id missing or not in the batch, a steps list that does not have the English
//// list's length, an empty or non-string entry. Soft warnings (printed, written anyway): a text identical to its
//// English, a second-person singular in French, numbers that changed. Apostrophes are straightened, as in the packs.

import { readFileSync, readdirSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')

const numbersIn = text => (text.match(/\d+(?:[.,]\d+)?/g) || []).sort().join('|')
// Unicode-aware: a plain \b treats « ô » as a word edge and would find « tes » in « côtes ».
const TUTOIEMENT = /(?<![\p{L}])(?:(?:tu|ton|ta|tes|toi|te)(?![\p{L}])|t['\u2019](?=\p{L}))/iu

const clean = text => text.replace(/’/g, "'").replace(/ /g, ' ').trim()

/** Checks one answers object against its batch rows. Returns { texts, hard, soft } with texts = id → cleaned answer. */
export function checkAnswers(kind, rows, answers, lang = 'fr') {
  const hard = []
  const soft = []
  const texts = {}
  const known = new Set(rows.map(r => r.id))
  for (const id of Object.keys(answers)) if (!known.has(id)) hard.push(`${id}: not in the batch`)
  for (const { id, en } of rows) {
    const got = answers[id]
    if (got == null) { hard.push(`${id}: missing`); continue }
    if (kind === 'steps') {
      if (!Array.isArray(got) || got.some(s => typeof s !== 'string')) { hard.push(`${id}: not a list of strings`); continue }
      if (got.length !== en.length) { hard.push(`${id}: ${got.length} steps for ${en.length}`); continue }
    } else if (typeof got !== 'string') { hard.push(`${id}: not a string`); continue }
    const pairs = kind === 'steps' ? en.map((e, i) => [e, got[i]]) : [[en, got]]
    const out = []
    for (const [from, to] of pairs) {
      const text = clean(to)
      if (!text) { hard.push(`${id}: empty`); continue }
      if (/[\r\n]/.test(text)) { hard.push(`${id}: line break`); continue }
      if (text === from) soft.push(`${id}: identical to the English`)
      if (lang === 'fr' && TUTOIEMENT.test(text)) soft.push(`${id}: second person singular? ${text.slice(0, 60)}`)
      if (numbersIn(from) !== numbersIn(text)) soft.push(`${id}: numbers changed: ${text.slice(0, 60)}`)
      out.push(text)
    }
    texts[id] = kind === 'steps' ? out : out[0]
  }
  return { texts, hard, soft }
}

const readJsonl = file => readFileSync(file, 'utf8').split('\n').filter(Boolean).map(line => JSON.parse(line))
const files = (dir, kind) => readdirSync(dir).filter(f => new RegExp(`^${kind}-answers-\\d+\\.json$`).test(f)).sort()

/** The pack file text: a header, then one line of JSON in the English pack's key order (the packs are read, not edited). */
export function packSource(header, enPack, merged) {
  const ordered = {}
  for (const id of Object.keys(enPack)) if (merged[id] !== undefined) ordered[id] = merged[id]
  return header + '\nexport default ' + JSON.stringify(ordered) + '\n'
}

const stripBody = source => source.slice(0, source.indexOf('export default'))

async function main() {
  const [lang, dir, ...flags] = process.argv.slice(2)
  if (!lang || !dir) {
    console.error('usage: node scripts/translation-merge.mjs <lang> <dir> [--check] [--only=steps|desc]')
    process.exit(2)
  }
  const only = (flags.find(f => f.startsWith('--only=')) || '').slice('--only='.length)
  const kinds = only ? [only] : ['steps', 'desc']
  const load = async rel => (existsSync(join(SRC, rel)) ? (await import(pathToFileURL(join(SRC, rel)).href)).default : {})
  const results = {}
  let failed = false
  for (const kind of kinds) {
    const merged = {}
    for (const answersFile of files(dir, kind)) {
      const n = answersFile.match(/(\d+)/)[1]
      const rows = readJsonl(join(dir, `${kind}-batch-${n}.jsonl`))
      const { texts, hard, soft } = checkAnswers(kind, rows, JSON.parse(readFileSync(join(dir, answersFile), 'utf8')), lang)
      console.log(`[${kind} ${n}] ${rows.length} rows, ${hard.length} hard, ${soft.length} soft`)
      hard.slice(0, 8).forEach(h => console.log('   HARD', h))
      soft.slice(0, 5).forEach(s => console.log('   soft', s))
      if (hard.length) failed = true
      else Object.assign(merged, texts)
    }
    results[kind] = merged
  }
  results.steps = results.steps || {}
  results.desc = results.desc || {}
  if (failed) { console.error('hard failures: nothing written'); process.exit(1) }
  if (flags.includes('--check')) return

  const enSteps = await load('instr/en.js')
  const enDesc = await load('exercise-desc/en.js')
  const stepsPath = join(SRC, `instr/${lang}.js`)
  const descPath = join(SRC, `exercise-desc/${lang}.js`)
  const stepsHeader = existsSync(stepsPath) ? stripBody(readFileSync(stepsPath, 'utf8')).trimEnd() : '// generated by scripts/translation-merge.mjs'
  const descHeader = existsSync(descPath)
    ? stripBody(readFileSync(descPath, 'utf8')).trimEnd()
    : `//// Neoffice — added file (no upstream equivalent). One or two sentences on what each exercise is, in ${lang}.\n//// Upstream ships the descriptions in English only; the app shows the language's own when a pack like this one exists\n//// (lib/i18n.js loads exercise-desc/<lang>.js). Written by the translation agents with scripts/translation-merge.mjs.`
  if (Object.keys(results.steps).length) writeFileSync(stepsPath, packSource(stepsHeader, enSteps, { ...(await load(`instr/${lang}.js`)), ...results.steps }))
  if (Object.keys(results.desc).length) writeFileSync(descPath, packSource(descHeader, enDesc, { ...(await load(`exercise-desc/${lang}.js`)), ...results.desc }))
  console.log(`written: ${Object.keys(results.steps).length} step lists, ${Object.keys(results.desc).length} descriptions`)
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main()
