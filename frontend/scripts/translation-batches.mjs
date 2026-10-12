//// Neoffice — added file (no upstream equivalent).
//// The work lists for translating the catalogue's texts into one language, to hand to the translation agents
//// (Haiku, in batches). Upstream ships the exercise steps and descriptions in English only, plus a pack per
//// language for the steps it has translated; every version brings exercises our packs do not cover yet, and
//// the member then reads English in the middle of a French screen.
////
////   node scripts/translation-batches.mjs <lang> <outDir>
////
//// writes, for <lang>:
////   steps-batch-NN.jsonl  the exercises that have English steps and none in <lang> (150 per file)
////   desc-batch-NN.jsonl   the exercises that have an English description and none in <lang> (250 per file)
////   names-reference.tsv   English exercise name TAB the name the journal shows in <lang> (the vocabulary to follow)
////   steps-reference.tsv   English step TAB its translation, for the steps already translated (grep-able)
//// Each line of a batch is {"id", "name", "en"}: `name` is the exercise's displayed name in <lang>, so a translator
//// uses the same word for the equipment as the name does ("au câble" or "à la poulie") on the same sheet.
//// The answers come back as steps-answers-NN.json / desc-answers-NN.json and go in with translation-merge.mjs.

import { mkdirSync, writeFileSync } from 'node:fs'
import { existsSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const SRC = resolve(dirname(fileURLToPath(import.meta.url)), '../src')
export const STEPS_PER_BATCH = 150
export const DESCS_PER_BATCH = 250

const load = async rel => {
  const file = join(SRC, rel)
  if (!existsSync(file)) return {}
  return (await import(pathToFileURL(file).href)).default || {}
}

const chunk = (items, size) => {
  const out = []
  for (let i = 0; i < items.length; i += size) out.push(items.slice(i, i + size))
  return out
}
const numeric = (a, b) => Number(a) - Number(b)
const pad = n => String(n + 1).padStart(2, '0')

/** What is missing in `lang`, and the names to show next to it. Pure: the caller passes the packs. */
export function gaps({ enSteps, steps, enDesc, desc, names, englishNames }) {
  const label = id => names[id] || englishNames[id] || id
  const stepsIds = Object.keys(enSteps).filter(id => !steps[id]).sort(numeric)
  const descIds = Object.keys(enDesc).filter(id => !desc[id]).sort(numeric)
  return {
    steps: stepsIds.map(id => ({ id, name: label(id), en: enSteps[id] })),
    desc: descIds.map(id => ({ id, name: label(id), en: enDesc[id] })),
  }
}

async function main() {
  const [lang, outDir] = process.argv.slice(2)
  if (!lang || !outDir) {
    console.error('usage: node scripts/translation-batches.mjs <lang> <outDir>')
    process.exit(2)
  }
  const { EXDB } = await import(pathToFileURL(join(SRC, 'lib/exercises-data.js')).href)
  const { layClubNames } = await import(pathToFileURL(join(SRC, 'lib/club-names.js')).href)
  const enSteps = await load('instr/en.js')
  const steps = await load(`instr/${lang}.js`)
  const enDesc = await load('exercise-desc/en.js')
  const desc = await load(`exercise-desc/${lang}.js`)
  const names = layClubNames(await load(`exercise-names/${lang}.js`), await load(`club-names/${lang}.js`))
  const englishNames = Object.fromEntries(EXDB.map(e => [e.id, e.n]))

  const work = gaps({ enSteps, steps, enDesc, desc, names, englishNames })
  mkdirSync(outDir, { recursive: true })
  const lines = list => list.map(row => JSON.stringify(row)).join('\n') + '\n'
  chunk(work.steps, STEPS_PER_BATCH).forEach((rows, i) => writeFileSync(join(outDir, `steps-batch-${pad(i)}.jsonl`), lines(rows)))
  chunk(work.desc, DESCS_PER_BATCH).forEach((rows, i) => writeFileSync(join(outDir, `desc-batch-${pad(i)}.jsonl`), lines(rows)))

  const reference = []
  for (const id of Object.keys(steps)) {
    const a = enSteps[id]
    const b = steps[id]
    if (a && a.length === b.length) a.forEach((sentence, k) => reference.push(sentence + '\t' + b[k]))
  }
  writeFileSync(join(outDir, 'steps-reference.tsv'), reference.join('\n') + '\n')
  writeFileSync(join(outDir, 'names-reference.tsv'), Object.keys(names).filter(id => englishNames[id]).map(id => englishNames[id] + '\t' + names[id]).join('\n') + '\n')

  console.log(JSON.stringify({
    lang,
    stepsMissing: work.steps.length,
    stepsBatches: Math.ceil(work.steps.length / STEPS_PER_BATCH),
    descMissing: work.desc.length,
    descBatches: Math.ceil(work.desc.length / DESCS_PER_BATCH),
  }))
}

if (process.argv[1] && pathToFileURL(resolve(process.argv[1])).href === import.meta.url) await main()
