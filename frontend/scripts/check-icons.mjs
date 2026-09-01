#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
////
//// Refuses an <Icon name="…"> that Icon.jsx does not know.
////
//// Icon returns `null` for an unknown name — silently, by design:
////
////     const d = P[name]
////     if (!d) return null
////
//// So a typo is not an error, not a warning, and not a broken build. It is an
//// icon that simply is not there: a row with a blank where its status marker
//// should be, which reads as a rendering glitch rather than as a mistake.
////
//// Found on 2026-09-01: the session outline shipped with `circle` and `chev`,
//// neither of which exists (the set has `dot` and `chevronRight`). Every test
//// passed — mounting the sheet asserts on its TEXT, and a missing icon changes
//// no text at all.
////
//// Run: node scripts/check-icons.mjs

import { readFileSync, readdirSync, statSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join, relative } from 'node:path'

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..')
const SRC = join(ROOT, 'src')

//: The icon set, read from the same file the component reads.
const iconSource = readFileSync(join(SRC, 'components/Icon.jsx'), 'utf8')
//: Keys of the path table: `name: 'M…'` or `name: \`…\``, at the start of a line.
const known = new Set(
  [...iconSource.matchAll(/^\s{2}([a-zA-Z][a-zA-Z0-9]*)\s*:/gm)].map(m => m[1])
)

function* files(dir) {
  for (const entry of readdirSync(dir)) {
    if (entry === 'node_modules' || entry === 'dist') continue
    const full = join(dir, entry)
    if (statSync(full).isDirectory()) yield* files(full)
    else if (/\.jsx?$/.test(entry)) yield full
  }
}

const problems = []
for (const file of files(SRC)) {
  const text = readFileSync(file, 'utf8')
  //: Literal names only — `name="x"` and `name={cond ? 'a' : 'b'}`. A name
  //: built at runtime (name={glyphOf(x)}) cannot be checked here and is left
  //: to the code that produces it.
  for (const m of text.matchAll(/<Icon\b[^>]*?\bname=(?:"([^"]+)"|\{([^}]*)\})/g)) {
    //: In `name={a === 'x' ? 'icon' : 'other'}` only the BRANCHES are icon
    //: names — `'x'` is what is being compared. Dropping the operands of a
    //: comparison is what separates a real miss from noise; without it this
    //: guard reported four correct lines and would have been switched off.
    const expr = m[1] ? null : m[2].replace(/[=!]==?\s*'[^']*'/g, '')
    const names = m[1] ? [m[1]] : [...expr.matchAll(/'([a-zA-Z][a-zA-Z0-9]*)'/g)].map(x => x[1])
    for (const name of names) {
      if (!known.has(name)) {
        const line = text.slice(0, m.index).split('\n').length
        problems.push({ file: relative(ROOT, file), line, name })
      }
    }
  }
}

if (problems.length) {
  console.error('✗ unknown icon names — Icon renders nothing for these:\n')
  for (const p of problems) console.error(`  ${p.file}:${p.line}  name="${p.name}"`)
  console.error('\nIcon.jsx returns null for a name it does not know, so this fails')
  console.error('nowhere else: not the build, not the tests, not the app.')
  console.error(`\n${known.size} names are defined. Closest matches:`)
  for (const p of new Set(problems.map(x => x.name))) {
    const near = [...known].filter(k => k.toLowerCase().includes(p.toLowerCase().slice(0, 4)))
    console.error(`  ${p} → ${near.length ? near.join(', ') : '(no obvious match)'}`)
  }
  process.exit(1)
}
console.log(`✓ icons: every <Icon name> resolves (${known.size} defined)`)
