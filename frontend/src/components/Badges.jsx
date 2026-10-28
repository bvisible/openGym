//// Neoffice — added file (no upstream equivalent).
////
//// Badges, points, and what they buy.
////
//// Asked for by the pilot club on 2026-08-31, with the four categories the club
//// switches on or off, and *"une partie points qui donnerait des avantages"*.
////
//// LOCKED BADGES ARE SHOWN TOO, with what it takes under each. A trophy case
//// containing only what you already have gives a beginner an empty screen and
//// nothing to aim at — which is the opposite of the point.
////
//// Shown at EVERY level of detail: this is encouragement, not a technical
//// reading. It is precisely what a beginner can use.

import { useEffect, useState } from 'react'
import { myBadges } from '../lib/api.js'
import { t } from '../lib/i18n.js'
//// Neoffice — levels: a badge may have bronze, silver and gold (lib/badge-tiers.js); the tile shows the level held and the way to the next.
import { tierState, medalName, nextLine } from '../lib/badge-tiers.js'
import Icon from './Icon.jsx'

export default function Badges() {
  const [data, setData] = useState(null)

  useEffect(() => {
    let alive = true
    myBadges()
      .then(r => { if (alive) setData(r || null) })
      //// Offline, or a club without badges: silence. This is a bonus panel and
      //// failing loudly about it would be worse than not showing it.
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [])

  if (!data || !data.enabled || !(data.badges || []).length) return null

  const earned = data.badges.filter(b => b.earned)
  const locked = data.badges.filter(b => !b.earned)

  return <div className="card">
    <h2>{t('Badges')}
      {data.pointsEnabled && <span className="dim" style={{ textTransform: 'none', letterSpacing: 0 }}>
        {' · '}{t('{0} points', data.points)}</span>}
    </h2>

    <div className="badge-grid">
      {earned.map(b => <Badge key={b.id} badge={b} />)}
      {locked.map(b => <Badge key={b.id} badge={b} />)}
    </div>

    {data.pointsEnabled && (data.rewards || []).length > 0 && <>
      <h4 className="sec" style={{ marginTop: 16 }}>{t('What your points give you')}</h4>
      <div className="reward-list">
        {data.rewards.map(r => {
          const reachable = data.points >= r.cost_points
          return <div key={r.name} className={'reward' + (reachable ? ' on' : '')}>
            <div className="grow">
              <div className="tt">{r.reward_name}</div>
              {r.description && <div className="ss">{r.description}</div>}
            </div>
            {/* //// The gap, not just the price: "il te manque 60 points" is a
                //// next step; "200 points" is a wall. */}
            <span className="tag">{reachable
              ? t('Available')
              : t('{0} points to go', r.cost_points - data.points)}</span>
          </div>
        })}
      </div>
      <div className="small dim" style={{ marginTop: 8 }}>
        {t('Ask at the desk to claim a reward.')}
      </div>
    </>}
  </div>
}

function Badge({ badge }) {
  const st = tierState(badge)
  const got = st.tier >= 1
  const bar = st.nextMedal || ''
  return <div className={'badge' + (got ? ' got' : '') + (st.medal ? ' m-' + st.medal : '')} title={badge.description || badge.name}>
    <div className="badge-ico"><Icon name={badge.glyph || 'medal'} /></div>
    <div className="badge-name">{badge.name}</div>
    {got && <div className="badge-sub">{st.medal ? medalName(st.medal) : t('Earned')}</div>}
    {!st.complete && <>
      <div className="badge-bar"><span className={bar} style={{ width: st.pct + '%' }} /></div>
      {/* One level: what the club says about the badge, as before. Several: the level to come and what it takes. */}
      <div className="badge-sub">{st.levels === 3 ? nextLine(badge, st) : (badge.description || '')}</div>
    </>}
  </div>
}
