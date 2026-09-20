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
//// Recomputed for the membership gate's 17 strings (terms, signature, renewal,
//// invoice): all stay inherited, none needed a pt-BR override.
//// Recomputed for the rename-an-exercise, rest-per-exercise and floor-plan
//// strings (16 new keys): all stay inherited, none needed a pt-BR override.
//// Recomputed after the upstream v1.3.5 merge (2026-09-09), then once more for the
//// coach questionnaire's 15 subtitles (three of them Brazilian overrides): upstream rewrote most
//// of its pt-BR pack as explicit overrides (631 of theirs), and its new strings
//// land in the inherited set; our own 24 overrides ride along.
//// Recomputed after the upstream v1.3.7 merge (2026-09-17): upstream's v1.3.6
//// pt-BR block (sign-in adoption, offline banner, progression step) adds 13
//// overrides — 669 with ours — and the rest of its new strings inherit pt-PT.
//// Recomputed for "My membership" (30 new keys): 12 are Brazilian overrides —
//// "recepção" for Portugal's "receção", "aplicativo" for "aplicação",
//// "inscrição" and "você" where pt-PT says "assinatura" and "tu" — and the
//// other 18 (the invoice words, the billing intervals) read the same on both
//// sides and stay inherited.
//// Recomputed for paying an invoice (6 new keys): 3 overrides — Brazil says
//// "com você" and "em instantes" where Portugal says "consigo" and "dentro de
//// momentos" — and "Fatura {0}" / "Pagar {0}" read the same on both sides.
//// Recomputed for renewing from the app (5 new keys): 3 overrides — Brazil
//// dates things "em 5 de outubro" where Portugal says "a 5 de outubro", and
//// the European clitic "se não o renovar" is not how Brazil says it.
//// Recomputed for "settle it when the invoice reaches you": Brazil says it
//// the same way Portugal does, so it inherits.
//// Recomputed for stopping a renewal (4 new keys): 2 overrides — Brazil says
//// "Cancelar a renovação" where Portugal says "Parar", and spells the way
//// back "Voltar a renovar automaticamente".
//// Recomputed for the club's AI switches (1 new key): "O seu clube" is the
//// European form, but this file already overrides that turn of phrase where
//// it matters, and the sentence itself reads the same in Brazil.
//// Recomputed for explaining an exercise and writing to the coach (14 new
//// keys): 9 overrides — pt.js runs the informal tu/te/ti forms and the EU
//// progressive "está a + infinitive" through this whole feature, so Brazil's
//// você + 3rd-person conjugation and gerund apply throughout, along with the
//// "contactar"/"contatar" and "momentos"/"instantes" EU/BR spelling and word
//// choice — and the other 5 (three person-neutral infinitives, two
//// statements with no 2nd-person marking) read the same on both sides.
    expect(Object.keys(PT_BR_OVERRIDES)).toHaveLength(698)
    expect(inherited).toHaveLength(964)
    // If this fails, review the changed keys and wording before accepting a new hash. From
    // frontend/: node scripts/pt-br-inheritance-fingerprint.mjs --list
    expect(fingerprint, 'pt-PT inheritance changed; review the inherited pt-BR wording').toBe('4077694350470edaa812cbc79152dd697b0959e078ddaffea5f08d7f4f622a3e')
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
    expect(ptBR['Choose starter plan']).toBe('Escolha um plano inicial')
  })
})
