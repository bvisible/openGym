//// Neoffice — added file (no upstream equivalent) : les cours collectifs.
////
//// Rien du métier n'est ici. Le mode Créneau de Booking gère déjà capacité,
//// séances récurrentes, appel, liste d'attente et remplacement du coach. Cet
//// écran est une PORTE D'ENTRÉE — et c'est là que le montage paie : le membre
//// est DÉJÀ connecté. Il ouvre le carnet, il voit le planning, il s'inscrit en
//// deux touches. Pas de compte à créer, pas de second mot de passe, pas de
//// bascule vers un autre site.
////
//// ON Y ARRIVE PAR DEUX CHEMINS, et c'est voulu : la carte de l'accueil, qui
//// montre le prochain cours sans qu'on aille le chercher, et un ONGLET de la
//// barre du bas (2026-08-25, demande de Jérémy) — l'accueil d'abord, les
//// cours juste après, et le compte tout à droite.
////
//// Ce commentaire disait l'inverse : « un sixième onglet rendrait les libellés
//// illisibles ». Mesuré depuis, plutôt que supposé : à sept colonnes sur un
//// iPhone SE (320 px, le plus étroit), chaque onglet reçoit 45 px et SEUL
//// « Cours collectifs » débordait. D'où deux clés — l'onglet dit « Cours », le
//// titre de l'écran dit « Cours collectifs ».
////
//// L'onglet tient à DEUX conditions : le club propose des cours, et le membre
//// veut les voir (réglage `classesTab`, Réglages → Général).

import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t, dateLocale } from '../lib/i18n.js'
import { classesWeek, classBook, classCancel } from '../lib/api.js'
import { classSheet } from '../sheets.jsx'
import Icon from '../components/Icon.jsx'
import { Button } from '../components/ui.jsx'

const dayKey = iso => (iso || '').slice(0, 10)

//// Neoffice — un cours qu'on PEUT encore prendre. Payant compte comme
//// ouvert : le membre a le choix, simplement il sortira sa carte. Ne compter
//// que le gratuit ferait afficher « rien d'ouvert » à quelqu'un qui a trois
//// cours devant lui.
//// Au niveau module et non dans le composant : le sélecteur de jour s'en sert
//// aussi pour ses points, et deux définitions divergeraient au premier
//// changement.
const takeable = x => !x.booked && !x.past
  && (x.bookable !== false || (x.included === false && x.payUrl))

//// Un prix se lit « 28.– », pas « 28 » ni « 28.00 ». Les décimales ne
//// s'affichent que si elles existent : un cours à 28.50 les mérite, un cours
//// à 28 non.
const fmtPrice = n => Number(n) % 1 === 0
  ? String(Number(n))
  : Number(n).toFixed(2)

