//// Neoffice — added file (no upstream equivalent).
////
//// Which doors to a coach this member has: Nora (the club's AI, whatever the club lets her do) and the club's own coach (a thread, views/CoachThread.jsx).
//// The bar reads it to decide between « Coach » and « Exercises » (lib/nav-model.js), and the Coach screen (views/CoachHub.jsx) to draw its two doors.
//// Nora is known at once (the boot says so); the human coach is asked from the server once and remembered on this device, so the bar does not flicker
//// from one place to the other at every launch.
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { coachAvailable } from './coach.js'
import { myCoach } from './api.js'
import { MOBILE } from './mobile.js'
import { DEMO } from './demo.js'

const KEY = 'gym_has_human_coach'
let known = (() => { try { const v = localStorage.getItem(KEY); return v === null ? null : v === '1' } catch { return null } })()

export function useCoachDoors() {
  const config = useStore(s => s.config)
  const user = useStore(s => s.user)
  const coachMode = useStore(s => s.coachLocal?.mode)
  const [human, setHuman] = useState(known)
  useEffect(() => {
    if (!user || MOBILE || DEMO) return undefined
    let alive = true
    myCoach()
      .then(r => {
        const has = !!(r && r.coach && r.coach.reachable)
        known = has
        try { localStorage.setItem(KEY, has ? '1' : '0') } catch { /* private mode: asked again next time */ }
        if (alive) setHuman(has)
      })
      .catch(() => {})
    return () => { alive = false }
  }, [user])
  const nora = coachAvailable(config, user, { demo: DEMO, mobile: MOBILE, coachMode })
  return { nora, human: human === true, any: nora || human === true }
}
