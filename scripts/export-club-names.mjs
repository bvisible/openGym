#!/usr/bin/env node
//// Neoffice — added file (no upstream equivalent).
// The exercise names of a language as the journal shows them (the club's own names laid over upstream's
// generated pack, lib/club-names.js), as one JSON object {exercise id: name} on the standard output.
// The club's server keeps a copy of the French ones (neoffice_gym/data/exercise_names_fr.json, read by its
// patches/fill_exercise_display_names.py): regenerate it after every upstream merge, and commit it THERE:
//
//   node scripts/export-club-names.mjs fr > ../neoffice_gym/neoffice_gym/data/exercise_names_fr.json
import { pathToFileURL } from 'node:url'
import { existsSync } from 'node:fs'
import { join, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'

const lang = process.argv[2] || 'fr'
const src = join(dirname(fileURLToPath(import.meta.url)), '..', 'frontend', 'src')
const load = async path => (await import(pathToFileURL(join(src, path)).href)).default
const { layClubNames } = await import(pathToFileURL(join(src, 'lib', 'club-names.js')).href)

const generated = await load(`exercise-names/${lang}.js`)
const club = existsSync(join(src, 'club-names', `${lang}.js`)) ? await load(`club-names/${lang}.js`) : {}
const merged = layClubNames(generated, club)
// Sorted by id, so that two runs of the same sources give the same bytes.
process.stdout.write(JSON.stringify(Object.fromEntries(Object.keys(merged).sort().map(id => [id, merged[id]]))))
