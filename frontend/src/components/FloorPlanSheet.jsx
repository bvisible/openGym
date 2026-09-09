//// Neoffice — added file (no upstream equivalent).
////
//// The whole room, outside of any exercise: every zone the club mapped, its
//// machines numbered, out-of-order ones struck. Until now the plan only
//// appeared under an exercise ("where do I do this"); the pilot club asked for
//// a way to open it on its own (2026-09-09). Opened from the Home card and from
//// the Exercises tab; the data comes from neoffice_gym.api.floor.for_member,
//// the same allow-listed payload the exercise panel uses.
import { useEffect, useState } from 'react'
import { floorPlan } from '../lib/api.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'

let cached = null
/** The plan, fetched once per app load; null until known, [] when the club drew nothing. */
export async function loadFloorPlan() {
  if (cached) return cached
  try {
    const r = await floorPlan()
    cached = (r && (r.message || r).zones) || []
  } catch { cached = [] }
  return cached
}

function ZoneMap({ zone, focus, onPick }) {
  const style = zone.image ? { backgroundImage: `url(${zone.image})`, backgroundSize: 'cover', backgroundPosition: 'center' } : undefined
  return <div className="floor-map floor-map-full" style={style}>
    {zone.items.map(item => {
      const round = item.shape === 'Circle'
      return <button key={item.name} type="button"
        className={'floor-item' + (focus === item.name ? ' focus' : '') + (item.enabled ? '' : ' out')}
        style={{ left: item.pos_x + '%', top: item.pos_y + '%', width: item.width + '%', height: item.height + '%', borderRadius: round ? '50%' : '8px' }}
        title={item.item_name} aria-label={item.item_name} onClick={() => onPick(item.name)}>
        <span>{item.number || ''}</span>
      </button>
    })}
  </div>
}

export default function FloorPlanSheet({ zones: given }) {
  const [zones, setZones] = useState(given || null)
  const [focus, setFocus] = useState(null)
  useEffect(() => { if (!given) loadFloorPlan().then(setZones) }, [given])

  if (zones === null) return <><h3>{t('Floor plan')}</h3><p className="small dim">{t('Loading…')}</p></>
  if (!zones.length) return <><h3>{t('Floor plan')}</h3><p className="small dim">{t('Your club has not drawn its floor plan yet.')}</p></>

  return <>
    <h3>{t('Floor plan')}</h3>
    <div className="small dim" style={{ marginBottom: 10 }}>{t('Tap a machine to find it in the list, or a name to see where it is.')}</div>
    {zones.map(zone => <div key={zone.id} className="floor-zone">
      <div className="lbl2 floor-zone-name">{zone.name}</div>
      <ZoneMap zone={zone} focus={focus} onPick={setFocus} />
      <div className="small floor-legend">
        {zone.items.map(item => (
          <button key={item.name} type="button" className={'floor-chip' + (item.enabled ? '' : ' out') + (focus === item.name ? ' on' : '')} onClick={() => setFocus(item.name)}>
            {item.number ? item.number + ' · ' : ''}{item.item_name}
            {item.enabled ? '' : ' — ' + t('out of order')}
          </button>
        ))}
      </div>
    </div>)}
    <div className="small dim row" style={{ gap: 6, marginTop: 12 }}><Icon name="info" style={{ fontSize: 13 }} />{t('Each exercise sheet also shows where it is done.')}</div>
  </>
}
