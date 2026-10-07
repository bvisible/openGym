//// Neoffice — upstream's components/ServerSync.jsx, kept for what a club's journal uses: the words
//// for the connection state (connectionView, actionLabel), « Sync now », the network flag, and the
//// changes kept for another account. Kept under upstream's name and shape so that its next changes
//// to these words merge. Removed: pairing a phone (ConnectSheet), passkey and password sign-in
//// (the journal signs in on its own screen, views/SignIn.jsx), leaving a server and its owed-changes
//// sheet (store signOut + views/Settings.jsx), and upstream's Settings block (ours is SyncRows).
// The connection to the server, as the screens show it and act on it: the persistent indicator
// (SyncBanner.jsx), the "Server & sync" block in Settings, and the question a sign-out or a
// disconnect asks when the server has not got everything yet. The store decides the state
// (useStore.js, `sync` — see statusOf there); this file only words it and offers what to do.
import { useEffect, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, tn } from '../lib/i18n.js'
import { fmtAgo, changeCount } from '../lib/format.js'
//// Neoffice — no passkey, media-sync, ConnectSheet or PasswordAuth imports: not shipped here. Of the
//// sheets, only the menu: the changes kept for another account are saved as a backup file (v1.3.10).
import { MOBILE, shareExport } from '../lib/mobile.js'
import { menuSheet } from '../sheets.jsx'
import { DEMO } from '../lib/demo.js'
import { Row } from './ui.jsx'
//// Neoffice — the page rendered again by the server (lib/api.js), see signInAgain.
import { reloadJournal } from '../lib/api.js'

const ui = () => useUI.getState()
const toast = m => ui().toast(m)
//// Neoffice — no guest mode on a club's journal, so the banner never offers a guest to sign in.
const canSignIn = () => false

// "gym.example.com" out of the base URL the store keeps (a subpath stays: it is part of which
// server this is). Anything unparseable is shown as it is.
export const hostOf = base => {
  try { const u = new URL(base); return u.host + u.pathname.replace(/\/$/, '') } catch { return base || '' }
}

// Whether the device says it has a network at all. fetch fails the same way for a phone with no
// network and for a server that is down, or behind a proxy whose error page carries no CORS
// header (the phone app is another origin): only this tells "offline" from "your server".
export const isOnline = () => typeof navigator === 'undefined' || navigator.onLine !== false
// The same, for a screen that has to change its words when the network comes or goes.
export function useOnline() {
  const [online, setOnline] = useState(isOnline)
  useEffect(() => {
    const on = () => setOnline(isOnline())
    window.addEventListener('online', on)
    window.addEventListener('offline', on)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', on) }
  }, [])
  return online
}

/* One state of `sync`, in words:
     tone    'ok' | 'wait' | 'off' | 'bad' | 'quiet' — the colour, from fine to deliberate local use
     line    the short status line: Settings, and the toast after "Sync now"
     banner  the sentence the persistent indicator shows, or null when there is nothing to say
     action  what the indicator offers: 'retry' | 'pair' | 'signin' | 'connect' | null
   `mobile` is the build (a phone pairs, a browser signs in); `online` whether the device has a
   network, which decides whether "offline" is the device or the server. Every state that is not
   'ok' says the changes are kept on this device — that is the one thing the person needs to hear
   first. */
