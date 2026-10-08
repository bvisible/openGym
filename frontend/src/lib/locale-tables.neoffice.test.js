//// Neoffice — added file (no upstream equivalent). The strings a TABLE hands to t() at runtime
//// (`t(title)` over CATEGORY_TEXT, `t(MUSCLE_NAME[m])`, `t(DAYS[d])`…), which check-source-strings
//// cannot see: it collects t('literal') calls only. v1.3.10 reworded a line of the Coach's consent
//// screen and v1.3.9 had added a heading there, and no pack had either: the screen showed English in
//// every language while every check stayed green (seen in Chrome on 08.10). The same class as the
//// catalogue's body parts in locale-coverage.test.js; a table that comes to matter joins the list.
import { describe, expect, it } from 'vitest'
import { CATEGORY_TEXT } from './coach.js'
import { MUSCLE_NAME } from './muscles.js'
import { POLICY_NAME, POLICY_DESC } from './progression.js'
import { DAYN, DAYS } from './format.js'

const TABLES = {
  CATEGORY_TEXT: Object.values(CATEGORY_TEXT).flat(),
  MUSCLE_NAME: Object.values(MUSCLE_NAME),
  POLICY_NAME: Object.values(POLICY_NAME),
  POLICY_DESC: Object.values(POLICY_DESC),
  DAYN, DAYS,
}

describe('the strings tables hand to t() at runtime', () => {
  const packs = import.meta.glob('../locales/*.js', { eager: true, import: 'default' })

  it('are read from the tables themselves', () => {
    //: The consent screen's heading is the one no pack had: if this list stops carrying it, the
    //: test below proves nothing about it.
    expect(TABLES.CATEGORY_TEXT).toContain('A few preferences')
    for (const [name, strings] of Object.entries(TABLES)) expect(strings.length, name).toBeGreaterThan(0)
  })

  for (const [name, strings] of Object.entries(TABLES)) {
    it(`${name}: every string has a word in each pack`, () => {
      for (const [file, pack] of Object.entries(packs)) {
        const missing = strings.filter(k => typeof k === 'string' && (!Object.hasOwn(pack, k) || !String(pack[k]).trim()))
        expect(missing, file).toEqual([])
      }
    })
  }
})
