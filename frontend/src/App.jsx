import { useEffect } from 'react'
import { HashRouter, Routes, Route, Navigate, useNavigate, useLocation } from 'react-router-dom'
import { useStore } from './store/useStore.js'
import { useUI } from './store/useUI.js'
import { bindUI } from './components/ui.jsx'
import { ACCENTS } from './lib/format.js'
import { setLang, useLang } from './lib/i18n.js'
import { setNav } from './lib/nav.js'
import { initBackButton } from './lib/back.js'
import { useWakeLock } from './lib/wakelock.js'
import { startFlow } from './sheets.jsx'
import Icon from './components/Icon.jsx'
import SignIn from './views/SignIn.jsx'
import { BOOT } from './lib/api.js'
import TabBar from './components/TabBar.jsx'
import ErrorBoundary from './components/ErrorBoundary.jsx'
import Modals from './components/Modals.jsx'
import Toast from './components/Toast.jsx'
import RestTimer from './components/RestTimer.jsx'
import Home from './views/Home.jsx'
import Plan from './views/Plan.jsx'
import RoutineEdit from './views/RoutineEdit.jsx'
import Workout from './views/Workout.jsx'
import Stats from './views/Stats.jsx'
//// Neoffice — les cours collectifs, quand le club en donne.
import Classes from './views/Classes.jsx'
import Challenges from './views/Challenges.jsx'
//// Neoffice — les évaluations physiques du coach.
import Assessments from './views/Assessments.jsx'
import History from './views/History.jsx'
import Library from './views/Library.jsx'
import Settings from './views/Settings.jsx'

bindUI(useUI)   // lets the shared controls open sheets without importing the store at module scope

function applyPrefs(theme, accent) {
  const de = document.documentElement
  de.dataset.theme = theme === 'light' ? 'light' : 'dark'
  de.dataset.accent = ACCENTS[accent] ? accent : 'lime'
  const meta = document.querySelector('meta[name="theme-color"]')
  if (meta) meta.content = de.dataset.theme === 'light' ? '#f2f2f7' : '#000000'
}

function Shell() {
  const navigate = useNavigate()
  const loc = useLocation()
  const { S, user, ready } = useStore()
  const isGuest = useStore(s => s.isGuest())
  const langV = useLang()   // re-renders the whole shell when the language (pack) changes
  useEffect(() => { setNav(navigate) }, [navigate])
  useEffect(() => { applyPrefs(S.theme, S.accent) }, [S.theme, S.accent])
  //// Neoffice — `BOOT.lang` en repli : avant la connexion il n'y a AUCUN état
  //// synchronisé, donc `S.lang` est vide et l'écran de connexion s'affichait
  //// en anglais chez un club romand. Le serveur, lui, connaît la langue du
  //// site — il la transmet dans le boot de l'invité.
  useEffect(() => { setLang(S.lang || BOOT.lang || 'en') }, [S.lang])
  useEffect(() => { document.documentElement.lang = S.lang || 'en' }, [langV, S.lang])
  // every tab/route change starts at the top of the page
  useEffect(() => { window.scrollTo(0, 0) }, [loc.pathname])
  // bound to the workout, not to the route — checking Stats mid-session keeps the screen on
  useWakeLock(!!S.active && S.keepAwake !== false)

  //// Neoffice — il Y A désormais un état non authentifié à rendre. `/gym` ne
  //// renvoie plus l'anonyme sur la page de connexion du desk : il lui sert
  //// l'app, qui affiche son propre écran de connexion. Ce que ça change est
  //// l'apparence, pas l'authentification — le formulaire poste sur
  //// `/api/method/login`. Voir `views/SignIn.jsx`.
  if (BOOT.signed_in === false) return <div id="app"><SignIn /></div>

  const authed = user || isGuest
  if (!ready && !authed) return (
    <div id="app">
      <div style={{ paddingTop: '44vh', display: 'flex', justifyContent: 'center', fontSize: 34, color: 'var(--label-3)' }}>
        <Icon name="dumbbell" />
      </div>
    </div>
  )

  return (
    <>
      {/* keyed on the route: a view that throws is contained, and switching tabs
          re-mounts the boundary, so the tab bar is always a way out */}
      <div id="app" className="vfade" key={loc.pathname}>
        <ErrorBoundary>
          {(
            <Routes>
              <Route path="/home" element={<Home />} />
              <Route path="/plan" element={<Plan />} />
              <Route path="/plan/r/:id" element={<RoutineEdit />} />
              <Route path="/workout" element={<Workout />} />
              <Route path="/stats" element={<Stats />} />
              <Route path="/history" element={<History />} />
              <Route path="/library" element={<Library />} />
          {/* //// Neoffice — cf. views/Classes.jsx */}
          <Route path="/classes" element={<Classes />} />
        {/* //// Neoffice — les défis du club. Même porte que les cours :
            on y arrive depuis l'accueil, pas par un sixième onglet. */}
        <Route path="/challenges" element={<Challenges />} />
          {/* //// Neoffice — cf. views/Assessments.jsx */}
          <Route path="/assessments" element={<Assessments />} />
              <Route path="/settings" element={<Settings />} />
              {/* //// Neoffice — /admin retiré. Le tableau de bord d'openGym
                  listait les profils et les codes d'invitation de son magasin
                  d'utilisateurs Node ; le club gère ses membres, ses coachs et
                  ses abonnements dans le desk Frappe. */}
              <Route path="*" element={<Navigate to="/home" replace />} />
            </Routes>
          )}
        </ErrorBoundary>
      </div>
      <TabBar onStart={startFlow} />
      <RestTimer />
      <Modals />
      <Toast />
    </>
  )
}

export default function App() {
  const boot = useStore(s => s.boot)
  useEffect(() => { boot() }, [boot])
  // Android system back — sheet, then page, then press-again-to-exit (see lib/back.js)
  useEffect(() => {
    let stop = null, gone = false
    initBackButton().then(fn => { if (gone) fn(); else stop = fn })
    return () => { gone = true; stop?.() }
  }, [])
  return <HashRouter><Shell /></HashRouter>
}
