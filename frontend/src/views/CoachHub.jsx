//// Neoffice — added file (no upstream equivalent).
////
//// The « Coach » place of the bottom bar (the pilot club, 30.10: a coach place instead of the exercise one,
//// for writing to one's coach as well as for talking to Nora, who answers within what the club allows). Two doors on one screen, each drawn only when it exists:
////   - Nora, the club's assistant (lib/coach.js `coachAvailable`: the club switched her on): opens her chat, /coach. What she may do is the club's switches
////     (Gym Settings → BOOT.coach.can), which the chat itself enforces: this screen only says so, in the card.
////   - the member's own coach (views/CoachThread.jsx): a conversation in the logbook, reachable only when the coach has an account for messages.
//// The screen holds no conversation and no state of its own: both doors are routes that already exist.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { t } from '../lib/i18n.js'
import { myCoach } from '../lib/api.js'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import { useCoachDoors } from '../lib/use-coach-doors.js'
import Icon from '../components/Icon.jsx'
import { Button, Row, Section } from '../components/ui.jsx'

export default function CoachHub() {
  const nav = useNavigate()
  const doors = useCoachDoors()
  const [coach, setCoach] = useState(null)
  useEffect(() => {
    if (MOBILE || DEMO) return undefined
    let alive = true
    myCoach().then(r => { if (alive) setCoach(r && r.coach ? r.coach : null) }).catch(() => {})
    return () => { alive = false }
  }, [])
  const human = !!(coach && coach.reachable)

  return <div className="narrow coach-hub">
    <div className="hdr"><div><h1>{t('Coach')}</h1></div></div>

    {doors.nora && <div className="card coach-nora">
      <div className="row" style={{ gap: 8, marginBottom: 8 }}>
        <Icon name="sparkles" />
        <div className="lbl2">{t("Nora, the club's assistant")}</div>
      </div>
      <h2 style={{ margin: '0 0 4px' }}>{t('A question between two sessions?')}</h2>
      <div className="small dim" style={{ lineHeight: 1.5, marginBottom: 12 }}>{t('Ask Nora. She answers within the limits your club has set.')}</div>
      <Button variant="primary" icon="chat" onClick={() => nav('/coach')}>{t('Ask Nora')}</Button>
    </div>}

    {human && <Section title={t('Your coach')}>
      <Row icon="personCircle" iconTint="var(--acc)" title={t('Write to your coach')} subtitle={coach.name || t('Ask a question without leaving the logbook')}
        accessory="chevron" onClick={() => nav('/coach-thread')} />
    </Section>}

    {!doors.nora && !human && <div className="card muted small" style={{ lineHeight: 1.5 }}>{t('Your club has no coach to write to yet.')}</div>}
  </div>
}
