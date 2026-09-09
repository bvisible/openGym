//// Neoffice — added file (no upstream equivalent).
//// How much of the journal is shown — simple, normal or full. Pure functions of
//// the state: the member's own choice (S.level), else the club's default carried
//// in S.perms.defaultLevel, else 'full' (upstream's whole screen).

export const LEVELS = ['simple', 'normal', 'full']

export const levelOf = S => {
  const chosen = (S && S.level) || (S && S.perms && S.perms.defaultLevel)
  return LEVELS.includes(chosen) ? chosen : 'full'
}
export const isSimple = S => levelOf(S) === 'simple'
//// "at least this much": a check for the full level must not accidentally pass
//// at normal, and a check for normal must pass at full. Comparing rank rather
//// than string equality is what keeps that true when a level is added.
export const atLeast = (S, level) => LEVELS.indexOf(levelOf(S)) >= LEVELS.indexOf(level)
