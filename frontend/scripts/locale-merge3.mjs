#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
////
//// A three-way merge of the locale packs, KEY BY KEY, during an upstream merge (the index holds the three stages of each
//// conflicted pack: :1: the base, :2: ours, :3: theirs). Git merges these files line by line, and a pack is one long
//// object: every upstream release adds strings in the middle of ours (v1.4.5: 2,232 per language), so the text conflicts
//// are huge and resolving them by hand loses keys without a sound (upstream writes its new keys with DOUBLE quotes).
////
////   node scripts/locale-merge3.mjs [--fr-todo <file.json>] [lang …]     (default: every conflicted pack under src/locales)
////
//// Theirs' text is the skeleton (their order, their comments, their new keys). On top of it:
////   - a key we reworded (ours differs from the base) keeps our text, read as written in our file;
////   - a key both sides added keeps ours (our screens' wording, tested);
////   - a key both sides changed keeps ours, except in Bengali (upstream retranslated the whole pack in v1.4.5);
////   - our own keys (not upstream's) come back at the end from our tail block, the `//// Neoffice` comments with them;
////   - our `//// Neoffice` comments outside that block are carried before the same key;
////   - a key upstream removed leaves our pack too (check-locales wants the same keys everywhere).
//// pt-BR.js holds overrides of pt.js (PT_BR_OVERRIDES): merge pt.js first, then pt-BR alone.
//// --fr-todo writes the French keys whose text is now upstream's (added or changed by this release): upstream writes « tu »,
//// we say « vous », so they go to the translation agents (Haiku) for the vouvoiement (the instructions file says how).
//// It prints, per language, what it kept from each side and what it could not place; it never stages anything.
import { readFileSync, writeFileSync } from 'node:fs'
import { execFileSync } from 'node:child_process'
import { createRequire } from 'node:module'
const require = createRequire(new URL('../package.json', import.meta.url))
const acorn = require('acorn')
const args = process.argv.slice(2)
const todoAt = args.indexOf('--fr-todo')
const frTodo = todoAt >= 0 ? args.splice(todoAt, 2)[1] : null
const top = execFileSync('git', ['rev-parse', '--show-toplevel'], { encoding: 'utf8' }).trim()
const outDir = `${top}/frontend/src/locales`
const stage = (n, l) => execFileSync('git', ['show', `:${n}:frontend/src/locales/${l}.js`], { cwd: top, encoding: 'utf8', maxBuffer: 64 << 20 })
const langs = args.length ? args : execFileSync('git', ['diff', '--name-only', '--diff-filter=U', '--', 'frontend/src/locales'], { cwd: top, encoding: 'utf8' })
  .split('\n').filter(Boolean).map(f => f.replace(/^.*\//, '').replace(/\.js$/, ''))
  .sort((a, b) => (a === 'pt-BR') - (b === 'pt-BR'))

function parse(text) {
  const ast = acorn.parse(text, { ecmaVersion: 'latest', sourceType: 'module' })
  let obj = ast.body.find(n => n.type === 'ExportDefaultDeclaration').declaration
  if (obj.properties.every(p => p.type === 'SpreadElement')) {
    obj = ast.body.find(n => n.type === 'ExportNamedDeclaration' && n.declaration?.declarations?.[0]?.init?.type === 'ObjectExpression').declaration.declarations[0].init
  }
  const map = new Map(), list = []
  for (const p of obj.properties) {
    if (p.type !== 'Property') continue
    const k = p.key.type === 'Literal' ? p.key.value : p.key.name
    const raw = text.slice(p.value.start, p.value.end)
    let v
    if (p.value.type === 'Literal') v = p.value.value
    else v = 'RAW:' + raw
    const e = { k, v, raw, p }
    list.push(e)
    map.set(k, e) // the last occurrence wins, as in JS
  }
  return { text, obj, map, list }
}
const lineStart = (t, i) => t.lastIndexOf('\n', i - 1) + 1
const lineEnd = (t, i) => { const j = t.indexOf('\n', i); return j < 0 ? t.length : j + 1 }

const report = {}
for (const l of langs) {
  const [B, O, T] = [1, 2, 3].map(s => parse(stage(s, l)))
  const tailMarker = O.text.search(/\n[ \t]*\/\/\/\/ Neoffice — (the strings of our own screens|our own strings)/)
  if (tailMarker < 0) throw new Error(l + ': no tail marker')
  const tailStart = tailMarker + 1
  const edits = [] // [start, end, text]
  const stats = { oursOverride: 0, bothAdd: 0, bothChgOurs: 0, bothChgTheirs: 0, carriedComments: 0, appended: 0, dropped: [] }
  const fromTheirs = [] // keys whose value is upstream's, added or changed by v1.4.5
  for (const e of T.list) {
    if (T.map.get(e.k) !== e) continue
    const o = O.map.get(e.k), b = B.map.get(e.k)
    let useOurs = false
    if (o && !b) { useOurs = true; stats.bothAdd++ }
    else if (o && b && o.v !== b.v) {
      if (e.v === b.v) { useOurs = true; stats.oursOverride++ }
      else if (l === 'bn') stats.bothChgTheirs++
      else { useOurs = true; stats.bothChgOurs++ }
    }
    if (useOurs && o.raw !== e.raw) edits.push([e.p.value.start, e.p.value.end, o.raw])
    if (!useOurs && (!b || b.v !== e.v)) fromTheirs.push(e.k)
  }
  // Our marker comments outside the tail: carried before the same key in theirs.
  const head = O.text.slice(0, tailStart)
  for (const m of head.matchAll(/^[ \t]*\/\/\/\/ Neoffice[^\n]*\n(?:[ \t]*\/\/[^\n]*\n)*/gm)) {
    const after = m.index + m[0].length
    const next = O.list.find(x => x.p.start >= after)
    const t = next && T.map.get(next.k)
    if (!t) { console.error(l, 'comment not carried:', m[0].slice(0, 80)); continue }
    const at = lineStart(T.text, t.p.start)
    edits.push([at, at, m[0]])
    stats.carriedComments++
  }
  // Our own keys: the tail, minus what upstream now has, minus duplicates; plus our keys outside the tail.
  const tailEnd = O.obj.end - 1 // the closing brace
  const keep = new Set(O.list.filter(x => !B.map.has(x.k) && !T.map.has(x.k)).map(x => x.k))
  if (l === 'pt-BR') { // only overrides of keys pt.js still has
    const ptKeys = new Set(parse(readFileSync(`${outDir}/pt.js`, 'utf8')).map.keys())
    for (const k of [...keep]) if (!ptKeys.has(k)) { keep.delete(k); stats.dropped.push(k) }
    // ours' tail also rewords pt keys that were never in the base overrides: keep them too
    for (const x of O.list) if (x.p.start >= tailStart && !T.map.has(x.k) && ptKeys.has(x.k)) keep.add(x.k)
  }
  let tail = ''
  let cut = tailStart
  const seen = new Set()
  const tailProps = O.list.filter(x => x.p.start >= tailStart && x.p.start < tailEnd)
  // last occurrence of a duplicated key wins: drop the earlier ones
  const lastIdx = new Map(); tailProps.forEach((x, i) => lastIdx.set(x.k, i))
  tailProps.forEach((x, i) => {
    const s = lineStart(O.text, x.p.start), en = lineEnd(O.text, x.p.end)
    tail += O.text.slice(cut, s)
    if (keep.has(x.k) && lastIdx.get(x.k) === i && !seen.has(x.k)) { tail += O.text.slice(s, en); seen.add(x.k); stats.appended++ }
    cut = en
  })
  tail += O.text.slice(cut, lineStart(O.text, tailEnd))
  const outside = O.list.filter(x => keep.has(x.k) && !seen.has(x.k) && O.map.get(x.k) === x)
  for (const x of outside) { tail += O.text.slice(lineStart(O.text, x.p.start), lineEnd(O.text, x.p.end)); seen.add(x.k); stats.appended++ }
  // insert before theirs' closing brace; make sure the last property ends with a comma
  const close = T.obj.end - 1
  const lastProp = T.obj.properties[T.obj.properties.length - 1]
  const between = T.text.slice(lastProp.end, close)
  if (!between.includes(',')) edits.push([lastProp.end, lastProp.end, ','])
  edits.push([lineStart(T.text, close), lineStart(T.text, close), tail.replace(/\n*$/, '\n')])
  edits.sort((a, b) => b[0] - a[0] || b[1] - a[1])
  let out = T.text
  for (const [s, e, t] of edits) out = out.slice(0, s) + t + out.slice(e)
  const M = parse(out)
  const dups = M.list.length - M.map.size
  // every key of ours that should be there is there, with our value
  const missing = [...keep].filter(k => !M.map.has(k))
  const wrong = [...M.map.values()].filter(x => { const o = O.map.get(x.k), b = B.map.get(x.k); return o && (!b || o.v !== b.v) && !(l === 'bn' && b && T.map.get(x.k)?.v !== b.v) && x.v !== o.v })
  const lostTheirs = [...T.map.keys()].filter(k => !M.map.has(k))
  writeFileSync(`${outDir}/${l}.js`, out)
  report[l] = { ...stats, dropped: stats.dropped.length, keys: M.map.size, theirsKeys: T.map.size, dups, missing: missing.length, wrong: wrong.map(x => x.k), lostTheirs: lostTheirs.length, fromTheirs: fromTheirs.length }
  if (l === 'fr' && frTodo) writeFileSync(frTodo, JSON.stringify(fromTheirs.map(k => ({ k, fr: M.map.get(k).v, old: B.map.get(k)?.v ?? null })), null, 1))
}
console.table(report)