export function connectionView(sync, { mobile = MOBILE, online = isOnline() } = {}) {
  if (!sync) return null
  const err = sync.lastError || {}
  // A device that says it has no network is offline whatever the last request found: said the
  // moment it goes, not at the next sync attempt, which may be a poll away. Only the states that
  // claim a working connection give way; a refusal or an error keeps its own words.
  const status = !online && (sync.status === 'ok' || sync.status === 'pending') ? 'offline' : sync.status
  switch (status) {
    case 'ok':
      return { tone: 'ok', icon: 'cloud', line: t('All synced'), banner: null, action: null }
    case 'pending':   // the sentence already says "tap to retry": no second word for it
      return { tone: 'wait', icon: 'reset', line: t('Waiting to sync'), banner: t('Not synced yet. Tap to retry.'), action: 'retry', label: null }
    // A sign-in's question about this device's workouts is still open (useStore adoptProfile):
    // nothing syncs until it is answered, and "retry" — Sync now — asks it again.
    case 'held':
      return { tone: 'wait', icon: 'reset', line: t('Waiting for your answer about this device’s workouts'), banner: t('Nothing syncs until you say whether this device’s workouts go into your profile. Tap to answer.'), action: 'retry', label: null }
    case 'offline':
      if (online) return {
        tone: 'off', icon: 'cloudSlash', action: 'retry',
        line: err.code === 'timeout' ? t('The server did not answer in time.') : t('The server cannot be reached'),
        banner: sync.pending ? t('Your server can’t be reached. Your changes are saved on this device and sync once it answers again.') : t('Your server can’t be reached. Showing the last copy synced with it.'),
      }
      return {
        tone: 'off', icon: 'cloudSlash', action: 'retry',
        line: err.code === 'timeout' ? t('The server did not answer in time.') : t('Offline. The server can’t be reached'),
        banner: sync.pending ? t('Offline. Your changes are saved on this device and sync when you’re back online.') : t('Offline. Showing the last copy synced with the server.'),
      }
    case 'error':
      return err.code === 'bad-response'
        ? { tone: 'bad', icon: 'warning', action: 'retry', line: t('Not an openGym answer (HTTP {0})', err.status), banner: t('Your server’s address answered with something other than openGym (HTTP {0}). Your changes are kept here.', err.status) }
        : { tone: 'bad', icon: 'warning', action: 'retry', line: t('Server error (HTTP {0})', err.status), banner: t('Your server answered with an error (HTTP {0}). Your changes are kept here.', err.status) }
    case 'auth':
      if (!mobile) return { tone: 'bad', icon: 'lock', action: 'signin', line: t('The server refuses this browser'), banner: t('Your server no longer accepts this browser. Your changes are kept here.') }
      // A phone an earlier version unpaired kept no address and no token: nothing refuses it,
      // there is simply nothing to ask.
      return err.code === 'not-paired'
        ? { tone: 'bad', icon: 'lock', action: 'pair', line: t('This phone is not connected to a server.'), banner: t('This phone is no longer paired with your server. Your changes are kept here.') }
        : { tone: 'bad', icon: 'lock', action: 'pair', line: t('The server refuses this phone'), banner: t('Your server no longer accepts this phone. Your changes are kept here.') }
    default:   // 'local': no server at all — chosen, so it is said quietly, but it is said
      return mobile
        ? { tone: 'quiet', icon: 'lock', action: 'connect', line: t('On this phone only, not connected to a server'), banner: t('On this phone only, not connected to a server') }
        : { tone: 'quiet', icon: 'lock', action: canSignIn() ? 'signin' : null, line: t('Guest mode: your data lives only in this browser.'), banner: t('Guest mode: your data lives only in this browser.') }
  }
}

// The word on the indicator's button: the view's own `label` when it has one (null for none),
// else the action's.
export const actionLabel = view => (view.label !== undefined ? view.label : ({ retry: t('Try again'), pair: t('Pair again'), signin: t('Sign in'), connect: t('Connect') })[view.action] || null)

// "Sync now": whatever is waiting goes, the server's copy is checked, and the answer is said.
export async function syncNowWithToast() {
  const sync = await useStore.getState().syncNow()
  const view = connectionView(sync)
  if (view) toast(view.line)
  return sync
}

//// Neoffice — signing in again is a new render of the page, not a sheet: for a session that ended
//// the server renders the journal's own sign-in screen (views/SignIn.jsx), and for one that is still
//// valid (a page whose CSRF token went stale) a fresh token. What this device owes stays in its
//// storage, with its owner, and merges once the same account is back.
export function signInAgain() {
  reloadJournal()
}

