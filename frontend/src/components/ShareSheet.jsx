//// Neoffice — added file (no upstream equivalent).
////
//// « Share »: ONE sheet for the picture a member posts after a session, in place of the two buttons that used to sit side by side in
//// a workout's detail (« Share this session », « Share as image »). Asked for by the pilot club on 12.10 — several pictures to choose
//// from, a photo of the member with their numbers laid over it, « like Strava » — and by Jérémy on 13.10: one way to share, the
//// member picks what appears, the club's logo and address at the foot of everything.
////
//// Three pictures: PHOTO (the member's own photo, their exercises with the loads and reps over it), NUMBERS (no photo, big figures on a
//// dark ground), MUSCLES (the silhouette card). Two shapes for the first two: FEED (4:5) and STORY (9:16). The choices are kept on the
//// device. The photo is read to make the picture and is never stored, never sent: it lives in this sheet's memory until the sheet
//// closes (Jérémy, 06.10: « ça doit rester en local »).
import { useEffect, useMemo, useRef, useState } from 'react'
import { useStore } from '../store/useStore.js'
import { useUI } from '../store/useUI.js'
import { t } from '../lib/i18n.js'
import { speedUnitOf } from '../lib/speed.js'
import { workoutDay } from '../lib/history.js'
import { todayISO } from '../lib/format.js'
import { Segmented, Switch, Row, Button } from './ui.jsx'
import { mediaErrorText } from './CustomMediaField.jsx'
import { shareChoices } from '../lib/share/model.js'
import { renderShare } from '../lib/share/render.js'
import { renderMuscles } from '../lib/share/muscles.js'
import { workoutCardModel } from '../lib/workout-card.js'
import { sendImage } from '../lib/share/send.js'
import { loadPrefs, savePrefs } from '../lib/share/prefs.js'
import { DEFAULT_FOCUS, coverRect, panFocus } from '../lib/share/frame.js'
import { FORMATS } from '../lib/share/layout.js'

const toast = m => useUI.getState().toast(m)

