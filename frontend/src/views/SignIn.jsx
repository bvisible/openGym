//// Neoffice — added file (no upstream equivalent) : l'écran de connexion du
//// carnet.
////
//// AVANT : `/gym` renvoyait un visiteur anonyme sur `/login?redirect-to=/gym`
//// — 434 Ko de page desk, aux couleurs de l'ERP. Un membre qui tape l'icône
//// sur son écran d'accueil tombait sur autre chose que son carnet.
////
//// 🔴 CE QUI N'EST PAS FAIT ICI, ET NE DOIT JAMAIS L'ÊTRE : vérifier un mot de
//// passe. Ce formulaire poste sur `/api/method/login`, l'endpoint de Frappe.
//// Verrouillage après N échecs, restriction d'IP, mot de passe expiré et
//// double facteur vivent dans `LoginManager`, côté serveur, et s'appliquent
//// quel que soit l'appelant. Écrire notre propre vérification créerait une
//// SECONDE porte d'entrée sur les mêmes comptes, qu'il faudrait redurcir à
//// chaque fois — et le jour où on en oublie une, c'est un trou.
////
//// Ce fichier habille l'entrée. Il ne la refait pas.

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

      //// Deux réponses de Frappe qui ne sont PAS des échecs et qu'on ne sait
      //// pas traiter ici : le double facteur (il faut saisir un code) et le
      //// mot de passe expiré (il faut en choisir un neuf). Dans les deux cas
      //// on passe la main à la page de Frappe, qui sait le faire — plutôt que
      //// d'en bricoler une version incomplète.
      if (r?.redirect_to) { window.location.href = r.redirect_to; return }
      if (r?.verification || r?.tmp_id) {
        window.location.href = '/login?redirect-to=/gym'
        return
      }

      //// La case est cochée par défaut : sur un carnet d'entraînement
      //// personnel, se refaire éjecter entre deux séances est le défaut le
      //// plus pénible. Le serveur, lui, refuse d'allonger la session d'un
      //// compte qui a accès au desk — voir `api/session.py`.
      if (souvenir) { try { await rememberMe() } catch (e) { /* la connexion a réussi, c'est l'essentiel */ } }

      //// Rechargement complet, pas un rendu React : la page porte un jeton
      //// CSRF et le nom de l'utilisateur, tous deux posés par le serveur au
      //// rendu. Continuer avec ceux de l'invité ferait échouer la première
      //// écriture avec un 403 sur un écran qui a l'air connecté.
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
      //// La phrase vient d'ICI, pas du serveur. L'endpoint en renvoie une,
      //// mais traduite côté serveur — donc dans la langue de la REQUÊTE, et
      //// seulement si le msgid existe dans les PO de l'app. Le carnet, lui,
      //// connaît la langue du membre et a la chaîne dans son paquet. Vu à
      //// l'écran : « If an account exists… » au milieu d'un écran français.
      setNote(t('If an account exists for this address, a reset link is on its way.'))
      setMode('sent')
    } catch (e) {
      //// Même en cas d'erreur, le message est le même : dire « ce compte
      //// n'existe pas » révélerait qui est inscrit dans ce club.
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
          {/* //// `autoComplete` et `inputMode` sont ce qui fait qu'un
               gestionnaire de mots de passe remplit ce formulaire et qu'un
               téléphone ouvre le bon clavier. Sans eux, l'écran est correct et
               pénible. */}
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
