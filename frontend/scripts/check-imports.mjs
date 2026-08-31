#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
////
//// Catches a symbol that is USED but never imported.
////
//// Why this exists: the 2026-08-27 upstream merge dropped `dateLocale` from an
//// import line in sheets.jsx — I resolved that conflict by taking upstream's
//// version of the line, and theirs does not carry a symbol only our code uses.
//// The class sheet then went to a BLACK SCREEN on open (ReferenceError, nothing
//// rendered at all), and it shipped: neither `npm run build` nor `npx vitest`
//// sees it. Vite does no scope analysis, and no test mounts that sheet.
////
//// Conflict resolution on an import line is exactly where this happens, so it
//// will happen again at the next merge. This is the cheap net.
////
//// Deliberately narrow: it only knows about symbols this repo EXPORTS, and only
//// flags them where they are called as `name(`. It is not a linter — it is the
//// one check that would have caught the bug that shipped.

import { readFileSync } from 'node:fs'
import { readdirSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'

const SRC = new URL('../src/', import.meta.url).pathname
// Data packs: thousands of keys, no code worth scanning.
const SKIP_DIRS = ['locales', 'instr', 'exercise-names', 'names']

function walk(dir, out = []) {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) {
      if (!SKIP_DIRS.includes(entry)) walk(full, out)
    } else if (/\.jsx?$/.test(entry)) {
      out.push(full)
    }
  }
  return out
}

const files = walk(SRC)

// 1. Every symbol this repository exports, and where from.
const exportedBy = new Map()
for (const file of files) {
  const src = readFileSync(file, 'utf8')
  const add = name => {
    if (!name) return
    if (!exportedBy.has(name)) exportedBy.set(name, new Set())
    exportedBy.get(name).add(file)
  }
  for (const m of src.matchAll(/^export\s+(?:async\s+)?(?:function|const|let|class)\s+([A-Za-z_$][\w$]*)/gm)) add(m[1])
  for (const m of src.matchAll(/^export\s*\{([^}]*)\}/gm)) {
    for (const part of m[1].split(',')) add(part.split(' as ').pop().trim())
  }
}

// 2. In each file, what is imported (static or dynamic) or declared locally.
const problems = []
for (const file of files) {
  if (/\.test\.jsx?$/.test(file)) continue
  const src = readFileSync(file, 'utf8')

  const known = new Set()
  for (const m of src.matchAll(/import\s*(?:[\w$]+\s*,\s*)?\{([^}]*)\}\s*from/g)) {
    for (const part of m[1].split(',')) known.add(part.split(' as ').pop().trim())
  }
  for (const m of src.matchAll(/import\s+([\w$]+)\s+from/g)) known.add(m[1])
  // `const { a, b } = await import('…')` — a dynamic import is an import too.
  for (const m of src.matchAll(/(?:const|let|var)\s*\{([^}]*)\}\s*=\s*await\s+import\s*\(/g)) {
    for (const part of m[1].split(',')) known.add(part.split(':').pop().trim())
  }
  for (const m of src.matchAll(/(?:^|\s)(?:const|let|var|function|class)\s+([A-Za-z_$][\w$]*)/g)) known.add(m[1])

  // Strip import lines and comments so a symbol merely MENTIONED in a comment
  // (`pushSupported()` is false) is not reported.
  const body = src
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/^\s*(?:\/\/|\*).*$/gm, '')

  for (const [name, sources] of exportedBy) {
    if (known.has(name) || sources.has(file)) continue
    if (new RegExp(`(?<![\\w$.])${name}\\s*\\(`).test(body)) {
      problems.push({ file: relative(SRC, file), name, from: relative(SRC, [...sources][0]) })
    }
  }
}

if (problems.length) {
  console.error(`\n${problems.length} symbol(s) used without being imported:\n`)
  for (const p of problems) console.error(`  ${p.file}: ${p.name}()  — exported by ${p.from}`)
  console.error('\nA missing import is a blank screen at runtime, not a build error.\n')
  process.exit(1)
}
console.log(`check-imports: ${files.length} files, no symbol used without an import.`)
