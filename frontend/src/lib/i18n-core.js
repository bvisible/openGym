// Runtime-agnostic core of the i18n module: state, constants and readers (t, dateLocale,
// instrFor, exerciseNameFor, getLang). Plain Node-loadable — the browser-only pieces
// (import.meta.glob lazy
// loads, the React subscription hook) live in i18n.js and re-export from here.

export const LANGS = {
  en: 'English', de: 'Deutsch', 'de-CH': 'Deutsch (Schweiz)', es: 'Español', fr: 'Français',
  it: 'Italiano', pt: 'Português (Portugal)', 'pt-BR': 'Português (Brasil)', pl: 'Polski',
  tr: 'Türkçe', ru: 'Русский', uk: 'Українська', zh: '中文',
  ko: '한국어', hi: 'हिन्दी', th: 'ไทย', hu: 'Magyar', ar: 'العربية'
}
export const INSTR_LANGS = ['en', 'es', 'fr', 'it', 'tr', 'ru', 'zh', 'hi', 'pl', 'ko', 'pt-BR', 'hu', 'ar']
//// Neoffice — 'fr' is upstream's too since v1.3.9, but the pack behind it
//// (src/exercise-names/fr.js) is OURS: 1,324 names in a gym's words, kept at
//// the v1.3.9 merge instead of upstream's generated list. Same shape, same
//// mechanism, so nothing else had to change.
export const EXERCISE_NAME_LANGS = ['pt-BR', 'hu', 'de', 'es', 'ru', 'it', 'fr']
// Languages rendered right-to-left; i18n.js setLang applies the direction from this.
export const RTL_LANGS = new Set(['ar'])
export const DATE_LOCALES = {
  en: 'en-GB', de: 'de-DE', 'de-CH': 'de-CH', es: 'es-ES', fr: 'fr-FR', it: 'it-IT',
  pt: 'pt-PT', 'pt-BR': 'pt-BR',
  pl: 'pl-PL', tr: 'tr-TR', ru: 'ru-RU', uk: 'uk-UA', zh: 'zh-CN', ko: 'ko-KR', hi: 'hi-IN', th: 'th-TH', hu: 'hu-HU', ar: 'ar-u-nu-latn'
}

// Locales derived from another language by a pure text transform rather than carried as their
// own pack. Swiss Standard German has no ß — every one is written ss — so de-CH is de with a
// single substitution. Deriving it keeps one German source of truth: a hand-maintained de-CH
// would be 98.7% identical to de.js (16 of 1265 values differ), and check-locales.mjs would
// then require every future German string to be written twice, forever.
//
// The transform is exact in this direction ONLY. Going back needs vowel length — "Maße" and
// "Masse" both collapse to "Masse" — so de is always the base and never the derivative.
//
// Note this covers orthography, not vocabulary: a Swiss-specific word choice (Velo for
// Fahrrad) would need a real pack. None of the current strings contain one.
export const DERIVED_LOCALES = {
  'de-CH': { base: 'de', transform: s => s.replace(/ß/g, 'ss') }
}

// The language whose packs a locale actually loads: a derived locale reads its base's, every
// other language its own. Used for the INSTR_LANGS/EXERCISE_NAME_LANGS membership tests too,
// so de-CH gains instructions and exercise names exactly when de does, with no second entry
// to remember to add.
export const baseLang = l => DERIVED_LOCALES[l]?.base || l

// Applies a derived locale's transform to a loaded pack, returning it unchanged for a language
// that is not derived. Packs are trees of strings: the locale pack is flat { source: target },
// instruction packs are { exId: [steps] }, exercise-name packs { exId: name }.
export function derivePack(l, pack) {
  const transform = DERIVED_LOCALES[l]?.transform
  if (!transform || !pack) return pack
  const walk = v =>
    typeof v === 'string' ? transform(v)
      : Array.isArray(v) ? v.map(walk)
        : v && typeof v === 'object'
          ? Object.fromEntries(Object.entries(v).map(([k, inner]) => [k, walk(inner)]))
          : v
  return walk(pack)
}

