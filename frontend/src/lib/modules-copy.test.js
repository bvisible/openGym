import { describe, expect, it } from 'vitest'
import { MODULES, GROUPS, PRESETS } from './modules.js'
import { moduleCopy, groupCopy, presetCopy } from './modules-copy.js'

describe('modules-copy', () => {
  it('says in t() exactly the English modules.js keeps (the search matches on it)', () => {
    const m = moduleCopy(), g = groupCopy(), p = presetCopy()
    for (const x of MODULES) expect(m[x.id]).toEqual([x.title, x.desc])
    for (const x of GROUPS) expect(g[x.id]).toBe(x.title)
    for (const x of PRESETS) expect(p[x.id]).toEqual([x.title, x.desc])
    //// Neoffice — modules-copy.js keeps upstream's twelve entries; the page lists the ten that exist here (lib/modules.js NOT_HERE).
    expect(Object.keys(m).length).toBeGreaterThanOrEqual(MODULES.length)
  })
})
