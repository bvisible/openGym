//// Neoffice — added file (no upstream equivalent).
//// The club's own names of the exercises, laid over upstream's generated pack of the same language, in ONE place so
//// the loader (lib/i18n.js setLang) and the tests agree on what the journal actually shows.
////
//// Upstream's generated pack (exercise-names/<lang>.js, scripts/catalogue/build.mjs) is lower-case, like the English
//// names it stores; a language we write in sentence case (CASED_NAME_LANGS in lib/i18n-core.js: German by nature, French
//// by our choice) must carry its casing in the names themselves, because no CSS class raises them. So the generated
//// names get their first letter raised here, and the club's names (club-names/<lang>.js) win over them, exercise by
//// exercise: the ones the clubs already know do not move, and a name added later is still named.

const raise = name => (typeof name === 'string' && name ? name.charAt(0).toLocaleUpperCase() + name.slice(1) : name)

export function layClubNames(generated, club) {
  const out = {}
  for (const [id, name] of Object.entries(generated || {})) out[id] = raise(name)
  return { ...out, ...(club || {}) }
}
