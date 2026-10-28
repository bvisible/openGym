//// Neoffice — added file (no upstream equivalent).
//// The club's full logo on the sign-in screen and the membership gate (BOOT.app_logo). It sits on a plate (index.css .signin-logo): white by
//// default, which suits a dark or a coloured wordmark; a BRIGHT wordmark on a transparent background (the club's own yellow one, 28.10: the logo shown
//// was not the club's) would be nearly invisible on white, so it gets a dark plate (lib/share/draw.js logoInfo → `light`).
import { useEffect, useState } from 'react'
import { loadLogo } from '../lib/share/render.js'

export default function ClubLogo({ src, alt = '' }) {
  const [light, setLight] = useState(false)
  useEffect(() => {
    let live = true
    loadLogo(src).then(info => { if (live) setLight(!!info?.light) }).catch(() => {})
    return () => { live = false }
  }, [src])
  return <img className={'signin-logo' + (light ? ' on-dark' : '')} src={src} alt={alt} />
}
