//// Neoffice — added file (no upstream equivalent).
//// Ces tests couvrent la seule chose que le coaching peut casser sans bruit :
//// une révision qui détruit des routines. Le reste (parsePlan/mergePlan) est
//// amont et testé amont — on ne le re-teste pas, on teste NOTRE couche.

import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { applyCoachProgram, removeProgramRoutines, countProgramRoutines } from './coach-program.js'

const bundle = (name, exIds, week) => ({
  opengym_plan: 1,
  name,
  routines: [{ id: 'r-' + name, name, ex: exIds.map(id => ({ id, sets: 3, reps: 8 })) }],
  week: week || {},
  customEx: []
})

const offer = (program, version, b, replaceSchedule = false) =>
  ({ id: 'GPA-1', program, version, bundle: b, replaceSchedule })

const emptyState = () => ({ routines: [], week: {}, customEx: [] })

describe('applyCoachProgram', () => {
  it('marks the routines it adds with the program and version', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].coachProgram).toBe('PROG-1')
    expect(s.routines[0].coachVersion).toBe(1)
  })

  it('leaves the member’s own routines completely alone', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    const mine = s.routines.find(r => r.id === 'mine')
    expect(mine).toBeTruthy()
    expect(mine.coachProgram).toBeUndefined()
  })

  it('replaces what an earlier version of the SAME program installed', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force v1', ['0001'])))
    const res = applyCoachProgram(s, offer('PROG-1', 2, bundle('Force v2', ['0002'])))
    expect(res.replaced).toBe(1)
    expect(s.routines).toHaveLength(1)
    expect(s.routines[0].name).toBe('Force v2')
    expect(s.routines[0].coachVersion).toBe(2)
  })

  it('does NOT touch routines from a different program', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'])))
    const res = applyCoachProgram(s, offer('PROG-2', 1, bundle('Cardio', ['0002'])))
    expect(res.replaced).toBe(0)
    expect(s.routines).toHaveLength(2)
  })

  it('clears a weekday left pointing at a routine it removed', () => {
    // The trap: v1 scheduled Monday, v2 does not replace the schedule. Without
    // the cleanup, Monday points at a routine that no longer exists and the
    // member taps Start on an empty session.
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force v1', ['0001'], { 1: 'r-Force v1' }), true))
    expect(s.week['1']).toBeTruthy()
    const stale = s.week['1']
    applyCoachProgram(s, offer('PROG-1', 2, bundle('Force v2', ['0002']), false))
    expect(s.week['1']).not.toBe(stale)
    expect(Object.values(s.week)).not.toContain(stale)
  })

  it('replaces the week when the coach said so', () => {
    const s = emptyState()
    s.week = { 3: 'mine' }
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'], { 1: 'r-Force' }), true))
    expect(s.week['3']).toBeUndefined()
    expect(s.week['1']).toBeTruthy()
  })

  it('keeps the member’s week when the coach did not', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    s.week = { 3: 'mine' }
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Force', ['0001'], { 1: 'r-Force' }), false))
    expect(s.week['3']).toBe('mine')
  })
})

describe('countProgramRoutines', () => {
  it('counts only the routines of that program', () => {
    const s = emptyState()
    applyCoachProgram(s, offer('PROG-1', 1, bundle('A', ['0001'])))
    applyCoachProgram(s, offer('PROG-2', 1, bundle('B', ['0002'])))
    expect(countProgramRoutines(s, 'PROG-1')).toBe(1)
    expect(countProgramRoutines(s, 'PROG-3')).toBe(0)
  })
})

describe('removeProgramRoutines', () => {
  it('is a no-op when the program installed nothing', () => {
    const s = emptyState()
    s.routines.push({ id: 'mine', name: 'Mon dos', ex: [] })
    expect(removeProgramRoutines(s, 'PROG-9')).toBe(0)
    expect(s.routines).toHaveLength(1)
  })
})

//// Neoffice — la périodisation.
//// Ce mécanisme peut se tromper SANS jamais lever d'erreur : une semaine 2 qui
//// pointe sur les routines de la semaine 1, un cycle qui repart au mauvais
//// moment, un planning reposé au milieu de la semaine et qui efface le jour
//// qu'un membre venait de déplacer. Rien de tout cela ne plante.

import { attachCycle, syncCycleWeek, cycleWeekOf } from './coach-program.js'

const cycleBundle = () => ({
  opengym_plan: 1,
  name: 'Cycle',
  routines: [
    { id: 'r-A', name: 'Semaine A', ex: [{ id: '0001', sets: 3, reps: 8 }] },
    { id: 'r-B', name: 'Semaine B', ex: [{ id: '0002', sets: 3, reps: 8 }] },
  ],
  week: { 1: 'r-A' },
  customEx: [],
  cycle: {
    span: 4,
    weeks: {
      1: { 1: 'r-A' },
      2: { 1: 'r-B' },
      3: { 1: 'r-A', 4: 'r-B' },
      4: { 1: 'r-B' },
    },
  },
})

