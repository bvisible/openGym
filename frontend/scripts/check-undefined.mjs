#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
////
//// Catches a name the code uses and nothing defines. The v1.3.10 merge kept upstream's
//// `const noTabs = … || needsMobileOnboarding` in App.jsx without the line that defines it,
//// and the whole journal died on load (« needsMobileOnboarding is not defined », a blank page):
//// Vite does no scope analysis, no test renders the shell, and check-imports.mjs only knows the
//// names this repository exports. A merge resolution that takes upstream's half of a change is
//// exactly where this happens, so it will happen again; this is ESLint's no-undef over the app
//// and its two workers, and nothing else.
//
//   node scripts/check-undefined.mjs

import { ESLint } from 'eslint'
import globals from 'globals'
import { readdirSync, statSync } from 'node:fs'
import { dirname, join, relative } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const SKIP = new Set(['locales', 'instr', 'exercise-names', 'node_modules'])

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name)
    if (statSync(p).isDirectory()) { if (!SKIP.has(name)) walk(p, out) }
    else if (/\.(js|jsx|mjs)$/.test(name) && !/\.test\.(js|jsx|mjs)$/.test(name)) out.push(p)
  }
  return out
}

// The page's code, the standalone build's worker, and the worker Frappe serves under /gym.
const files = [...walk(join(root, 'src')), join(root, 'public', 'sw.js'), join(root, '..', 'opengym', 'www', 'gym_sw.js')]

const eslint = new ESLint({
  cwd: join(root, '..'),
  overrideConfigFile: true,
  overrideConfig: [{
    files: ['**/*.js', '**/*.jsx', '**/*.mjs'],
    languageOptions: {
      ecmaVersion: 'latest',
      sourceType: 'module',
      parserOptions: { ecmaFeatures: { jsx: true } },
      // What the build defines (vite.config.js `define`) beside the browser's and the worker's own.
      globals: { ...globals.browser, ...globals.serviceworker, __APP_VERSION__: 'readonly', __BUILD__: 'readonly', process: 'readonly' },
    },
    // The sources carry directives for rules this check does not load (react-hooks).
    linterOptions: { noInlineConfig: true, reportUnusedDisableDirectives: 'off' },
    rules: { 'no-undef': 'error' },
  }],
})

const results = await eslint.lintFiles(files)
// An undefined name, or a file that does not parse; the notes about the directives above are not problems.
const problems = results.flatMap(r => r.messages.filter(m => m.ruleId === 'no-undef' || m.fatal).map(m => ({ file: relative(root, r.filePath), ...m })))
if (problems.length) {
  console.error(`\n${problems.length} name(s) used and defined nowhere:\n`)
  for (const p of problems) console.error(`  ${p.file}:${p.line}:${p.column}  ${p.message}`)
  console.error('\nAn undefined name is a blank screen at runtime, not a build error.\n')
  process.exit(1)
}
console.log(`check-undefined: ${files.length} files, every name they use is defined.`)
