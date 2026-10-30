//// Neoffice — added file (no upstream equivalent).
////
//// The club's floor plan, one tap from Settings › Your club. It used to be a card on the home screen; a member looks for it once, to understand the room, not every
//// day (the pilot club, 30.10: the home screen keeps what is used every day). Silent when the club drew none.
import { useEffect, useState } from 'react'
import { t } from '../lib/i18n.js'
import { loadFloorPlan } from './FloorPlanSheet.jsx'
import { floorPlanSheet } from '../sheets.jsx'
import { Row, Section } from './ui.jsx'

export default function FloorPlanRow() {
  const [floor, setFloor] = useState([])
  useEffect(() => {
    let alive = true
    loadFloorPlan().then(z => { if (alive) setFloor(z || []) })
    return () => { alive = false }
  }, [])
  if (!floor.length) return null
  return <Section>
    <Row icon="map" iconTint="var(--acc)" title={t('Floor plan')} subtitle={t('{0} zones · find every machine', floor.length)} accessory="chevron"
      onClick={() => floorPlanSheet(floor)} />
  </Section>
}