export default function Classes() {
  const nav = useNavigate()
  const S = useStore(s => s.S)
  const [data, setData] = useState(null)
  const [busy, setBusy] = useState(null)
  const [error, setError] = useState(null)
  //// Neoffice — le jour regardé. Vide au départ : on se cale sur le premier
  //// jour du planning qui n'est pas passé, pas sur une date en dur.
  const [picked, setPicked] = useState('')

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

  //// Neoffice — le `catch` manquait, et c'est ce que le membre voyait :
  //// RIEN. Une inscription refusée par le serveur laissait l'écran identique
  //// — même bouton, même compteur — parce que la promesse rejetée sautait le
  //// rechargement sans que personne ne l'annonce. Un refus doit se dire : le
  //// serveur explique déjà pourquoi (cours passé, complet, service payant),
  //// il suffit de porter son message à l'écran.
  const act = async (fn, id) => {
    setBusy(id)
    try {
      await fn()
      load()
    } catch (e) {
      useUI.getState().toast(e?.message || t('That did not go through. Try again in a moment.'))
    } finally { setBusy(null) }
  }

  if (error) return <div className="narrow"><Hdr /><div className="card">{error}</div></div>
  if (!data) return <div className="narrow"><Hdr /><div className="card muted">{t('Loading…')}</div></div>
  if (!data.sessions.length) {
    return <div className="narrow"><Hdr />
      <div className="card muted" style={{ lineHeight: 1.5 }}>
        {t('No class published for the next {0} days.', data.horizon)}
      </div></div>
  }

  //// Neoffice — groupé par jour, et on n'en montre QU'UN. Un planning de
  //// salle se lit par journée : on cherche « qu'est-ce qu'il y a mardi », pas
  //// le quatorzième cours d'une liste qui défile. Le sélecteur porte un point
  //// sous chaque jour qui a des cours, donc on voit d'un coup d'œil où
  //// chercher avant même de choisir.
  const byDay = new Map()
  data.sessions.forEach(s => {
    const k = dayKey(s.start)
    if (!byDay.has(k)) byDay.set(k, [])
    byDay.get(k).push(s)
  })
  const days = [...byDay.keys()].sort()

  //// Le jour retenu doit exister dans le planning, sinon un membre qui laisse
  //// l'écran ouvert jusqu'à minuit se retrouve devant un jour vide.
  ////
  //// Et à l'ouverture on se pose sur le premier jour où il reste QUELQUE
  //// CHOSE À PRENDRE, pas sur aujourd'hui : arriver sur une journée vide
  //// oblige à chercher soi-même où sont les cours, ce qui est précisément la
  //// corvée que ce sélecteur doit supprimer. À défaut, le premier jour à
  //// venir — un planning entièrement complet reste un planning à consulter.
  const openOn = d => (byDay.get(d) || []).some(takeable)
  const day = days.includes(picked) ? picked
    : days.find(d => d >= todayKey() && openOn(d))
      || days.find(d => d >= todayKey())
      || days[0]

  const items = byDay.get(day) || []
  const free = items.filter(takeable).length

  return <div className="narrow">
    <Hdr />

    <div className="card" style={{ padding: '10px 8px 8px' }}>
      <DayPicker days={days} day={day} byDay={byDay} onPick={setPicked} />
    </div>

    {/* //// Le jour choisi, en grand. C'était un `h4 className="sec"` gris
         perdu entre deux listes — sur un planning on veut d'abord savoir QUEL
         jour on regarde. */}
    <div className="hdr" style={{ marginTop: 18, marginBottom: 10, alignItems: 'baseline' }}>
      <div>
        <h2 style={{ margin: 0, textTransform: 'capitalize' }}>{longDay(day)}</h2>
        <div className="sub" style={{ marginTop: 2 }}>
          {free > 0
            ? t(free === 1 ? '{0} class open' : '{0} classes open', free)
            : t('nothing open that day')}
        </div>
      </div>
    </div>

    <div className="list" style={{ display: 'flex', flexDirection: 'column' }}>
      {items.map(s => <ClassRow key={s.id} s={s} busy={busy === s.id} act={act} />)}
    </div>
  </div>
}

//// Neoffice — added: le sélecteur de jour.
////
//// Il DÉFILE plutôt que de paginer par semaine — un planning de club tient
//// souvent sur deux semaines, et une pagination fait perdre le fil de ce
//// qu'on cherchait. Les flèches poussent la bande d'un cran ; le doigt fait
//// la même chose sur un téléphone.
////
//// Le MOIS est écrit au-dessus, et il change avec le défilement : « jeu. 3 »
//// tout seul ne dit pas si c'est septembre ou octobre, et c'est précisément
//// ce qu'on cherche à savoir quand on prend rendez-vous à deux semaines.
function DayPicker({ days, day, byDay, onPick }) {
  const strip = useRef(null)
  const [month, setMonth] = useState('')

  //// Le mois affiché est celui du PREMIER jour visible, pas celui du jour
  //// choisi : on lit l'en-tête pour savoir où on est en train de regarder,
  //// pas où on s'est arrêté.
  const refreshMonth = () => {
    const el = strip.current
    if (!el) return
    const left = el.scrollLeft
    let best = days[0]
    for (const child of el.children) {
      if (child.offsetLeft + child.offsetWidth > left + 2) { best = child.dataset.day; break }
    }
    if (best) setMonth(monthLabel(best))
  }
  useEffect(() => { refreshMonth() }, [days.join(',')])

  const push = dir => {
    const el = strip.current
    if (!el) return
    el.scrollBy({ left: dir * Math.max(el.clientWidth * 0.7, 140), behavior: 'smooth' })
    setTimeout(refreshMonth, 320)
  }

  return <>
    <div className="row between" style={{ marginBottom: 6, paddingInline: 2 }}>
      <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 14 }}
        onClick={() => push(-1)} aria-label={t('Earlier')}><Icon name="chevronLeft" /></button>
      <div className="small muted" style={{ fontWeight: 500, textTransform: 'capitalize' }}>{month}</div>
      <button className="iconbtn" style={{ width: 28, height: 28, fontSize: 14 }}
        onClick={() => push(1)} aria-label={t('Later')}><Icon name="chevronRight" /></button>
    </div>
    <div className="daypick" ref={strip} onScroll={refreshMonth}>
      {days.map(d => {
        const n = (byDay.get(d) || []).filter(takeable).length
        const dt = new Date(d + 'T00:00:00')
        return <button key={d} data-day={d} className={'wday' + (d === day ? ' today' : '')} onClick={() => onPick(d)}>
          <div className="lbl">{dt.toLocaleDateString(dateLocale(), { weekday: 'short' })}</div>
          <div className="num">{dt.getDate()}</div>
          {/* Un point quand il reste quelque chose à prendre ce jour-là : c'est
              ce qui évite d'ouvrir les jours un par un. */}
          <div className={'dot' + (n ? ' plan' : '')} />
        </button>
      })}
    </div>
  </>
}

