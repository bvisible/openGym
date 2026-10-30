//// Neoffice — added file (no upstream equivalent).
////
//// What the home screen has « to read » (views/HomeToday.jsx): the programs the member's coach sent, and the club's notices. The same two calls the upstream
//// home screen (views/Home.jsx) makes, with the same rules, so a member sees the same things on either:
////  - offers are asked on mount and whenever the tab comes back or the network returns, not on an interval: an offer appearing mid-session helps nobody;
////    the first load is unconditional (a tab mounted hidden would never get a visibilitychange), and a failure is silent (offline there is no offer);
////  - a notice a member closed is remembered by THEIR device only (writing it to the database would cost a write per member per notice and tell the club
////    who read what, which it never asked for); the key carries the notice's MODIFIED date, so a notice the club corrected reopens for those who read the old one.
import { useEffect, useState } from 'react'
import { programInbox, announcements } from './api.js'
import { describeOffer } from './coach-program.js'
import { exCount } from './format.js'
import { t } from './i18n.js'

export const NOTICES_SEEN_KEY = 'gym_notices_seen'

const readSeen = () => {
  try { return JSON.parse(localStorage.getItem(NOTICES_SEEN_KEY) || '{}') } catch { return {} }
}

/** What an offer contains, said in the member's language (composed here, not on the server: the server would freeze it in the coach's language). */
export function offerSummary(o) {
  const d = describeOffer(o)
  if (!d.ok) return t('This program could not be read: {0}', d.error)
  const parts = [t(d.routineCount === 1 ? '{0} routine' : '{0} routines', d.routineCount), exCount(d.exerciseCount)]
  if (d.scheduledDays > 0) parts.push(t(d.scheduledDays === 1 ? 'scheduled on {0} day' : 'scheduled on {0} days', d.scheduledDays))
  // A cycle is stated BEFORE accepting: "on 3 days" describes a typical week and would let the member believe the schedule never moves again.
  if (d.cycleSpan > 1) parts.push(t('{0}-week cycle', d.cycleSpan))
  return parts.join(' · ')
}

export function useHomeFeed() {
  const [offers, setOffers] = useState([])
  const [notices, setNotices] = useState([])
  const [seen, setSeen] = useState(readSeen)

  useEffect(() => {
    let alive = true
    const load = () => { programInbox().then(list => { if (alive) setOffers(Array.isArray(list) ? list : []) }).catch(() => {}) }
    load()
    const onVisible = () => { if (!document.hidden) load() }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('online', load)
    return () => { alive = false; document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('online', load) }
  }, [])

  useEffect(() => {
    let alive = true
    announcements().then(r => { if (alive) setNotices((r && r.announcements) || []) }).catch(() => {})
    return () => { alive = false }
  }, [])

  const close = n => {
    const next = { ...seen, [n.name]: n.modified }
    setSeen(next)
    try { localStorage.setItem(NOTICES_SEEN_KEY, JSON.stringify(next)) } catch { /* private mode: the notice comes back next time */ }
  }
  return { offers, notices: notices.filter(n => seen[n.name] !== n.modified), close }
}
