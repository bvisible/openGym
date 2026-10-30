//// Neoffice — added file (no upstream equivalent).
////
//// The club's running challenges, as a card that opens the challenges screen. It sits with the club's classes (views/Classes.jsx, the second segment of the Planning
//// place): the club's classes and challenges in one place. A club that runs challenges but no classes has no such place, so the home screen shows it instead
//// (views/HomeToday.jsx). We show the member's OWN rank, never anyone else's: their score is health data, and it is asked for on the challenges screen.
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { challengesMine } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

export default function ChallengesCard() {
  const nav = useNavigate()
  const [challenges, setChallenges] = useState([])
  useEffect(() => {
    let alive = true
    challengesMine().then(r => { if (alive) setChallenges(((r && r.challenges) || []).filter(c => c.running).slice(0, 3)) }).catch(() => {})
    return () => { alive = false }
  }, [])
  if (!challenges.length) return null
  return <div className="card" style={{ cursor: 'pointer' }} onClick={() => nav('/challenges')}>
    <div className="row between" style={{ marginBottom: 8 }}>
      <div className="lbl2">{t('Challenges')}</div>
      <span className="small acc">{t('See all')}</span>
    </div>
    {challenges.map(c => <div key={c.name} className="row" style={{ gap: 9, padding: '4px 0', minWidth: 0 }}>
      <span className="lrow-i" style={{ background: 'var(--surface-3)' }}><Icon name="trophy" /></span>
      <div style={{ minWidth: 0 }}>
        <div className="ttl">{c.title}</div>
        <div className="small dim">{c.joined
          ? (c.rank ? (c.rank === 1 ? t('You are 1st of {0}', c.of) : t('You are {0} of {1}', c.rank, c.of)) : t('You are taking part'))
          : t('Take part if you want to')}</div>
      </div>
    </div>)}
  </div>
}