export default function ShareSheet({ w, nameOf, close }) {
  const st = useStore(s => s.S)
  const update = useStore(s => s.update)
  const unit = st.unit
  const speedUnit = speedUnitOf(st)
  const withMap = st.shareMap !== false
  // The club as the server gives it (name, logo, address, line of information); its name falls back to the title the page was served with.
  const club = useMemo(() => ({
    name: st.club?.name || (typeof window !== 'undefined' && window.gym_boot?.app_title) || '',
    logo: st.club?.logo || '',
    site: st.club?.site || '',
    info: st.club?.info || '',
  }), [st.club])
  const choices = useMemo(() => shareChoices(w, { unit, nameOf, speedUnit }), [w, unit, speedUnit])
  // Whether this workout reached a muscle the silhouette can show: a session of cardio alone has nothing to shade.
  const hasMap = useMemo(() => !!workoutCardModel(w, { unit, nameOf }).levels, [w, unit])

  const [prefs, setPrefsState] = useState(loadPrefs)
  const changePrefs = patch => setPrefsState(prev => { const next = { ...prev, ...patch }; savePrefs(next); return next })
  const { template, format } = prefs
  const picks = useMemo(() => new Set(prefs.picks.filter(k => choices.keys.includes(k))), [prefs.picks, choices])
  const togglePick = k => changePrefs({ picks: prefs.picks.includes(k) ? prefs.picks.filter(x => x !== k) : [...prefs.picks, k] })

  // The member's photo: { source, width, height, close() }, held in memory only.
  const [photo, setPhoto] = useState(null)
  const [photoId, setPhotoId] = useState(0)
  const [focus, setFocus] = useState(DEFAULT_FOCUS)
  const [reading, setReading] = useState(false)
  const photoRef = useRef(null)
  photoRef.current = photo
  useEffect(() => () => { photoRef.current?.close?.() }, [])
  const libraryRef = useRef(null)
  const cameraRef = useRef(null)
  const onFile = async ev => {
    const file = ev.target.files?.[0]
    ev.target.value = ''   // choosing the same file again still fires onChange
    if (!file) return
    setReading(true)
    try {
      // The ingest the app already uses for its own photos: decodes (HEIC included), applies the camera's orientation, shrinks to 1 600 px
      // and drops the location a phone writes into a photo. Its result is used here and never put in the local store.
      const { ingestMediaFile, decodeImage } = await import('../lib/media-ingest.js')
      const out = await ingestMediaFile(file)
      if (out.media.kind === 'video') throw Object.assign(new Error('type'), { code: 'type' })
      const main = out.blobs.find(b => b.hash === out.media.hash) || out.blobs[0]
      const pic = await decodeImage(main.blob, main.mime)
      setPhoto(prev => { prev?.close?.(); return pic })
      setPhotoId(n => n + 1)
      setFocus(DEFAULT_FOCUS)
    } catch (e) {
      toast(mediaErrorText(e))
    } finally {
      setReading(false)
    }
  }

  const base = { w, nameOf, unit, speedUnit, club }
  const onPhoto = template === 'photo' && photo
  const finalType = onPhoto ? 'image/jpeg' : 'image/png'
  const render = (scale, type, quality) => (template === 'muscles'
    ? renderMuscles({ ...base, map: withMap, body: st.body })
    : renderShare({ ...base, picks, template, format, photo: onPhoto ? photo : null, focus, scale, type, quality }))
  const key = JSON.stringify([template, format, [...picks].sort(), withMap, focus, club, photoId, onPhoto ? 1 : 0, unit, st.body])

  // The preview is drawn small and as a JPEG so that dragging the photo stays smooth, and its requests do not wait for each other:
  // while one preview is being drawn only the latest request is kept, drawn as soon as the first is done, so the photo follows the
  // finger instead of jumping when it stops. The picture that is shared is drawn full size a moment after the last change, so that
  // « Share » finds it ready (a browser lets a share start only just after the tap).
  const [img, setImg] = useState(null)
  const shown = useRef(null)
  const ready = useRef({ key: '', blob: null })
  const wanted = useRef(null)
  const drawing = useRef(false)
  const alive = useRef(true)
  useEffect(() => { alive.current = true; return () => { alive.current = false } }, [])
  const drawPreviews = async () => {
    if (drawing.current) return
    drawing.current = true
    try {
      while (wanted.current && alive.current) {
        const job = wanted.current
        wanted.current = null
        let blob = null
        try { blob = await job.run() } catch { blob = null }
        if (!alive.current) return
        if (!blob) { setImg(prev => ({ ...prev, failed: true })); continue }
        if (shown.current) URL.revokeObjectURL(shown.current)
        shown.current = URL.createObjectURL(blob)
        setImg({ url: shown.current })
        // The muscle card has one size: its preview is the picture that is shared.
        if (job.final) ready.current = { key: job.key, blob }
      }
    } finally {
      drawing.current = false
    }
  }
  useEffect(() => {
    wanted.current = { key, final: template === 'muscles', run: () => render(0.5, 'image/jpeg', 0.84) }
    drawPreviews()
  }, [key])
  useEffect(() => {
    if (template === 'muscles') return undefined
    let alive = true
    const timer = setTimeout(async () => {
      let blob = null
      try { blob = await render(1, finalType, 0.92) } catch { blob = null }
      if (alive && blob) ready.current = { key, blob }
    }, 500)
    return () => { alive = false; clearTimeout(timer) }
  }, [key])
  useEffect(() => () => { if (shown.current) URL.revokeObjectURL(shown.current) }, [])

  const [busy, setBusy] = useState(false)
  const name = 'workout-' + (workoutDay(w) || todayISO()) + (template === 'muscles' ? '.png' : onPhoto ? '.jpg' : '.png')
  const share = async () => {
    if (busy) return
    setBusy(true)
    try {
      const blob = ready.current.key === key && ready.current.blob ? ready.current.blob : await render(1, finalType, 0.92)
      if (!blob) { toast(t('Could not create the image')); return }
      const res = await sendImage(blob, name, w.name || '')
      if (res === 'downloaded') toast(t('Image saved'))
      if (res !== 'cancelled') close()
    } finally {
      setBusy(false)
    }
  }

  // Dragging the preview moves the photo under the numbers (the crop is the only thing the member cannot otherwise reach).
  const frameRef = useRef(null)
  const drag = useRef(null)
  const geom = onPhoto ? coverRect(photo.width, photo.height, FORMATS[format].width, FORMATS[format].height, focus) : null
  const movable = !!geom && (geom.overflowX > 1 || geom.overflowY > 1)
  const onDown = e => { if (!movable) return; drag.current = { x: e.clientX, y: e.clientY }; e.currentTarget.setPointerCapture?.(e.pointerId) }
  const onMove = e => {
    if (!drag.current || !geom) return
    const r = frameRef.current?.querySelector('img')?.getBoundingClientRect()
    if (!r || !r.width) return
    const k = FORMATS[format].width / r.width
    const dx = (e.clientX - drag.current.x) * k
    const dy = (e.clientY - drag.current.y) * k
    drag.current = { x: e.clientX, y: e.clientY }
    setFocus(f => panFocus(f, dx, dy, geom))
  }
  const onUp = () => { drag.current = null }

  const rows = [
    ['duration', t('Duration')],
    ['sets', t('Sets')],
    ['volume', t('Weight moved')],
    ['exercises', t('Exercises')],
    ['weights', t('Loads'), t('Shown next to each exercise.')],
    ['records', t('Personal records')],
  ].filter(([k]) => choices.keys.includes(k))

  return <>
    <h3>{t('Share workout')}</h3>
    <Segmented className="share-seg" value={template} onChange={v => changePrefs({ template: v })}
      options={[{ value: 'photo', label: t('Photo'), icon: 'camera' }, { value: 'numbers', label: t('Numbers'), icon: 'chart' }, { value: 'muscles', label: t('Muscles'), icon: 'figureStrength' }]} />
    {/* A photo that moves under the finger is dragged DOWN as often as sideways: the sheet's own pull-to-dismiss (components/Modals.jsx) must
        leave the gesture alone while the frame is movable, or one downward drag of the photo closes the sheet (`data-nodrag` is its opt-out). */}
    <div ref={frameRef} className={'share-card' + (movable ? ' movable' : '')} data-swipe-ignore data-nodrag={movable ? '' : undefined}
      onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      {img?.url
        ? <img src={img.url} alt={t('Preview of the image to share')} draggable={false} />
        : img?.failed ? <div className="share-card-ph small muted">{t('Could not create the image')}</div>
          : <div className="share-card-ph" aria-hidden="true" />}
      {template === 'photo' && !photo && <div className="share-ask">
        <div className="share-ask-t">{t('Add a photo to start')}</div>
      </div>}
    </div>
    {template === 'photo' && <>
      <div className="share-photo-btns">
        <Button size="sm" icon="camera" disabled={reading} onClick={() => cameraRef.current?.click()}>{reading ? t('Loading…') : t('Take a photo')}</Button>
        <Button size="sm" icon="image" disabled={reading} onClick={() => libraryRef.current?.click()}>{t('Choose a photo')}</Button>
      </div>
      <input ref={cameraRef} type="file" accept="image/*" capture="user" hidden onChange={onFile} />
      <input ref={libraryRef} type="file" accept="image/*" hidden onChange={onFile} />
      <div className="small dim share-note">{movable ? t('Drag the picture to move the photo.') + ' ' : ''}{t('Your photo stays on this phone: it is not saved anywhere.')}</div>
    </>}
    {template !== 'muscles' && <div className="share-format">
      <Segmented value={format} onChange={v => changePrefs({ format: v })}
        options={[{ value: 'feed', label: t('Feed') + ' 4:5' }, { value: 'story', label: t('Story') + ' 9:16' }]} />
    </div>}
    {template === 'muscles'
      ? hasMap && <div className="sect-b" style={{ marginBottom: 12 }}>
        <Row icon="figureStrength" iconTint="var(--acc)" title={t('Muscle map')} subtitle={t('Show which muscles this workout trained.')}>
          <Switch checked={withMap} aria-label={t('Muscle map')} onChange={v => update(s => { s.shareMap = v })} />
        </Row>
      </div>
      : rows.length > 0 && <>
        <div className="small muted share-h">{t('What appears')}</div>
        <div className="sect-b" style={{ marginBottom: 12 }}>
          {rows.filter(([k]) => k !== 'weights' || picks.has('exercises')).map(([k, title, hint]) => (
            <Row key={k} title={title} subtitle={hint || choices.values[k]}>
              <Switch checked={picks.has(k)} aria-label={title} onChange={() => togglePick(k)} />
            </Row>
          ))}
        </div>
      </>}
    <Button variant="primary" icon="share" disabled={!img?.url || busy} onClick={share}>{t('Share')}</Button>
  </>
}