const monthLabel = k => new Date(k + 'T00:00:00').toLocaleDateString(dateLocale(),
  { month: 'long', year: 'numeric' })

const todayKey = () => new Date().toISOString().slice(0, 10)
const longDay = k => new Date(k + 'T00:00:00').toLocaleDateString(dateLocale(),
  { weekday: 'long', day: 'numeric', month: 'long' })

function Hdr() {
  return <div className="hdr">
    {/* //// Neoffice — le TITRE dit « cours collectifs », l'ONGLET dit
         « cours » : sept colonnes ne laissent pas la place à deux mots, et
         l'amont utilise la même clé pour les deux — il n'a que des titres
         courts. Deux clés, donc, une par usage. */}
    <div><h1>{t('Group classes')}</h1><div className="sub">{t('Book in two taps — you are already signed in')}</div></div>
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
    //// Neoffice — une forme par nombre : « noch 1 Plätze frei » en allemand,
    //// « 1 places left » en anglais. Le carnet fait déjà ce partage ailleurs
    //// ({0} routine / {0} routines) — la dernière place d'un cours est
    //// précisément le moment où le membre lit cette ligne.
    //// Neoffice — des places libres ne suffisent pas : le serveur croise avec
    //// la disponibilité réelle (heures d'ouverture, battements, intervenant
    //// pris ailleurs). Une séance qui a lieu mais qu'on ne peut plus réserver
    //// reste AU PLANNING — le membre veut savoir qu'elle existe — mais elle
    //// n'invite plus à s'inscrire.
    //// Neoffice — un cours PAYANT n'est pas un cours fermé. Le membre voyait
    //// « inscriptions closes » sur un cours qu'il pouvait très bien prendre,
    //// simplement en payant — et il ne savait ni que c'était payant, ni
    //// combien. Le prix se dit avant le clic, pas après.
    : s.included === false && s.payUrl
      ? (s.price ? t('{0} {1} — pay to book', fmtPrice(s.price), s.currency || '') : t('paid class'))
    : s.bookable === false ? t('registration closed')
    : t(s.free === 1 ? '{0} place left' : '{0} places left', s.free)

  //// Neoffice — toute la ligne ouvre la fiche, y compris pour un cours
  //// fermé : c'est là qu'on veut savoir ce qu'on a manqué et quand il
  //// repasse. Le bouton, lui, garde son geste — un clic dessus inscrit,
  //// il n'ouvre pas la fiche.
  return <div className="item" style={{ cursor: 'pointer' }} onClick={() => classSheet(s, act)}>
    <span className="lrow-i" style={{ background: s.booked ? 'var(--acc)' : 'var(--surface-3)' }}>
      <Icon name={s.booked ? 'check' : 'calendar'} />
    </span>
    <div className="grow" style={{ minWidth: 0 }}>
      <div className="tt">{time} · {s.title}</div>
      <div className="small dim">{s.coach ? s.coach + ' · ' : ''}{state}</div>
    </div>
    {s.past ? <span className="tag">{t('done')}</span>
      : s.booked
        //// Neoffice — `waiting` plutôt que juste `disabled` : un bouton
        //// simplement grisé ne dit pas si l'application a compris le clic.
        ? <Button size="sm" variant="ghost" disabled={busy} className={busy ? 'waiting' : ''}
            onClick={e => { e.stopPropagation(); act(() => classCancel(s.booking.id), s.id) }}>{t('Cancel')}</Button>
        : (s.included === false && s.payUrl && !s.past)
          //// Le carnet n'encaisse pas : il emmène au guichet. Même onglet,
          //// même session — le membre est déjà connecté, il retombe dans son
          //// panier et pas sur une page de connexion.
          ? <Button size="sm" variant="tinted"
              onClick={e => { e.stopPropagation(); window.location.href = s.payUrl }}>
              {t('Book and pay')}
            </Button>
        : (s.bookable === false && !s.full)
          //// Ni bouton ni faux espoir : la séance a lieu, elle n'est plus
          //// ouverte. Proposer « s'inscrire » ici, c'était le clic qui ne
          //// faisait rien.
          ? <span className="tag">{t('closed')}</span>
          : <Button size="sm" variant={s.full ? 'ghost' : 'tinted'} disabled={busy}
              className={busy ? 'waiting' : ''}
              onClick={e => { e.stopPropagation(); act(() => classBook(s.id), s.id) }}>
              {s.full ? t('Waiting list') : t('Book')}
            </Button>}
  </div>
}