let lang = 'en'                 // set only by _setLangState, called from i18n.js setLang
let dict = {}                   // current locale pack (empty = English fallback)
let instr = null                // { exId: [steps] } for the current language, null = English
let exerciseNames = null        // { exId: translated name }, null = original catalogue name
let enParens = true               // whether translated names show the English original in parentheses
let enOnly = false                // whether translated names are replaced entirely by the English original
let version = 0                 // bumped on every setLang; drives the React subscription selector

export const getLang = () => lang
export const dateLocale = () => DATE_LOCALES[lang] || 'en-GB'
export const getVersion = () => version

// Translate a source string; {0},{1}… are replaced with args (also on the English fallback).
export function t(s, ...args) {
  let v = dict[s] || s
  for (let i = 0; i < args.length; i++) v = v.replaceAll('{' + i + '}', args[i])
  return v
}

// Instructions for an exercise in the current language (English steps as fallback).
export const instrFor = ex => (instr && instr[ex.id]) || ex.st || []

// Built-in catalogue names are bilingual when a translated name pack is active. A pack need not
// be complete: German covers the equipment exercises and not the body-weight ones, and an
// exercise the pack has no entry for keeps its English title, one exercise at a time.
// User-created exercises have no entry in the pack and keep their exact chosen name.
//// Neoffice — the member's own names for exercises ("Épaules" for a dip they
//// never call a dip), and the display names a coach gives in a programme. Set
//// from the store (S.exAliases) on every persist; an alias wins over every
//// catalogue name, on every screen. Asked by the pilot club, 2026-09-09.
let aliases = {}
let aliasesKey = ''
let aliasVersion = 0
//// The search corpus (lib/exercises.js) is cached per exercise and keyed on
//// the language version; a rename must move that key too, or the member
//// searches their new name and finds nothing until the next launch (seen on
//// osiris, 2026-09-09). Same map, same key: persist() calls this on every
//// state change and must not flush ~1300 cached entries each time.
export function setExerciseAliases(map) {
  const next = map || {}
  const key = JSON.stringify(next)
  if (key === aliasesKey) return
  aliases = next
  aliasesKey = key
  aliasVersion++
}
//// Neoffice — the CLUB's names for library exercises (#766: « que tous les
//// exercices portent le nom que je souhaite », per club, kept by every
//// catalogue update). They arrive with the state (S.clubNames, composed by the
//// server, never pushed back) and sit UNDER the member's own aliases and OVER
//// the pack: what the club calls an exercise is its name here, unless the
//// member chose theirs. Same version counter, so caches follow a rename.
let clubNames = {}
let clubNamesKey = ''
export function setClubExerciseNames(map) {
  const next = map || {}
  const key = JSON.stringify(next)
  if (key === clubNamesKey) return
  clubNames = next
  clubNamesKey = key
  aliasVersion++
}
// What a cached name or search corpus must be keyed on: the language AND the
// member's own names. A string, so two counters never collide.
export const getNamesVersion = () => version + '.' + aliasVersion
export const exerciseAliasOf = id => (id && aliases[id]) || ''
export const exerciseNameFor = ex => {
  const alias = ex && aliases[ex.id]
  if (alias) return alias
  return catalogueNameFor(ex)
}
// The name without the member's alias — what the catalogue calls it.
//// Neoffice — or what the CLUB calls it, when it renamed it (#766).
export const catalogueNameFor = ex => {
  const club = ex && clubNames[ex.id]
  if (club) return club
  // A language that chose "English names only" sees the canonical catalogue title, not the
  // translation — and never the parenthetical either. Custom exercises keep their exact name.
  if (enOnly) return ex?.n || ''
  const translated = exerciseNames && ex && exerciseNames[ex.id]
  if (!translated) return ex?.n || ''
  //// Neoffice — French shows the translated name ALONE by default (i18n.js setLang:
  //// `enParens` defaults to false for French, true elsewhere); since v1.3.9 a member
  //// can still ask for "translated (English)" in Settings. Why the default differs:
  //// the pt-BR pack is a partial catalogue where the English term is often the one
  //// a lifter actually says, so the bracket carries information. Our French pack
  //// covers all 1,324 names, and on a phone "Développé couché à la barre (Barbell
  //// Bench Press)" wraps onto two lines in every list, in the timer and on the
  //// printed plan. Nothing is lost: the SEARCH stays bilingual through
  //// exerciseNameSearchText() below, which is where knowing the English name helps.
  // Some names (Burpee, Pilates, brand/model terms) are the established term in the target
  // language too. Repeating an identical loanword in parentheses adds noise rather than
  // context. Compared in the active language's own casing rules, not hardcoded to one —
  // this only ever differs from ordinary casing for languages with locale-specific rules
  // (e.g. Turkish dotless i), which does not include any language shipped here today.
  return translated.toLocaleLowerCase(lang) === ex.n.toLocaleLowerCase('en')
      || !enParens
    ? translated
    : `${translated} (${ex.n})`
}

