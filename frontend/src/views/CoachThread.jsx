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
////
//// It wears the SAME shell as the Coach chat (`.chat`, `.chat-hdr`, `.msgs`,
//// `.composer` in coach.css), because the app already solved a conversation
//// on a phone once: a title bar that eats the status bar, a composer fixed
//// above the home indicator, and the tab bar hidden so the two never fight
//// for the bottom of the screen. Only what a two-party thread adds is new
//// here — a day separator, who spoke, and a photo in a bubble.
import { Fragment, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { coachThread, coachThreadPost } from '../lib/api.js'
import { askable, wordItForCoach } from '../lib/coach-ask.js'
import Icon from '../components/Icon.jsx'
import { t, dateLocale } from '../lib/i18n.js'
import '../coach.css'

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

//: The server refuses above this (`MAX_PHOTO` in api/chat.py). Kept in step by
//: hand rather than fetched: a number the screen shows before uploading eight
//: megabytes is worth more than one more boot call.
const MAX_PHOTO = 8 * 1024 * 1024

const clock = iso => {
  try { return new Date(iso).toLocaleTimeString(dateLocale(), { hour: '2-digit', minute: '2-digit' }) } catch { return '' }
}

//: Initials rather than the Coach's spark: the person on the other side is a
//: human being from the club, and the avatar is the first thing that says so.
const initials = name => (name || '').trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase()

export default function CoachThread() {
  const nav = useNavigate()
  const [state, setState] = useState({ loading: true, coach: null, messages: [] })
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [wording, setWording] = useState(false)
  const [failed, setFailed] = useState('')
  const [photo, setPhoto] = useState(null)
  const [preview, setPreview] = useState('')
  const picker = useRef(null)
  const helped = askable('messageCoach')

  //: The preview is a blob URL, so it is revoked when the photo changes or the
  //: screen closes — otherwise every shot a member takes stays in memory for
  //: as long as they keep the conversation open.
  useEffect(() => {
    if (!photo) return
    const url = URL.createObjectURL(photo)
    setPreview(url)
    return () => URL.revokeObjectURL(url)
  }, [photo])

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

  //: Newest at the bottom, like every conversation anybody has ever used —
  //: and to the PAGE's end, not to the marker. `scrollIntoView` puts the
  //: marker at the bottom of the viewport, which is behind the composer fixed
  //: over it: measured, the last message ended up under it. The page's own
  //: bottom padding is what clears the composer, so the end of the page is
  //: the target that shows the whole of the last message.
  const toEnd = () => { const el = document.scrollingElement; if (el) el.scrollTop = el.scrollHeight }
  useEffect(toEnd, [state.messages.length])

  const send = async () => {
    const body = text.trim()
    //: A photo on its own is a message — somebody showing a machine or a sore
    //: knee usually has nothing to add to it.
    if (!body && !photo) return
    setBusy(true)
    try {
      await coachThreadPost(body, photo)
      setText('')
      setPhoto(null)
      setPreview('')
      await load()
    } catch (e) {
      setFailed(e.message || t('Could not open the conversation.'))
    }
    setBusy(false)
  }

  //: Checked here as well as on the server, only so the member is told before
  //: waiting for an upload. The server's own refusal is the one that counts.
  const pick = e => {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!/^image\//.test(file.type)) return setFailed(t('Only a photo can be sent here.'))
    if (file.size > MAX_PHOTO) return setFailed(t('That photo is too large. Take it again or send a smaller one.'))
    setFailed('')
    setPhoto(file)
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

  return <div className="narrow chat">
    {/* //// OUR header, not the desk's: a way back, the name of the person
        //// being written to, and nothing else. No club menu, no app switcher,
        //// nothing a member has no business seeing. */}
    <div className="chat-hdr">
      <button className="iconbtn" onClick={() => nav('/settings')} aria-label={t('Back')}><Icon name="chevronLeft" /></button>
      <div className="chat-av who">{initials(title) || <Icon name="person" />}</div>
      <div className="grow">
        <h1>{title}</h1>
        <div className="chat-st">{t('Your club answers here')}</div>
      </div>
    </div>

    <div className="msgs">
      {state.loading && <div className="msg sys"><div className="bub sys">{t('Loading…')}</div></div>}
      {!state.loading && !state.messages.length && !failed && <div className="msg sys">
        <div className="bub sys">{t('Nothing said yet. Ask what you like — your coach answers here.')}</div>
      </div>}

      {state.messages.map(m => {
        const day = dayLabel(m.at)
        const show = day !== lastDay
        lastDay = day
        //: A Fragment, not a wrapper: `.msgs` is the flex column that puts a
        //: member's bubble on the right and the coach's on the left, and a
        //: <div> in between would take that alignment away from both.
        return <Fragment key={m.name}>
          {show && <div className="msg-day">{day}</div>}
          <div className={'msg ' + (m.mine ? 'user' : 'coach')}>
            {/* //// A photo sent on its own IS the message: the bubble hugs it
                //// instead of framing it, the way a phone shows a picture. A
                //// photo with words keeps the bubble, since the words need it. */}
            <div className={'bub' + (m.attachment && !m.body ? ' photo' : '')}>
              {!m.mine && <div className="bub-who">{m.senderName}</div>}
              {/* //// Scrolled again when the picture lands: a photo has no
                  //// height until it is decoded, so the first scroll stopped
                  //// short and the newest message sat below the fold. */}
              {!!m.attachment && <img className="bub-img" src={m.attachment} alt=""
                onLoad={toEnd} />}
              {m.body}
            </div>
            <div className="msg-t">{clock(m.at)}</div>
          </div>
        </Fragment>
      })}

      {!!failed && <div className="msg coach"><div className="bub err">{failed}</div></div>}
    </div>

    <div className="composer">
      {helped && !!text.trim() && <div className="chips-row">
        <button className="qchip" onClick={wordIt} disabled={busy || wording}>
          <Icon name="sparkles" />{wording ? t('The Coach is writing…') : t('Help me word it')}
        </button>
      </div>}
      {!!preview && <div className="photo-pick">
        <img src={preview} alt="" />
        <button className="iconbtn photo-drop" onClick={() => setPhoto(null)} aria-label={t('Remove the photo')}>
          <Icon name="xmark" />
        </button>
      </div>}
      <div className="composer-in">
        {/* //// `capture` is left off on purpose: on a phone the sheet then
            //// offers the camera AND the gallery, and most of what a member
            //// sends is a screenshot or a photo they already took. */}
        <input ref={picker} type="file" accept="image/*" hidden onChange={pick} />
        <button className="send ghost" onClick={() => picker.current?.click()} disabled={busy || wording}
          aria-label={t('Add a photo')}><Icon name="camera" /></button>
        <textarea rows={1} value={text} maxLength={4000} disabled={busy || wording}
          placeholder={t('What would you like to ask?')}
          onChange={e => setText(e.target.value)}
          onKeyDown={e => { if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send() } }} />
        <button className="send" onClick={send} disabled={(!text.trim() && !photo) || busy || wording} aria-label={t('Send')}>
          <Icon name="arrowUp" />
        </button>
      </div>
    </div>
  </div>
}
