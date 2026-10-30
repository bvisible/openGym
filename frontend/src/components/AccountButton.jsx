//// Neoffice — added file (no upstream equivalent).
////
//// The account, as a round button at the top right of the screens of the bottom bar (the pilot club, 30.10: the account stays
//// reachable at the top). It used to be the last tab; the bar now keeps its places for what a member does. A dot says when the sync is stuck
//// (the dot the Home screen's gear used to carry). The header of each screen keeps room for it: src/tabbar-centered.css.
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { useConnectionTrouble } from './SyncBanner.jsx'

const initialsOf = name => {
  const parts = String(name || '').trim().split(/\s+/).filter(Boolean)
  if (!parts.length) return '·'
  return ((parts[0][0] || '') + (parts.length > 1 ? parts[parts.length - 1][0] : '')).toUpperCase()
}

export default function AccountButton() {
  const nav = useNavigate()
  const user = useStore(s => s.user)
  const trouble = useConnectionTrouble()
  return <button type="button" className="acct-btn" onClick={() => nav('/settings')}
    aria-label={trouble ? t('My account') + ', ' + t('Connection problem') : t('My account')}>
    {initialsOf(user && user.name)}{trouble && <span className="tab-dot" aria-hidden="true" />}
  </button>
}
