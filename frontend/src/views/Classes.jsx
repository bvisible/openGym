//// Neoffice — added file (no upstream equivalent) : les cours collectifs.
////
//// Rien du métier n'est ici. Le mode Créneau de Booking gère déjà capacité,
//// séances récurrentes, appel, liste d'attente et remplacement du coach. Cet
//// écran est une PORTE D'ENTRÉE — et c'est là que le montage paie : le membre
//// est DÉJÀ connecté. Il ouvre le carnet, il voit le planning, il s'inscrit en
//// deux touches. Pas de compte à créer, pas de second mot de passe, pas de
//// bascule vers un autre site.
////
//// ÉCART ASSUMÉ AU CAHIER : ce n'est pas un sixième onglet de la barre du bas.
//// Elle en porte déjà cinq plus le bouton central ; un de plus rend les
//// libellés illisibles sur un téléphone. On y arrive par la carte de l'accueil,
//// qui a l'avantage de montrer le prochain cours sans qu'on aille le chercher.

import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { t, dateLocale } from '../lib/i18n.js'
import { classesWeek, classBook, classCancel } from '../lib/api.js'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const dayKey = iso => (iso || '').slice(0, 10)

export default function Classes() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)

  const load = () => {
    classesWeek()
      .then(setData)
      .catch(() => setError(t('The class schedule could not be loaded. Try again once you are back online.')))
  }
  useEffect(load, [])

  // Un club qui n'a pas activé les cours n'a rien à faire ici — et si on y
  // arrive par une URL, on repart plutôt que de montrer une page vide.
  useEffect(() => {
    if (S.perms && S.perms.classes === false) nav('/home', { replace: true })
  }, [S.perms])

  const act = async (fn, id) => {
    setBusy(id)
    try { await fn(); load() } finally { setBusy(null) }
  }

  if (error) return <div className="narrow"><Hdr /><div className="card">{error}</div></div>
  if (!data) return <div className="narrow"><Hdr /><div className="card muted">{t('Loading…')}</div></div>
  if (!data.sessions.length) {
    return <div className="narrow"><Hdr />
      <div className="card muted" style={{ lineHeight: 1.5 }}>
        {t('No class published for the next {0} days.', data.horizon)}
      </div></div>
  }

  // Groupé par jour : un planning de salle se lit par journée, pas en liste
  // continue — on cherche « qu'est-ce qu'il y a mardi », pas le 14e cours.
  const days = []
  data.sessions.forEach(s => {
    const k = dayKey(s.start)
    const last = days[days.length - 1]
    if (last && last.key === k) last.items.push(s)
    else days.push({ key: k, items: [s] })
  })

  return <div className="narrow">
    <Hdr />
    {days.map(d => <div key={d.key}>
      <h4 className="sec">{new Date(d.key).toLocaleDateString(dateLocale(), {
        weekday: 'long', day: 'numeric', month: 'long'
      })}</h4>
      <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
        {d.items.map(s => <ClassRow key={s.id} s={s} busy={busy === s.id} act={act} />)}
      </div>
    </div>)}
  </div>
}

function Hdr() {
  return <div className="hdr">
    <div><h1>{t('Classes')}</h1><div className="sub">{t('Book in two taps — you are already signed in')}</div></div>
  </div>
}

function ClassRow({ s, busy, act }) {
  const time = s.start ? new Date(s.start).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) : ''
  const waiting = s.booking && s.booking.status === 'Waiting'

  // Ce que dit la ligne quand on ne peut PAS s'inscrire compte autant que le
  // bouton : « complet » sans plus laisse le membre fermer l'application.
  const state = s.booked
    ? (waiting ? t('on the waiting list') : t('you are in'))
    : s.full ? t('full — you can join the waiting list')
    : t('{0} places left', s.free)

  return <div className="item">
    <span className="lrow-i" style={{ background: s.booked ? 'var(--acc)' : 'var(--surface-3)' }}>
      <Icon name={s.booked ? 'check' : 'calendar'} />
    </span>
    <div className="grow" style={{ minWidth: 0 }}>
      <div className="tt">{time} · {s.title}</div>
      <div className="small dim">{s.coach ? s.coach + ' · ' : ''}{state}</div>
    </div>
    {s.past ? <span className="tag">{t('done')}</span>
      : s.booked
        ? <Button size="sm" variant="ghost" disabled={busy}
            onClick={() => act(() => classCancel(s.booking.id), s.id)}>{t('Cancel')}</Button>
        : <Button size="sm" variant={s.full ? 'ghost' : 'tinted'} disabled={busy}
            onClick={() => act(() => classBook(s.id), s.id)}>
            {s.full ? t('Waiting list') : t('Book')}
          </Button>}
  </div>
}
