//// Neoffice — added file (no upstream equivalent).
////
//// The full-screen 3-2-1 before a timed set. State and ticking live in
//// useUI (startWorkWithPrep); this only draws the number, big enough to be
//// read from the floor, and turns a tap anywhere into "start now".
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'

export default function PrepCountdown() {
  const prep = useUI(s => s.prep)
  const { skipPrep, cancelPrep } = useUI()
  if (!prep) return null
  return (
    <div className="prep" role="dialog" aria-live="assertive" onClick={skipPrep}>
      {prep.label && <div className="prep-lbl">{prep.label}</div>}
      <div className="prep-n" key={prep.left}>{prep.left}</div>
      <div className="prep-hint">{t('Get ready')}</div>
      <div className="prep-sub">{t('Tap to start now')}</div>
      <button className="prep-cancel" onClick={e => { e.stopPropagation(); cancelPrep() }}>{t('Cancel')}</button>
    </div>
  )
}
