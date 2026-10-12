//// Neoffice — added file (no upstream equivalent).
//// What the translation tools check before a translated text reaches a pack: the answers must match the batch they
//// answer, and a French step that speaks to the member as « tu » is flagged (without finding « tes » in « côtes »).
import { describe, expect, it } from 'vitest'
import { checkAnswers, packSource } from './translation-merge.mjs'
import { gaps } from './translation-batches.mjs'

const stepRows = [
  { id: '1', name: 'Rowing', en: ['Pull the bar.', 'Lower it slowly.'] },
  { id: '2', name: 'Pompe', en: ['Push up for 20-30 seconds.'] },
]

describe('checkAnswers on steps', () => {
  it('accepts a list per exercise with the English count, and straightens the apostrophes', () => {
    const { texts, hard, soft } = checkAnswers('steps', stepRows, {
      1: ['Tirez la barre vers l’abdomen.', 'Redescendez lentement.'],
      2: ['Poussez pendant 20-30 secondes.'],
    })
    expect(hard).toEqual([])
    expect(soft).toEqual([])
    expect(texts['1'][0]).toBe("Tirez la barre vers l'abdomen.")
  })

  it('refuses a missing exercise, an extra one, a different count and an empty step', () => {
    const { hard } = checkAnswers('steps', stepRows, { 1: ['Tirez la barre.'], 3: ['Hors lot.'], 2: ['  '] })
    expect(hard).toEqual(expect.arrayContaining(['3: not in the batch', '1: 1 steps for 2', '2: empty']))
  })

  it('refuses an answer that is not a list of strings', () => {
    expect(checkAnswers('steps', stepRows, { 1: 'Tirez la barre.', 2: ['Poussez.'] }).hard).toContain('1: not a list of strings')
  })

  it('flags the informal « tu » but not the « tes » of « côtes » or the « te » of « tête »', () => {
    const { soft } = checkAnswers('steps', [{ id: '1', name: 'x', en: ['a', 'b', 'c'] }], {
      1: ['Tiens ton dos droit.', 'Serrez les côtes et gardez la tête haute.', "Tiens-toi droit, t'appuyant au mur."],
    })
    expect(soft.filter(s => s.includes('second person')).map(s => s.slice(0, 2))).toEqual(['1:', '1:'])
    expect(soft.some(s => s.includes('côtes'))).toBe(false)
  })

  it('flags a text left as it was, and numbers that changed', () => {
    const { soft } = checkAnswers('steps', [{ id: '1', name: 'x', en: ['Hold for 30 seconds.', 'Rest.'] }], { 1: ['Maintenez 20 secondes.', 'Rest.'] })
    expect(soft).toEqual(expect.arrayContaining(['1: numbers changed: Maintenez 20 secondes.', '1: identical to the English']))
  })
})

describe('checkAnswers on descriptions', () => {
  const rows = [{ id: '1', name: 'Curl', en: 'A biceps curl with dumbbells.' }]

  it('takes one string per exercise', () => {
    expect(checkAnswers('desc', rows, { 1: 'Un curl biceps aux haltères.' }).texts).toEqual({ 1: 'Un curl biceps aux haltères.' })
  })

  it('refuses a line break', () => {
    expect(checkAnswers('desc', rows, { 1: 'Un curl\nbiceps.' }).hard).toContain('1: line break')
  })
})

describe('packSource', () => {
  it('writes the entries in the English pack\'s order and leaves out an id the English pack does not have', () => {
    // Ids with a leading zero (« 0005 ») are string keys, which keep their insertion order; plain integers would be sorted by the engine.
    const source = packSource('// header', { '07': ['a'], '03': ['b'], '05': ['c'] }, { '05': ['cinq'], '07': ['sept'], '99': ['hors catalogue'] })
    expect(source).toBe('// header\nexport default {"07":["sept"],"05":["cinq"]}\n')
  })
})

describe('gaps', () => {
  it('lists the exercises with no translation, numerically, each with its displayed name', () => {
    const work = gaps({
      enSteps: { 10: ['a'], 2: ['b'], 3: ['c'] },
      steps: { 3: ['déjà'] },
      enDesc: { 10: 'x', 2: 'y' },
      desc: {},
      names: { 2: 'Deux' },
      englishNames: { 10: 'ten' },
    })
    expect(work.steps.map(r => [r.id, r.name])).toEqual([['2', 'Deux'], ['10', 'ten']])
    expect(work.desc.map(r => r.id)).toEqual(['2', '10'])
  })
})
