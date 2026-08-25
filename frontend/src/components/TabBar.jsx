import { useLocation, useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { effectiveRoutine } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { t } from '../lib/i18n.js'
import Icon from './Icon.jsx'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'

export default function TabBar({ onStart }) {
  const nav = useNavigate()
  const loc = useLocation()
  const S = useStore(s => s.S)
  const user = useStore(s => s.user)
  const isGuest = useStore(s => s.isGuest())
  if (!user && !isGuest) return null
  const cur = loc.pathname.split('/')[1] || 'home'
  const on = k => cur === k || (cur === 'history' && k === 'stats')

  //// Neoffice — l'onglet des cours tient à TROIS conditions, et il faut les
  //// trois : il y a un club derrière (les versions mobile autonome et démo
  //// n'ont AUCUN serveur — l'onglet y mènerait à un écran qui ne peut rien
  //// charger), ce club propose des cours (perms.classes), et ce membre veut
  //// les voir (classesTab, son réglage). Un club sans cours ne montre rien à
  //// personne ; un membre qui n'y va jamais s'en débarrasse pour lui seul.
  //// Par défaut à vrai : `!== false` plutôt que `=== true`, sinon l'onglet
  //// disparaîtrait le temps que l'état arrive du serveur.
  const showClasses = !MOBILE && !DEMO && S.perms?.classes !== false && S.classesTab !== false

  const startWorkout = () => {
    if (!S.active) {
      const r = effectiveRoutine(S, todayISO())
      if (r && r.ex.length) { onStart(r.id); return }
    }
    nav('/workout')
  }
  const Tab = ({ k, icon, to, label }) => (
    <button className={on(k) ? 'on' : ''} onClick={() => nav(to)}>
      <Icon name={icon} /><span>{label}</span>
    </button>
  )

  return (
    //// Neoffice — `data-tabs` porte le nombre de colonnes : à sept, les
    //// libellés doivent rétrécir pour ne pas se couper au milieu d'un mot.
    <nav id="tabbar" data-tabs={showClasses ? 7 : 6}>
      <Tab k="home" icon="house" to="/home" label={t('Home')} />
      {showClasses && <Tab k="classes" icon="calendar" to="/classes" label={t('Classes')} />}
      {/* //// Neoffice — le plan passe de `calendar` à `clipboard` : les cours
           SONT un calendrier, et deux onglets voisins portant la même icône se
           confondent. C'est déjà l'icône de l'écran Plan quand il est vide. */}
      <Tab k="plan" icon="clipboard" to="/plan" label={t('Plan')} />
      <button className={'start' + (S.active ? ' rec' : '')} onClick={startWorkout}>
        <span className="cir"><Icon name={S.active ? 'play' : 'dumbbell'} /></span>
        <span>{S.active ? t('Resume') : t('Start')}</span>
      </button>
      <Tab k="stats" icon="chart" to="/stats" label={t('Stats')} />
      <Tab k="library" icon="list" to="/library" label={t('Exercises')} />
      {/* //// Neoffice — le compte, tout à droite. Les réglages étaient déjà
           joignables par l'engrenage de l'accueil ; l'onglet leur donne une
           place fixe, et équilibre la barre en fin de course.
           L'accueil reste le PREMIER onglet (correction de Jérémy,
           2026-08-25) : c'est le point de départ, les cours viennent après. */}
      <Tab k="settings" icon="personCircle" to="/settings" label={t('Account')} />
    </nav>
  )
}
