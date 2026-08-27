//// Neoffice — added file (no upstream equivalent): the journal's login
//// screen.
////
//// BEFORE: `/gym` sent an anonymous visitor to `/login?redirect-to=/gym`
//// — 434 KB of desk page, in the ERP's colors. A member who tapped the
//// icon on their home screen landed on something other than their journal.
////
//// 🔴 WHAT IS NOT DONE HERE, AND MUST NEVER BE: checking a password. This
//// form posts to `/api/method/login`, Frappe's own endpoint. Lockout
//// after N failures, IP restriction, expired password and two-factor live
//// in `LoginManager`, server-side, and apply no matter who calls it.
//// Writing our own check would create a SECOND front door onto the same
//// accounts, which would need rehardening every time — and the day one
//// gets forgotten, that's a hole.
////
//// This file dresses up the entrance. It doesn't rebuild it.

import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { BOOT, signIn, rememberMe, forgotPassword } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

export default function SignIn() {
  const [mode, setMode] = useState('signin')   // signin · forgot · sent
  const [email, setEmail] = useState('')
  const [pwd, setPwd] = useState('')
  const [souvenir, setSouvenir] = useState(true)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [note, setNote] = useState(null)

  const entrer = async (e) => {
    e.preventDefault()
    if (busy) return
    setErr(null); setBusy(true)
    try {
      const r = await signIn(email.trim(), pwd)

      //// Two Frappe responses that are NOT failures and that we don't know
      //// how to handle here: two-factor (a code must be entered) and an
      //// expired password (a new one must be chosen). In both cases we
      //// hand off to Frappe's own page, which knows how to do it — rather
      //// than hacking together an incomplete version of our own.
      if (r?.redirect_to) { window.location.href = r.redirect_to; return }
      if (r?.verification || r?.tmp_id) {
        window.location.href = '/login?redirect-to=/gym'
        return
      }

      //// The box is checked by default: on a personal training journal,
      //// getting kicked out between two sessions is the most annoying
      //// default there is. The server, for its part, refuses to extend
      //// the session of an account that has desk access — see
      //// `api/session.py`.
      if (souvenir) { try { await rememberMe() } catch (e) { /* the sign-in succeeded, that's what matters */ } }

      //// A full reload, not a React render: the page carries a CSRF token
      //// and the user's name, both set by the server at render time.
      //// Continuing with the guest's would make the first write fail with
      //// a 403 on a screen that looks signed in.
      window.location.href = '/gym'
    } catch (e) {
      setErr(e?.message || t('Wrong address or password.'))
      setBusy(false)
    }
  }

  const oublie = async (e) => {
    e.preventDefault()
    if (busy) return
    setBusy(true); setErr(null)
    try {
      await forgotPassword(email.trim())
      //// The sentence comes from HERE, not from the server. The endpoint
      //// returns one too, but translated server-side — so in the language
      //// of the REQUEST, and only if the msgid exists in the app's PO
      //// files. The journal, on the other hand, knows the member's
      //// language and has the string in its own bundle. Seen on screen:
      //// "If an account exists…" in the middle of a French screen.
      setNote(t('If an account exists for this address, a reset link is on its way.'))
      setMode('sent')
    } catch (e) {
      //// Even on error, the message is the same: saying "this account
      //// doesn't exist" would reveal who is registered at this club.
      setNote(t('If an account exists for this address, a reset link is on its way.'))
      setMode('sent')
    } finally { setBusy(false) }
  }

  return <div className="signin">
    <div className="signin-mark"><Icon name="dumbbell" /></div>
    <h1>{BOOT.app_title || t('Fitness')}</h1>

    {mode === 'sent' ? <>
      <p className="sub">{note}</p>
      <Button variant="ghost" onClick={() => { setMode('signin'); setNote(null) }}>
        {t('Back to sign in')}
      </Button>
    </> : mode === 'forgot' ? <>
      <p className="sub">{t('Enter your address and we will send you a link to choose a new password.')}</p>
      <form onSubmit={oublie}>
        <label className="signin-f">
          <span>{t('Email address')}</span>
          <input type="email" autoComplete="email" required inputMode="email"
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <Button type="submit" variant="primary" disabled={busy || !email.trim()}>
          {busy ? t('Sending…') : t('Send the link')}
        </Button>
      </form>
      <button className="signin-link" onClick={() => setMode('signin')}>{t('Back to sign in')}</button>
    </> : <>
      <p className="sub">{t('Your workouts. Your loads. Your journal.')}</p>
      <form onSubmit={entrer}>
        <label className="signin-f">
          <span>{t('Email address')}</span>
          {/* //// `autoComplete` and `inputMode` are what makes a password
               manager fill in this form and a phone open the right
               keyboard. Without them, the screen is correct and
               tedious. */}
          <input type="email" autoComplete="username" required inputMode="email"
            autoCapitalize="none" spellCheck="false"
            value={email} onChange={e => setEmail(e.target.value)} />
        </label>
        <label className="signin-f">
          <span>{t('Password')}</span>
          <input type="password" autoComplete="current-password" required
            value={pwd} onChange={e => setPwd(e.target.value)} />
        </label>

        <label className="signin-check">
          <input type="checkbox" checked={souvenir} onChange={e => setSouvenir(e.target.checked)} />
          <span>{t('Keep me signed in')}</span>
        </label>

        {err && <div className="signin-err">{err}</div>}

        <Button type="submit" variant="primary" disabled={busy || !email.trim() || !pwd}>
          {busy ? t('Signing in…') : t('Sign in')}
        </Button>
      </form>
      <button className="signin-link" onClick={() => { setMode('forgot'); setErr(null) }}>
        {t('Forgot your password?')}
      </button>
    </>}
  </div>
}
