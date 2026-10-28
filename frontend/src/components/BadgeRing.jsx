//// Neoffice — added file (no upstream equivalent).
////
//// The progress ring of a badge (home screen and badge case): the arc fills towards the next level, in that level's medal colour (the club's accent
//// for a badge with one level); once every level is reached the ring is full, in the colour of the last medal, and the centre shows the badge's icon
//// instead of the percentage. The percentage is also the accessible label.

import Icon from './Icon.jsx'

const R = 26
const C = 2 * Math.PI * R

export default function BadgeRing({ state, glyph, size = 64, label }) {
  const tone = state.complete ? (state.medal || '') : (state.nextMedal || '')
  return <div className="ring" style={{ width: size, height: size }}>
    <svg width={size} height={size} viewBox="0 0 64 64" role="img" aria-label={label || state.pct + '%'}>
      <circle className="ring-track" cx="32" cy="32" r={R} fill="none" strokeWidth="7" />
      <circle className={'ring-arc' + (tone ? ' ' + tone : '')} cx="32" cy="32" r={R} fill="none" strokeWidth="7" strokeLinecap="round"
        strokeDasharray={(C * state.progress).toFixed(1) + ' ' + C.toFixed(1)} transform="rotate(-90 32 32)" />
    </svg>
    <div className="ring-in" aria-hidden="true">{state.complete ? <Icon name={glyph || 'medal'} /> : <span>{state.pct}%</span>}</div>
  </div>
}
