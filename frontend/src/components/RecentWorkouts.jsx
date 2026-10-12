//// Neoffice — added file (no upstream equivalent).
////
//// « Recent workouts » on Home: the member's last three sessions, each with a visible Share button that opens the share-as-image sheet
//// straight away, and a tap on the row for the detail. Sharing a session should be one tap away; a
//// button that sits two screens away (Stats, then the detail) is a button nobody finds. Draws nothing until a first workout is logged.
import { t } from '../lib/i18n.js'
import { lastWorkouts } from '../lib/recent-workouts.js'
import { WorkoutRow, workoutDetailSheet, shareWorkoutImageSheet } from '../sheets.jsx'
import { Button } from './ui.jsx'

export default function RecentWorkouts({ S, nav }) {
  const rows = lastWorkouts(S, 3)
  if (!rows.length) return null
  return <div className="recent-workouts" style={{ marginBottom: 14 }}>
    <div className="row between" style={{ marginBottom: 10 }}>
      <h4 className="sec" style={{ margin: 0 }}>{t('Recent workouts')}</h4>
      <Button size="sm" variant="ghost" trailingIcon="chevronRight" onClick={() => nav('/history')}>{t('All')} {(S.workouts || []).length}</Button>
    </div>
    <div className="list">{rows.map(w => <WorkoutRow key={w.id} w={w} onClick={() => workoutDetailSheet(w)} onShare={shareWorkoutImageSheet} />)}</div>
  </div>
}
