//// Neoffice — added file (no upstream equivalent).
////
//// A signature drawn with a finger, for the membership renewal signed on the
//// phone (views/MembershipGate.jsx). Pointer events, so a mouse works too; the
//// canvas is scaled to the device pixel ratio so the stroke stays crisp in the
//// PNG the club keeps. `onChange(dataUrl | null)` fires after every stroke and
//// on clear — null means "nothing drawn yet".
import React, { useEffect, useRef, useState } from 'react'
import { t } from '../lib/i18n.js'

export default function SignaturePad({ onChange, height = 160 }) {
  const canvasRef = useRef(null)
  const drawing = useRef(false)
  const last = useRef(null)
  const [empty, setEmpty] = useState(true)

  useEffect(() => {
    const c = canvasRef.current
    if (!c) return
    const ratio = window.devicePixelRatio || 1
    const width = c.parentElement ? c.parentElement.clientWidth : 320
    c.width = Math.round(width * ratio)
    c.height = Math.round(height * ratio)
    c.style.width = width + 'px'
    c.style.height = height + 'px'
    const ctx = c.getContext('2d')
    ctx.scale(ratio, ratio)
    ctx.lineWidth = 2.2
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#111'
  }, [height])

  const point = e => {
    const r = canvasRef.current.getBoundingClientRect()
    return { x: e.clientX - r.left, y: e.clientY - r.top }
  }
  const down = e => {
    e.preventDefault()
    drawing.current = true
    last.current = point(e)
    canvasRef.current.setPointerCapture?.(e.pointerId)
  }
  const move = e => {
    if (!drawing.current) return
    e.preventDefault()
    const p = point(e)
    const ctx = canvasRef.current.getContext('2d')
    ctx.beginPath()
    ctx.moveTo(last.current.x, last.current.y)
    ctx.lineTo(p.x, p.y)
    ctx.stroke()
    last.current = p
    if (empty) setEmpty(false)
  }
  const up = () => {
    if (!drawing.current) return
    drawing.current = false
    onChange?.(canvasRef.current.toDataURL('image/png'))
  }
  const clear = () => {
    const c = canvasRef.current
    const ctx = c.getContext('2d')
    ctx.save(); ctx.setTransform(1, 0, 0, 1, 0, 0); ctx.clearRect(0, 0, c.width, c.height); ctx.restore()
    setEmpty(true)
    onChange?.(null)
  }

  return <div className="sigpad">
    <canvas ref={canvasRef} className="sigpad-c" aria-label={t('Signature')}
      onPointerDown={down} onPointerMove={move} onPointerUp={up} onPointerCancel={up} onPointerLeave={up} />
    {empty && <div className="sigpad-hint">{t('Sign here with your finger')}</div>}
    <button type="button" className="sigpad-clear" onClick={clear} disabled={empty}>{t('Clear')}</button>
  </div>
}