// Exercise-name packs written in the language's own casing. German capitalises its nouns and
// lower-cases the adjectives in front of them ("Assistiertes hängendes Knieheben"), which
// title-casing on top would undo. Every other pack is stored lower-case, the way EXDB stores
// the English names ("supino com barra"). Left without the title-casing English gets, those
// read all lower-case in every list, card and history row. A new pack goes here only when it
// carries real casing; i18n-core.test.js checks this list against the packs themselves.
//// Neoffice — 'fr' too: our French pack (src/exercise-names/fr.js, kept at the v1.3.9 merge) is
//// written in sentence case, the way a gym writes « Relevé de buste 3/4 ». Title-cased on top it
//// read « Relevé De Buste 3/4 »; upstream's own French pack is lower-case, ours is not.
export const CASED_NAME_LANGS = ['de', 'fr']

// EXDB stores English names lower-case and the UI title-cases them with CSS. A pack in
// CASED_NAME_LANGS carries its own casing and must not be cased again on top, so the class that
// does the title-casing stays off its translated names. A lower-case pack is title-cased like
// English. That is decided per exercise, not only per language: German covers only part of the
// catalogue, and an exercise it has no entry for shows its lower-case English title, which still
// needs the casing ("push-up" would otherwise sit between "Bankdrücken" and "Kniebeuge"). A custom
// exercise has no pack entry either and keeps the casing it always had, and so does every
// exercise while "English names only" is on, since exerciseNameFor then shows the English title.
// Callers spread this onto the element that holds exerciseNameFor(ex)'s output, nothing else —
// muscle and equipment labels next to it are t() strings and keep their own capitalize.
export const exerciseNameClass = ex => (!enOnly && exerciseNames && ex && exerciseNames[ex.id]
  && CASED_NAME_LANGS.includes(baseLang(lang)) ? '' : 'capitalize')

// Search both the localized and canonical English title without changing persisted data.
export const exerciseNameSearchText = ex => {
  const translated = exerciseNames && ex && exerciseNames[ex.id]
  const alias = ex && aliases[ex.id]
  //// Neoffice — the club's name is searched too, and the pack's still is (#766).
  const club = ex && clubNames[ex.id]
  const base = [club, translated ? `${translated} ${ex.n}` : (ex?.n || '')].filter(Boolean).join(' ')
  return alias ? `${alias} ${base}` : base
}

// Called by i18n.js's setLang once the locale pack has been loaded — kept here rather than
// exported as setLang because loading packs requires import.meta.glob, which is Vite-only.
// `dict`, `instr` and `exerciseNames` may be null to reset to their English fallbacks.
//// Neoffice — `showEn` defaults like lib/i18n.js setLang: names alone in French (see catalogueNameFor).
export function _setLangState(newLang, newDict, newInstr, newExerciseNames, showEn = baseLang(newLang || '') !== 'fr', enOnlyFlag = false) {
  lang = LANGS[newLang] ? newLang : 'en'
  dict = lang === 'en' ? {} : (newDict || {})
  instr = lang === 'en' || !INSTR_LANGS.includes(baseLang(lang)) ? null : (newInstr || null)
  exerciseNames = lang === 'en' || !EXERCISE_NAME_LANGS.includes(baseLang(lang))
    ? null
    : (newExerciseNames || null)
  enParens = !!showEn
  enOnly = !!enOnlyFlag
  version++
  return version
}