const cycleOffer = (start) => ({
  id: 'GPA-C', program: 'PROG-C', version: 1,
  bundle: cycleBundle(), replaceSchedule: true, startDate: start,
})

describe('la périodisation', () => {
  it('retient le cycle et pose la semaine 1', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    expect(s.coachCycle).toBeTruthy()
    expect(s.coachCycle.span).toBe(4)
    expect(Object.keys(s.coachCycle.weeks)).toHaveLength(4)
  })

  it('la semaine 2 pointe sur les BONNES routines, pas sur celles du bundle', () => {
    // mergePlan donne des identifiants neufs. Si la correspondance était
    // perdue, la semaine 2 renverrait à « r-B », qui n'existe pas chez le membre.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    const ids = new Set(s.routines.map(r => r.id))
    Object.values(s.coachCycle.weeks).forEach(w =>
      Object.values(w).forEach(rid => expect(ids.has(rid)).toBe(true)))
  })

  it('avance de semaine en semaine, puis boucle', () => {
    const c = { span: 4, startedOn: '2026-08-24', weeks: {} }
    expect(cycleWeekOf(c, '2026-08-24')).toBe(1)
    expect(cycleWeekOf(c, '2026-08-30')).toBe(1)
    expect(cycleWeekOf(c, '2026-08-31')).toBe(2)
    expect(cycleWeekOf(c, '2026-09-21')).toBe(5 % 4 || 4)
    // Après quatre semaines, on repart à la première.
    expect(cycleWeekOf(c, '2026-09-21')).toBe(1)
  })

  it('avant le début, on est en semaine 1', () => {
    // Un programme daté de la semaine prochaine se prépare ; il ne doit pas
    // renvoyer à la fin du cycle précédent.
    const c = { span: 4, startedOn: '2026-09-01', weeks: {} }
    expect(cycleWeekOf(c, '2026-08-25')).toBe(1)
  })

  it('repose le planning quand la semaine CHANGE', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    const w1 = s.week['1']
    syncCycleWeek(s, '2026-08-31')
    expect(s.week['1']).not.toBe(w1)
  })

  it('ne repose RIEN tant qu’on reste dans la même semaine', () => {
    // C'est le test qui compte : reposer à chaque ouverture effacerait le jour
    // qu'un membre vient de déplacer, et il ne comprendrait pas pourquoi.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    s.week['3'] = s.routines[1].id      // le membre ajoute un mercredi
    syncCycleWeek(s, '2026-08-26')       // même semaine
    expect(s.week['3']).toBe(s.routines[1].id)
  })

  it('une semaine du cycle REMPLACE, elle ne complète pas', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    syncCycleWeek(s, '2026-09-07')       // semaine 3 : lundi + jeudi
    expect(Object.keys(s.week).sort()).toEqual(['1', '4'])
    syncCycleWeek(s, '2026-09-14')       // semaine 4 : lundi seul
    expect(Object.keys(s.week)).toEqual(['1'])
  })

  it('un programme SANS cycle n’en fabrique pas un', () => {
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, offer('PROG-1', 1, bundle('Simple', ['0001'])))
    expect(s.coachCycle).toBeUndefined()
  })

  it('une révision sans cycle efface celui de la version précédente', () => {
    // Sinon le calendrier de la v1 continuerait de tourner sous une v2 qui ne
    // demande qu'une semaine type — et le planning changerait tout seul sans
    // que rien ne l'explique.
    const s = { routines: [], week: {}, customEx: [] }
    applyCoachProgram(s, cycleOffer('2026-08-24'))
    expect(s.coachCycle).toBeTruthy()
    applyCoachProgram(s, { id: 'GPA-C', program: 'PROG-C', version: 2,
                           bundle: bundle('Simple', ['0001']), replaceSchedule: true })
    expect(s.coachCycle).toBeUndefined()
  })
})

//// Le cycle avance dans syncCycleWeek — mais encore faut-il que QUELQU'UN
//// l'appelle. Le défaut vécu : l'appel n'existait qu'au retour d'onglet, donc
//// un membre qui ouvre son carnet le lundi matin (l'app était fermée, aucun
//// visibilitychange ne se produit) restait sur la semaine passée. Ce test
//// garde le point d'accroche, que le prochain merge amont réécrive boot() ou
//// non : il tombe si l'appel disparaît, ce qu'aucun test de la fonction
//// elle-même ne peut voir.
describe('le point d’accroche du cycle', () => {
  const store = readFileSync(new URL('../store/useStore.js', import.meta.url), 'utf8')

  it('avance le cycle au DÉMARRAGE, pas seulement au retour d’onglet', () => {
    const boot = store.slice(store.indexOf('async boot()'))
    expect(boot.slice(0, boot.indexOf('async pullState()'))).toContain('advanceCycle()')
  })

  it('l’avance aussi au retour d’onglet', () => {
    const vis = store.slice(store.indexOf("addEventListener('visibilitychange'"))
    expect(vis.slice(0, 900)).toContain('advanceCycle()')
  })
})
