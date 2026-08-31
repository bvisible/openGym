//// Neoffice — added file (no upstream equivalent).
////
//// The club's floor plan, as a member reads it.
////
//// Asked for by Olympia on 2026-08-31: *"quand on clique sur un exercice,
//// puisse voir le plan de salle en bas, avec le numéro qui clignote — il se
//// dit 'ok, c'est là que je dois aller'."*
////
//// Deliberately NOT an editor and NOT interactive beyond reading. Someone
//// standing in a gym between two sets wants one thing: where. Every control
//// added here is a control they have to skip past.
////
//// Geometry arrives in PERCENT (see api/floor.py), so the same plan is right
//// on a phone and on a desk screen with no per-size layout.

import { useEffect, useState } from 'react'
import { floorWhereIs } from '../lib/api.js'
import { t } from '../lib/i18n.js'

/** One machine on the plan. `focus` = this is the one being looked for. */
function Item({ item, focus }) {
  const round = item.shape === 'Circle'
  return <div
    className={'floor-item' + (focus ? ' focus' : '') + (item.enabled ? '' : ' out')}
    style={{
      left: item.pos_x + '%', top: item.pos_y + '%',
      width: item.width + '%', height: item.height + '%',
      borderRadius: round ? '50%' : '8px',
    }}
    title={item.item_name}>
    <span>{item.number || ''}</span>
  </div>
}

/**
 * The panel shown under an exercise. Renders NOTHING until it knows there is
 * something to show — a club that has not mapped its room must not get an
 * empty frame, and neither must an exercise nobody placed.
 */
export default function FloorPlanFor({ exerciseId }) {
  const [items, setItems] = useState(null)

  useEffect(() => {
    let alive = true
    if (!exerciseId) { setItems([]); return }
    floorWhereIs(exerciseId)
      .then(r => { if (alive) setItems((r && r.message && r.message.items) || []) })
      //// Offline, or a club that has never installed the plan: silence, not an
      //// error. This panel is a convenience — failing loudly about it would
      //// interrupt someone mid-workout for something they never asked for.
      .catch(() => { if (alive) setItems([]) })
    return () => { alive = false }
  }, [exerciseId])

  if (!items || !items.length) return null

  //// Grouped by zone: a club with three squat racks on two floors has to say
  //// WHICH floor, or the number alone sends the member to the wrong one.
  const zones = []
  for (const item of items) {
    let zone = zones.find(z => z.id === item.zone)
    if (!zone) { zone = { id: item.zone, name: item.zone_name, items: [] }; zones.push(zone) }
    zone.items.push(item)
  }

  return <div className="floor-panel">
    <div className="lbl2">{t('Where to find it')}</div>
    {zones.map(zone => <div key={zone.id} className="floor-zone">
      <div className="small dim floor-zone-name">{zone.name}</div>
      <div className="floor-map">
        {zone.items.map(item => <Item key={item.name} item={item} focus />)}
      </div>
      <div className="small floor-legend">
        {zone.items.map(item => (
          <span key={item.name} className={'floor-chip' + (item.enabled ? '' : ' out')}>
            {item.number ? item.number + ' · ' : ''}{item.item_name}
            {item.enabled ? '' : ' — ' + t('out of order')}
          </span>
        ))}
      </div>
    </div>)}
  </div>
}