//// Neoffice — upstream's ServerSyncSection, as two rows for our Settings account block: how
//// things stand (since when, what is still waiting) and « Sync now ». No server address row: the
//// server is the club's, and the account rows above already say who is signed in.
export function SyncRows() {
  const user = useStore(s => s.user)
  const sync = useStore(s => s.sync)
  useStore(s => s.S)   // the count of waiting changes follows every edit
  //// Neoffice — no config selector: upstream's read whether « Sign in » may offer a password.
  const unsynced = useStore(s => s.unsyncedChanges)
  const online = useOnline()
  const [busy, setBusy] = useState(false)
  // "Last synced: 3 minutes ago" goes stale on an open screen; a re-render now and then keeps it true.
  const [, tick] = useState(0)
  useEffect(() => { const iv = setInterval(() => tick(n => n + 1), 30000); return () => clearInterval(iv) }, [])
  if (!user || !sync) return null
  const view = connectionView(sync, { online })
  // While everything is fine, a change still in its short debounce is not news; once anything
  // is wrong, how much is waiting is exactly what the person needs.
  const owed = sync.status !== 'ok' && typeof unsynced === 'function' ? unsynced() : { owed: false }
  const sub = [
    sync.lastSynced ? t('Last synced: {0}', fmtAgo(sync.lastSynced)) : t('Not synced with this server yet'),
    owed.owed && (owed.count > 0 ? t('Not on your server yet: {0}', changeCount(owed.count)) : owed.count == null ? t('Some changes on this device have not reached your server.') : null),
  ].filter(Boolean).join(' · ')
  const now = async () => {
    if (busy) return
    setBusy(true)
    try { await syncNowWithToast() } finally { setBusy(false) }
  }
  //// Neoffice — rows (a fragment) for our account block, not upstream's Section: no server address
  //// row, and the sign-in row reloads the page (signInAgain) instead of a passkey or password sheet.
  return <>
    <Row icon={view.icon} iconTint={TINT[view.tone]} title={view.line} subtitle={sub} className="sync-status" />
    <Row icon="reset" iconTint="var(--acc)" title={busy ? t('Syncing…') : t('Sync now')} onClick={now} />
    {/* //// Neoffice — a session that ended: the page rendered again, which shows the sign-in screen */}
    {sync.status === 'auth' && <Row icon="person" iconTint="var(--blue)" title={t('Sign in')} subtitle={t('Your changes are kept here, and merged into your account once you are signed in again.')} accessory="chevron" onClick={signInAgain} />}
    {/* another account's, kept when this one signed in over a copy that still owed them */}
    <KeptChangesRows />
    {/* //// Neoffice — end of our account rows (see the head of SyncRows) */}
  </>
}

//// Neoffice — TINT moved below SyncRows, which reads it (upstream declares it above its Section).
const TINT = { ok: 'var(--green)', wait: 'var(--orange)', off: 'var(--grey)', bad: 'var(--red)', quiet: 'var(--grey)' }

// The changes a forced sign-out or disconnect kept on this device, waiting for their server and
// account — so a device that went ahead anyway still says what it holds and for whom.
export function KeptChangesRows() {
  const kept = useStore(s => s.keptChanges)
  const rev = useStore(s => s.keptRev)
  const user = useStore(s => s.user)
  const [rows, setRows] = useState([])
  // Asked again when the account changes and whenever the kept changes do — the ones handed
  // back on a sign-in go some moments after it.
  useEffect(() => {
    let gone = false
    if (typeof kept === 'function') kept().then(r => { if (!gone) setRows(r || []) }).catch(() => {})
    return () => { gone = true }
  }, [kept, user?.id, rev])
  if (DEMO) return null
  // A copy kept for an account that may never come back here (its server lost it, or it was
  // deleted) is saved as a backup file, to import into another profile with "Merge them in".
  const save = async k => {
    const state = await useStore.getState().keptState(k.server, k.uid)
    if (!state) return
    const json = JSON.stringify(state, null, 2)
    const name = 'opengym-kept-' + String(k.name || k.uid).replace(/[^\w-]+/g, '_') + '-' + new Date().toISOString().slice(0, 10) + '.json'
    if (MOBILE) { try { await shareExport(json, name); useUI.getState().toast(t('Backup exported')) } catch { /* share sheet dismissed */ } return }
    const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([json], { type: 'application/json' })); a.download = name; a.click()
    setTimeout(() => URL.revokeObjectURL(a.href), 60000)
    useUI.getState().toast(t('Backup exported'))
  }
  return rows.map(k => <Row key={(k.server || '') + '|' + k.uid} icon="history" iconTint="var(--orange)"
    title={t('Changes kept for {0}', k.name || k.uid)}
    subtitle={(k.server ? hostOf(k.server) + ' · ' : '') + t('Added back when this device connects as that account again.')}
    accessory="chevron"
    onClick={() => menuSheet({ title: t('Changes kept for {0}', k.name || k.uid), items: [{ icon: 'download', label: t('Save as a backup file'), onClick: () => save(k) }] })} />)
}
