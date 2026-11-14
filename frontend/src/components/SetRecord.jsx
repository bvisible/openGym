import Icon from './Icon.jsx'
import { t } from '../lib/i18n.js'
import { recordHintText } from '../lib/set-records.js'
//// Neoffice — below the Normal level a record never names the estimated max (lib/level-visibility.js showsEstimated1RM, the pilot
//// club's « trop technique »): the « Best e1RM » kind is left out of the words, the other kinds of the same set still say it.
import { useStore } from '../store/useStore.js'
import { showsEstimated1RM } from '../lib/level-visibility.js'
const plainKinds = (S, kinds) => (showsEstimated1RM(S) ? kinds : (kinds || []).filter(k => k !== 'e1rm'))

// The record marks of lib/set-records.js, in the workout, in History and on the day's workout.
// A record is said in words, not only with the trophy, so each kind reads as the claim it is.

/** The words for one record kind. On an assistance machine the load is help, so less is more. */
export function recordKindLabel(kind, assisted = false) {
  if (kind === 'weight') return assisted ? t('Least help yet') : t('Heaviest yet')
  if (kind === 'reps') return assisted ? t('Most reps with this help') : t('Most reps at this weight')
  if (kind === 'e1rm') return t('Best e1RM')
  if (kind === 'volume') return t('Biggest set')
  return ''
}
export const recordKindsText = (kinds, assisted) => (kinds || []).map(k => recordKindLabel(k, assisted)).filter(Boolean).join(' · ')

/** Under a set row: the trophy and what kind of record the set just set. */
export function RecordMark({ kinds, assisted }) {
  //// Neoffice — the member's level decides whether « Best e1RM » is said (plainKinds, above).
  const S = useStore(s => s.S)
  const text = recordKindsText(plainKinds(S, kinds), assisted)
  if (!text) return null
  return <div className="setrec" role="status">
    <Icon name="trophy" /><span><b>{t('Record!')}</b> {text}</span>
  </div>
}

/** After a set in History or the day view: a small trophy with the kinds as its name. */
export function RecordBadge({ kinds, assisted }) {
  //// Neoffice — the member's level decides whether « Best e1RM » is said (plainKinds, above).
  const S = useStore(s => s.S)
  const text = recordKindsText(plainKinds(S, kinds), assisted)
  if (!text) return null
  return <span className="setrec-mark" role="img" aria-label={t('Record: {0}', text)} title={text}><Icon name="trophy" /></span>
}

export { recordHintText }

/** Under the next open set: how close it is to a record, quietly. */
export function RecordHintLine({ hint }) {
  const text = recordHintText(hint)
  if (!text) return null
  return <div className="setrec-hint"><Icon name="chartLine" /><span>{text}</span></div>
}
