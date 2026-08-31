//// Neoffice — added file (no upstream equivalent).
////
//// "Partager ma séance" — the member ticks what appears, then gets an image.
////
//// Jérémy chose this shape on 2026-08-31, over a fixed card: *"le membre
//// choisit quoi montrer"*. It costs a screen, and it buys the only thing that
//// matters here — nobody publishes a number they did not mean to publish.
////
//// What is NOT optional: the club's name and logo. The whole point of this
//// feature, in the client's own framing, is that the member advertises the
//// club. A card without the club advertises nothing.
////
//// Defaults are deliberately MODEST: duration and exercises, the two a
//// beginner can post without comparing themselves to anyone. Volume, sets and
//// records are there for whoever wants them, unticked.

import { useState } from 'react'
import { drawShareCard, shareCard } from '../lib/share-card.js'
import { t } from '../lib/i18n.js'
import { Button } from './ui.jsx'
import Icon from './Icon.jsx'

const DEFAULT_PICKED = ['duration', 'exercises']

export default function ShareWorkout({ workout, club, unit, close }) {
  const [picked, setPicked] = useState(new Set(DEFAULT_PICKED))
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(null)

  const toggle = (key) => setPicked(prev => {
    const next = new Set(prev)
    next.has(key) ? next.delete(key) : next.add(key)
    return next
  })

  // Only offer what this session actually has: a checkbox for "0 record" is a
  // box that can only disappoint.
  const rows = [
    ['duration', t('Duration'), workout.duration],
    ['exercises', t('Exercises'), workout.exercises],
    ['volume', t('Weight moved'), workout.volume],
    ['sets', t('Sets'), workout.sets],
    ['records', t('Personal records'), workout.records],
  ].filter(([, , value]) => value)

  const go = async () => {
    setBusy(true)
    try {
      const blob = await drawShareCard({
        workout, club, picked, unit,
        labels: {
          done: t('Session done'), duration: t('Duration'), exercises: t('Exercises'),
          volume: t('Weight moved'), sets: t('Sets'), records: t('Records'),
        },
      })
      const how = await shareCard(blob, 'seance.png', club && club.name ? club.name : '')
      setDone(how)
      if (how === 'shared') close && close()
    } catch (e) {
      setDone('failed')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <h3>{t('Share this session')}</h3>
    <div className="muted small" style={{ marginBottom: 12 }}>
      {t('You choose what appears. The club’s name and logo are always on it.')}
    </div>

    {rows.length === 0
      ? <div className="empty">{t('Nothing to show from this session yet.')}</div>
      : rows.map(([key, label, value]) => (
        <div key={key} className="item" onClick={() => toggle(key)}>
          <div className="grow"><div className="tt">{label}</div><div className="ss">{value}</div></div>
          <Icon name={picked.has(key) ? 'checkCircle' : 'dot'}
                className={picked.has(key) ? 'accent' : 'dim'} />
        </div>
      ))}

    <Button variant="primary" icon="link" disabled={busy} onClick={go} style={{ marginTop: 14 }}>
      {busy ? t('Preparing…') : t('Share')}
    </Button>

    {/* //// A download is not a failure, and neither is changing your mind —
        //// but a member who tapped Share and saw nothing happen needs to be
        //// told where the image went. */}
    {done === 'downloaded' && <div className="small dim" style={{ marginTop: 8 }}>
      {t('The image was saved to your device.')}</div>}
    {done === 'failed' && <div className="small" style={{ marginTop: 8, color: 'var(--red)' }}>
      {t('The image could not be created. Try again.')}</div>}
  </>
}
