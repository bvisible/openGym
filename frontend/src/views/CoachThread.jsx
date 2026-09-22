//// Neoffice — added file (no upstream equivalent).
////
//// « ÉCRIRE À MON COACH », chez nous (Jérémy, 22.09 : *"c'est à nous de faire
//// un header qui n'est pas un header Neoffice, et c'est ultra important que
//// les autres membres ne se voient pas entre eux"*).
////
//// The conversation used to happen in the team messenger, which a member
//// reached by LEAVING the journal. Two things came with that, both seen on
//// screen: the member could list every person on the instance, and the
//// messenger's page carries the desk shell — after an upgrade a customer
//// landed on the club's Sales and Accounting menu, with a blank page on a
//// phone.
////
//// Here the screen is ours: our header, our back, our colours. And there is
//// nothing to compartmentalise after the fact — `api/chat.py` resolves the
//// thread from the session and takes no recipient, so a member has no way to
//// name anybody.
import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { coachThread, coachThreadPost } from '../lib/api.js'
import { askable, wordItForCoach } from '../lib/coach-ask.js'
import { Button } from '../components/ui.jsx'
import Icon from '../components/Icon.jsx'
import { t, dateLocale } from '../lib/i18n.js'

//: A day separator the way a phone shows one: today and yesterday by name,
//: the rest by date. The list is short, so this is the whole of its structure.
const dayLabel = iso => {
  const d = new Date(iso)
  const today = new Date()
  const same = (a, b) => a.toDateString() === b.toDateString()
  const yesterday = new Date(today.getTime() - 86400000)
  if (same(d, today)) return t('Today')
  if (same(d, yesterday)) return t('Yesterday')
  try { return d.toLocaleDateString(dateLocale(), { day: 'numeric', month: 'long' }) } catch { return iso.slice(0, 10) }
}

const clock = iso => {
  try { return new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

export default function CoachThread() {
  const nav = useNavigate()
  const [state, setState] = useState({ loading: true, coach: null, messages: [] })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [wording, setWording] = useState(false)
  const [failed, setFailed] = useState('')
  const foot = useRef(null)
  const helped = askable('messageCoach')

  const load = async ({ quiet } = {}) => {
    try {
      const r = await coachThread()
      setState({ loading: false, coach: r.coach, messages: r.messages || [] })
      setFailed('')
    } catch (e) {
      if (!quiet) setFailed(e.message || t('This could not be read.'))
      setState(s => ({ ...s, loading: false }))
    }
  }

  useEffect(() => {
    load()
    //: The coach answers from the desk while the member has the screen open.
    //: Thirty seconds is the journal's own rhythm for the same reason.
    const tick = setInterval(() => load({ quiet: true }), 30000)
    const wake = () => { if (!document.hidden) load({ quiet: true }) }
    document.addEventListener('visibilitychange', wake)
    return () => { clearInterval(tick); document.removeEventListener('visibilitychange', wake) }
  }, [])

  //: Newest at the bottom, like every conversation anybody has ever used.
  useEffect(() => { foot.current?.scrollIntoView({ block: 'end' }) }, [state.messages.length])

  const send = async () => {
    const body = text.trim()
    if (!body) return
    setBusy(true)
    try {
      await coachThreadPost(body)
      setText('')
      await load()
    } catch (e) {
      setFailed(e.message || t('Could not open the conversation.'))
    }
    setBusy(false)
  }

  const wordIt = async () => {
    setWording(true)
    try {
      setText(await wordItForCoach(text))
    } catch (e) {
      setFailed(e.message || t('The Coach could not be reached. Try again in a moment.'))
    }
    setWording(false)
  }

  const title = state.coach?.name || t('Your coach')
  let lastDay = ''

  return <div className="thread-page">
    {/* //// OUR header, not the desk's: a way back, the name of the person
        //// being written to, and nothing else. No club menu, no app switcher,
        //// nothing a member has no business seeing. */}
    <div className="hdr thread-hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div style={{ flex: 1, marginLeft: 10, minWidth: 0 }}>
        <h1 className="thread-title">{title}</h1>
        <div className="small dim">{t('Your club answers here')}</div>
      </div>
    </div>

    <div className="thread-body">
      {state.loading && <div className="muted" style={{ padding: '12px 0' }}>{t('Loading…')}</div>}
      {!state.loading && !state.messages.length && !failed && <div className="thread-empty">
        <Icon name="bell" />
        <p>{t('Nothing said yet. Ask what you like — your coach answers here.')}</p>
      </div>}
      {state.messages.map(m => {
        const day = dayLabel(m.at)
        const show = day !== lastDay
        lastDay = day
        return <div key={m.name}>
          {show && <div className="thread-day">{day}</div>}
          <div className={'bubble ' + (m.mine ? 'mine' : 'theirs')}>
            {!m.mine && <div className="bubble-who">{m.senderName}</div>}
            {!!m.attachment && <img className="bubble-img" src={m.attachment} alt="" />}
            {!!m.body && <div className="bubble-text">{m.body}</div>}
            <div className="bubble-at">{clock(m.at)}</div>
          </div>
        </div>
      })}
      {!!failed && <div className="exnote">{failed}</div>}
      <div ref={foot} />
    </div>

    <div className="thread-composer">
      <textarea className="input" rows={1} value={text} maxLength={4000} disabled={busy || wording}
        placeholder={t('What would you like to ask?')}
        onChange={e => setText(e.target.value)}
        onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
      <div className="thread-actions">
        {helped && <Button icon="sparkles" disabled={busy || wording || !text.trim()} onClick={wordIt}>
          {wording ? t('The Coach is writing…') : t('Help me word it')}
        </Button>}
        <Button variant="primary" icon="bell" disabled={busy || wording || !text.trim()} onClick={send}>
          {busy ? t('Sending…') : t('Send')}
        </Button>
      </div>
    </div>
  </div>
}
