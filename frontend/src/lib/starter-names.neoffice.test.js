// @vitest-environment happy-dom
//// Neoffice — added file (no upstream equivalent). A routine loaded from a starter plan is named in the journal's language
//// (neoffice-maintenance#2705): a French member loading « Corps entier » got « Full Body A / B / C », in English.
import { afterAll, describe, expect, it } from 'vitest'
import { setLang } from './i18n.js'
import { buildStarterPlan, starterPlanOptions } from './starter.js'
import { STARTER_PLANS, AWAY_PLANS } from '../../../api/coach/core/starter-plans.js'

afterAll(() => setLang('en'))

const everyName = () => {
  const names = new Set()
  for (const plans of [STARTER_PLANS, AWAY_PLANS]) for (const p of Object.values(plans)) for (const r of p.routines || []) names.add(r[1])
  return [...names]
}

describe('a starter plan’s routines', () => {
  it('keep the catalogue’s names in English', async () => {
    await setLang('en')
    expect(buildStarterPlan('full-body').routines.map(r => r.name)).toEqual(['Full Body A', 'Full Body B', 'Full Body C'])
  })

  it('are named in French in a French journal, every plan of the chooser', async () => {
    await setLang('fr')
    expect(buildStarterPlan('full-body').routines.map(r => r.name)).toEqual(['Corps entier A', 'Corps entier B', 'Corps entier C'])
    const english = new Set(everyName())
    for (const { id } of starterPlanOptions()) {
      for (const r of buildStarterPlan(id).routines) {
        // « 5×5 A » reads the same in French; every other name is translated
        if (!r.name.startsWith('5×5')) expect(english.has(r.name), `${id}: « ${r.name} »`).toBe(false)
      }
    }
  })
})
