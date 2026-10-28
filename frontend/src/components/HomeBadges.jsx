//// Neoffice — added file (no upstream equivalent).
////
//// The badges the club put forward, first thing on the home screen (the club's coach, 28.10: the home screen opened on a line about rotations;
//// « mettre en avant les badges avec leur progression », defined and featured by the club themselves, in bronze, silver and gold).
////
//// WHAT IT SHOWS: the featured badges closest to their next level, then the latest earned ones (lib/badge-tiers.js featuredBadges), at most three.
//// WHAT IT DOES NOT: it is silent for a club without badges, with badges off, or with none featured (the club decides what climbs here), and
//// silent offline: a bonus card that fails loudly would be worse than no card. The case with every badge stays on the Stats screen.

import { useEffect, useState } from 'react'
import { myBadges } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import { featuredBadges, tierState, progressLine, nextLine } from '../lib/badge-tiers.js'
import { tappable } from '../lib/use-sheet-keyboard.js'
import BadgeRing from './BadgeRing.jsx'

export default function HomeBadges({ onOpen }) {
  const [data, setData] = useState(null)
  useEffect(() => {
    let alive = true
    myBadges()
      .then(r => { if (alive) setData(r || null) })
      .catch(() => { if (alive) setData(null) })
    return () => { alive = false }
  }, [])

  if (!data || !data.enabled) return null
  const items = featuredBadges(data.badges)
  if (!items.length) return null

  return <div className="card" style={{ cursor: 'pointer' }} {...tappable(onOpen)}>
    <div className="row between" style={{ marginBottom: 6 }}>
      <div className="lbl2">{t('Your badges')}</div>
      <span className="small acc">{t('See all')}</span>
    </div>
    {items.map(b => {
      const st = tierState(b)
      return <div key={b.id} className="row home-badge" style={{ gap: 14, padding: '6px 0', minWidth: 0 }}>
        <BadgeRing state={st} glyph={b.glyph} />
        <div style={{ minWidth: 0 }}>
          <div className="ttl">{b.name}</div>
          {!st.complete && <div className="small dim">{progressLine(b, st)}</div>}
          <div className="small dim">{nextLine(b, st)}</div>
        </div>
      </div>
    })}
  </div>
}
