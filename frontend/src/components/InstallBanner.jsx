//// Neoffice — added file (no upstream equivalent).
////
//// The card at the top of Home that invites a member, still in the browser
//// on their phone, to put the journal on their home screen — and shows how.
//// Decision logic lives in lib/install-offer.js; this only draws it.
import { useState } from 'react'
import { t } from '../lib/i18n.js'
import { BOOT } from '../lib/api.js'
import { useUI } from '../store/useUI.js'
import Icon from './Icon.jsx'
import { Button } from './ui.jsx'
import {
  installOffer, readEnvironment, dismissInstallOffer, hasNativePrompt, promptInstall,
} from '../lib/install-offer.js'

function HowToSheet({ platform, appName, close }) {
  const steps = platform === 'ios'
    ? [t('Tap the Share button at the bottom of Safari (the square with an arrow).'),
       t('Scroll down and tap “Add to Home Screen”.'),
       t('Tap “Add” at the top right. {0} now opens like any other app.', appName)]
    : [t('Open the browser menu (the three dots at the top right).'),
       t('Tap “Install app” or “Add to Home screen”.'),
       t('Confirm. {0} now opens like any other app.', appName)]
  return <>
    <h3>{t('Add {0} to your home screen', appName)}</h3>
    <ol className="install-steps">
      {steps.map((s, i) => <li key={i}>{s}</li>)}
    </ol>
    <Button variant="primary" onClick={close}>{t('Got it')}</Button>
  </>
}

export default function InstallBanner() {
  const [gone, setGone] = useState(false)
  const offer = installOffer(readEnvironment())
  if (gone || !offer.show) return null

  const appName = BOOT.app_title || t('Fitness')
  const later = () => { dismissInstallOffer(); setGone(true) }
  const explain = () => useUI.getState().openSheet(close =>
    <HowToSheet platform={offer.platform} appName={appName} close={close} />)
  const install = async () => {
    //// Android Chrome: the real install dialog. Anything else: the steps.
    if (hasNativePrompt()) {
      const outcome = await promptInstall()
      if (outcome === 'accepted') setGone(true)
      return
    }
    explain()
  }

  return <div className="card install-banner" style={{ borderColor: 'var(--acc)' }}>
    <div className="row" style={{ gap: 12, alignItems: 'center' }}>
      <span className="install-mark">
        {BOOT.app_icon ? <img src={BOOT.app_icon} alt="" /> : <Icon name="dumbbell" />}
      </span>
      <div style={{ minWidth: 0, flex: 1 }}>
        <div className="lbl2">{t('Add {0} to your home screen', appName)}</div>
        <div className="small dim" style={{ lineHeight: 1.45 }}>
          {t('One tap to open it, full screen, and it works even without network at the rack.')}
        </div>
      </div>
      <button className="iconbtn" onClick={later} aria-label={t('Later')}><Icon name="xmark" /></button>
    </div>
    <div className="row" style={{ gap: 8, marginTop: 10 }}>
      <Button variant="primary" onClick={install}>{t('Install')}</Button>
      <Button variant="ghost" onClick={explain}>{t('How?')}</Button>
    </div>
  </div>
}
