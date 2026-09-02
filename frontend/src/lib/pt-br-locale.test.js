import { describe, expect, test } from 'vitest'
import { createHash } from 'node:crypto'
import pt from '../locales/pt.js'
import ptBR, { PT_BR_OVERRIDES } from '../locales/pt-BR.js'
import { DATE_LOCALES, LANGS } from './i18n-core.js'

const placeholders = value => [...String(value).matchAll(/\{\d+\}/g)].map(match => match[0]).sort()
const byCodeUnit = ([a], [b]) => (a < b ? -1 : a > b ? 1 : 0)

describe('Brazilian Portuguese locale', () => {
  test('is a separately selectable locale with Brazilian date formatting', () => {
    expect(LANGS.pt).toBe('Português (Portugal)')
    expect(LANGS['pt-BR']).toBe('Português (Brasil)')
    expect(DATE_LOCALES['pt-BR']).toBe('pt-BR')
  })

  test('matches the source key set and preserves interpolation placeholders', () => {
    expect(Object.keys(ptBR).sort()).toEqual(Object.keys(pt).sort())
    for (const [source, translated] of Object.entries(ptBR)) {
      expect(placeholders(translated), source).toEqual(placeholders(source))
    }
  })

  test('makes every inherited pt-PT value an explicit reviewed snapshot', () => {
    const inherited = Object.entries(pt)
      .filter(([key]) => !(key in PT_BR_OVERRIDES))
      .sort(byCodeUnit)
    const fingerprint = createHash('sha256').update(JSON.stringify(inherited)).digest('hex')

    //// Neoffice — our numbers are higher than upstream's because our own
    //// strings live in pt.js like every other locale, and pt-BR inherits them.
    //// The guarantee this test exists for is untouched: a pt-PT wording that
    //// changes without review still breaks the hash. Recomputed after the
    //// v1.2.14 merge, whose new strings land in the inherited set.
    //// Recompute with: node scripts/pt-br-inheritance-fingerprint.mjs
//// Recomputed 31.08 for the seven accessibility labels: five are identical
//// on both sides and stay inherited, "Next week"/"Next month" became
//// pt-BR overrides ("próxima/próximo" rather than pt-PT's "seguinte").
//// Recomputed again for the exercise level filter: four inherited, two
//// overridden — "A mostrar" is the European progressive (Brazil uses the
//// gerund) and "convém" is stiff there next to "combina comigo".
//// Recomputed for the editing sheet: all five strings are identical on both
//// sides ("Subir", "Descer", "Editar a sessão"…) and stay inherited.
//// Recomputed for "Método de intensificação" — the client asked for the
//// full phrase rather than "Intensificador", and it reads the same in
//// Brazil.
//// Recomputed for the session outline: three inherited, "em curso" became
//// an override ("em andamento" is what Brazil says of something running).
//// Recomputed for the add-to-home-screen card: seven overrides ("tela" for
//// "ecrã", "aplicativo" for "aplicação", "Compartilhar" for "Partilhar" —
//// the words the phone's own menus use in Brazil), four inherited.
//// Recomputed for the password eye: two overrides ("senha", never Portugal's
//// "palavra-passe").
//// Recomputed for the 3-2-1 count: "Prepare-se" and "Toque para começar já"
//// read the same on both sides and stay inherited.
    expect(Object.keys(PT_BR_OVERRIDES)).toHaveLength(360)
    expect(inherited).toHaveLength(705)
    // If this fails, review the changed keys and wording before accepting a new hash. From
    // frontend/: node scripts/pt-br-inheritance-fingerprint.mjs --list
    expect(fingerprint, 'pt-PT inheritance changed; review the inherited pt-BR wording').toBe('b8cbb5cbb9503ba3257626ced74b71e6eea06135f62b4d30c84536def969266d')
  })

  test('does not leak European Portuguese UI terms', () => {
    const text = Object.values(ptBR).join('\n')
    const europeanPortuguese = /(?:^|[^\p{L}])(?:ficheiro\p{L}*|telemóvel\p{L}*|ecrã\p{L}*|regist(?:o|am|ado|ada|ados|adas)|eliminad\p{L}*|definições|cronómetro|detetad\p{L}*|gémeos|abdómen|anca|coifa dos rotadores|escadora|completaste|acabaste|aguentas|definires|completares|aguenta|aguentaste|ficaste|viajares)(?=$|[^\p{L}])/iu
    expect(text).not.toMatch(europeanPortuguese)
    expect(text).not.toMatch(/[«»]/u)
    expect(ptBR.Save).toBe('Salvar')
    expect(ptBR.Settings).toBe('Configurações')
    expect(ptBR['Delete workout']).toBe('Excluir treino')
    expect(ptBR.Superset).toBe('Superset')
    expect(ptBR['Guest mode — data lives only in this browser.']).toContain('visitante')
    expect(ptBR['Sign in with passkey']).toContain('chave de acesso')
    expect(ptBR.band).toBe('elástico')
    expect(ptBR['resistance band']).toBe('faixa elástica')
    expect(ptBR.soleus).toBe('sóleo')
    expect(ptBR.Unpair).toBe('Desvincular')
    expect(ptBR['Starter plan loaded — Mon Push · Wed Pull · Fri Legs']).toContain('Seg Push · Qua Pull')
  })
})
