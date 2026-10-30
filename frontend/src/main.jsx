import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import { MOBILE } from './lib/mobile.js'
import { captureInstallPrompt } from './lib/install-offer.js'
import { useStore } from './store/useStore.js'
import { startMediaSync } from './lib/media-sync.js'
import { startNativeKeyboard } from './lib/native-keyboard.js'
// The Coach's and the admin dashboard's styles stay in the main stylesheet, in the place they
// always had (before index.css), although their screens are now loaded on demand (App.jsx).
import './admin.css'
import './coach.css'
import './index.css'
//// Neoffice — the Simple level reads bigger (src/simple-level.css).
import './simple-level.css'
//// Neoffice — the bottom bar centred on the Start button, its beat, the account button (src/tabbar-centered.css).
import './tabbar-centered.css'
//// Neoffice — the calmed home screen (src/home-today.css, views/HomeToday.jsx).
import './home-today.css'
//// Neoffice — the warm skin: its stylesheet (src/skin-neoffice.css) and the switch that turns it on (lib/skin.js). Delete both lines for upstream's look.
import './skin-neoffice.css'
import { startSkin } from './lib/skin.js'
import { hideBoot, handOverFromLaunchScreen } from './lib/boot.js'

// `beforeinstallprompt` fires once, early — before any component mounts. Caught
// here so the home-screen banner can replay it from a button (lib/install-offer.js).
captureInstallPrompt()

// App.jsx restores per-route scroll itself; the browser's own attempt races it.
// A script that dies before the app draws would otherwise leave the boot logo lifting forever.
window.addEventListener('error', hideBoot, { once: true })
handOverFromLaunchScreen()

if ('scrollRestoration' in history) history.scrollRestoration = 'manual'

//// Neoffice — before the first paint, so the page never shows upstream's greys for a frame (lib/skin.js).
startSkin()
createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>
)

// The photos and videos of custom exercises, in every build (the phone and the demo included):
// uploads of what the server lacks, the local clean-up, and the plan's files kept offline.
startMediaSync(useStore)

// Android 15 does not resize the page for the soft keyboard; the app says how much it covers and
// this keeps the focused field above it. Idle everywhere else.
startNativeKeyboard()

// Not in the mobile build: the native shell already serves everything from disk.
if (!MOBILE && 'serviceWorker' in navigator && location.protocol === 'https:') {
  //// Neoffice — not registered here: on Frappe the page registers its worker itself (neoffice_gym
  //// www/gym.html: /gym_sw.js, scope /gym). From /gym, 'sw.js' resolves to /sw.js, which nothing
  //// serves: a 404 in the console of every load, and no worker from it.
  // The plan's exercise media, kept by the worker for a workout opened without a network (#281).
  // It only fetches ahead while the page runs as the installed app; a tab keeps what it has shown.
  import('./lib/media-prefetch.js').then(m => m.startMediaPrefetch(useStore)).catch(() => {})
}
