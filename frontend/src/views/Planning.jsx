//// Neoffice — added file (no upstream equivalent).
////
//// The « Planning » place of the bottom bar (the pilot club, 30.10: classes and plan in one place). One place, two segments at the
//// top, « My sessions | Classes »: this is where a member tells « I make my plan » from « I look at the classes ». It adds nothing of its own to the two screens
//// it holds: views/Plan.jsx is upstream's and is drawn as it is, views/Classes.jsx is ours and only drops its title (`embedded`). A club without classes
//// (or a member who turned them off) gets no segments at all: this component then IS the Plan screen, byte for byte.
//// The segment last used comes back (a per-device convenience, like the Plan screen's own view); `?tab=` names one for a link (/classes redirects here).
import { useSearchParams } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t } from '../lib/i18n.js'
import { Segmented } from '../components/ui.jsx'
import { classesPlaces } from '../lib/nav-model.js'
import { MOBILE } from '../lib/mobile.js'
import { DEMO } from '../lib/demo.js'
import Plan from './Plan.jsx'
import Classes from './Classes.jsx'

export const PLANNING_TAB_KEY = 'gym_planning_tab'
const readTab = () => {
  try { return localStorage.getItem(PLANNING_TAB_KEY) === 'classes' ? 'classes' : 'sessions' } catch { return 'sessions' }
}

export default function Planning() {
  const S = useStore(s => s.S)
  const [params, setParams] = useSearchParams()
  const places = classesPlaces({ mobile: MOBILE, demo: DEMO, perms: S.perms, classesTab: S.classesTab })
  const asked = params.get('tab')
  // A link to the classes shows them even for a member who took the place out of their bar: they asked for them.
  const segmented = places.bar || (places.club && asked === 'classes')
  if (!segmented) return <Plan />

  const tab = asked === 'classes' || asked === 'sessions' ? asked : readTab()
  const pick = value => {
    try { localStorage.setItem(PLANNING_TAB_KEY, value) } catch { /* private mode: the segment just isn't remembered */ }
    setParams({ tab: value }, { replace: true })
  }

  return <div className="planning">
    <div className="narrow">
      <div className="hdr"><div><h1>{t('Planning')}</h1></div></div>
      <Segmented className="planning-seg" value={tab} onChange={pick}
        options={[{ value: 'sessions', label: t('My sessions') }, { value: 'classes', label: t('Classes') }]} />
    </div>
    {tab === 'classes' ? <Classes embedded /> : <Plan />}
  </div>
}
