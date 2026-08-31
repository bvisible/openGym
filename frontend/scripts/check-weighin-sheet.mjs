#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
////
//// Guards the weigh-in sheet against the next upstream merge.
////
//// Upstream asks for a body weight before EVERY workout, unconditionally, and
//// its sheet has two buttons. We changed both, for reasons a merge cannot
//// know:
////
////   * body weight is a SENSITIVE subject. For a member who does not want to
////     think about their weight — and a gym has those members — a number
////     demanded before every session is not a neutral prompt. Jérémy, 31.08:
////     *"le poids ça peut être un problème pour les gens, donc mettre ça au
////     second plan et pas au premier"*. So the ask is OPT-IN (weighInEvery),
////     and startFlow consults shouldAskWeighIn instead of always opening it.
////
////   * the third button used to read "Choose a different workout" and NAVIGATE
////     away. The club reported it on 31.08: *"il y a un texte pour fermer mais
////     ce n'est pas clair que ça ferme"*. It now says it cancels, and it does
////     nothing but close.
////
//// WHY A STATIC CHECK **AS WELL AS** the mounted test in
//// src/sheets.weighin.test.jsx — the mounted test is the primary guard, and it
//// does fail on the exact bug that shipped. This one covers what mounting
//// cannot see:
////
////   * `startFlow` is the CALLER of the sheet. A test that mounts the sheet
////     proves the sheet behaves; it says nothing about whether anybody still
////     asks shouldAskWeighIn before opening it. Upstream's version opens it
////     unconditionally, and that revert leaves every mounted test green.
////   * a default value in DEF, which no rendered screen reads directly.
////
//// Cheap, textual, and it names the regression it found rather than leaving
//// somebody to read a diff.

import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const src = readFileSync(join(root, 'src/sheets.jsx'), 'utf8')
const store = readFileSync(join(root, 'src/store/useStore.js'), 'utf8')

const problems = []

// 1. The ask stays conditional. `startFlow` must consult shouldAskWeighIn and
//    start the workout directly when it says no.
const startFlow = src.match(/export function startFlow\s*\([^)]*\)\s*\{([\s\S]*?)\n\}/)
if (!startFlow) {
  problems.push('startFlow() not found in sheets.jsx — did a merge rename or drop it?')
} else {
  const body = startFlow[1]
  if (!body.includes('shouldAskWeighIn')) {
    problems.push(
      'startFlow() no longer calls shouldAskWeighIn() — the weigh-in is being asked ' +
      'unconditionally again, which is upstream behaviour we deliberately reversed.'
    )
  }
  if (!/return beginWorkout\(/.test(body)) {
    problems.push(
      'startFlow() no longer starts the workout directly when no weigh-in is due — ' +
      'tapping Start must start the workout, not open a sheet.'
    )
  }
}

// 2. The default leaves people alone.
if (!/weighInEvery:\s*'never'/.test(store)) {
  problems.push(
    "DEF.weighInEvery is no longer 'never' in useStore.js — the journal would start " +
    'asking every member for their weight again by default.'
  )
}

// 3. The cancel button exists, and cancels: it must not navigate and must not
//    hand a null weight to onDone (that is the OTHER button, which starts the
//    workout without weighing in).
//
//    Anchored BACKWARDS from the label rather than forwards from `onClick={`:
//    the handler can carry nested braces (`{ close(); nav('/x') }`), so a
//    forward `[^}]*` stops at the first inner brace and reports the button as
//    MISSING when it is right there with the wrong handler. That is the exact
//    regression this check exists for, and it would have named it wrong.
const label = src.indexOf("t('Cancel — don’t start yet')")
if (label === -1) {
  problems.push(
    "The 'Cancel — don't start yet' button is gone from the weigh-in sheet. It is the " +
    'only control on that sheet that closes it without starting a workout; the club ' +
    'asked for it explicitly.'
  )
} else {
  // The JSX between the element's onClick and its label — enough to read the
  // handler, short enough not to swallow the previous button.
  const window_ = src.slice(Math.max(0, label - 240), label)
  const at = window_.lastIndexOf('onClick=')
  const handler = at === -1 ? '' : window_.slice(at)
  if (at === -1) problems.push('The cancel button has no onClick handler.')
  if (handler.includes('nav(')) {
    problems.push(
      'The cancel button navigates. Cancelling must leave the member on the screen they ' +
      'were on — someone who tapped Start from Home and changed their mind should not be ' +
      'moved to another screen.'
    )
  }
  if (handler.includes('onDone')) {
    problems.push(
      'The cancel button calls onDone — that starts the workout. Cancel must only close.'
    )
  }
  if (!handler.includes('close(')) {
    problems.push('The cancel button no longer closes the sheet.')
  }
}

if (problems.length) {
  console.error('✗ weigh-in sheet check failed:\n')
  for (const p of problems) console.error('  • ' + p + '\n')
  process.exit(1)
}
console.log('✓ weigh-in sheet: opt-in ask, direct start, cancel that only cancels')
