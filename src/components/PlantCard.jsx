import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatRelativeDate } from '../utils/date'

function hydrationInfo(urgencyScore) {
  const level = Math.max(0, 100 - urgencyScore)
  if (level > 60) return { level, from: '#4ade80', to: '#16a34a', label: 'Bien hydratée', textColor: 'var(--green)' }
  if (level > 30) return { level, from: '#fde68a', to: '#f59e0b', label: 'À surveiller', textColor: 'var(--amber)' }
  return { level, from: '#fca5a5', to: '#ef4444', label: 'Assoiffée !', textColor: 'var(--red)' }
}

function WaterBar({ urgencyScore }) {
  const { level, from, to } = hydrationInfo(urgencyScore)
  const [width, setWidth] = useState(0)

  useEffect(() => {
    const t = setTimeout(() => setWidth(level), 120)
    return () => clearTimeout(t)
  }, [level])

  return (
    <div className="water-bar-track">
      <div
        className="water-bar-fill"
        style={{
          width: `${width}%`,
          background: `linear-gradient(90deg, ${from}, ${to})`,
        }}
      >
        <div className="water-bar-shimmer" />
      </div>
    </div>
  )
}

export default function PlantCard({ plant, urgencyScore, nextWateringDate, reasoning, onWater }) {
  const navigate = useNavigate()
  const touchRef = useRef(null)   // { x, y } at touchstart
  const scrolledRef = useRef(false) // true if vertical movement > threshold
  const mouseRef = useRef(null)   // { x, y } at mousedown
  const [offset, setOffset] = useState(0)
  const [watering, setWatering] = useState(false)
  const [drops, setDrops] = useState([])

  const { level, label, textColor } = hydrationInfo(urgencyScore)
  const dateLabel = formatRelativeDate(nextWateringDate)
  const isUrgent = urgencyScore > 70
  const isMedium = urgencyScore > 40

  // ── Touch handlers (mobile) ──────────────────────────────────────────────
  const handleTouchStart = (e) => {
    const t = e.changedTouches[0]
    touchRef.current = { x: t.clientX, y: t.clientY }
    scrolledRef.current = false
    setOffset(0)
  }

  const handleTouchMove = (e) => {
    if (!touchRef.current) return
    const dx = e.changedTouches[0].clientX - touchRef.current.x
    const dy = e.changedTouches[0].clientY - touchRef.current.y
    // If vertical movement > 8px → user is scrolling, bail out entirely
    if (Math.abs(dy) > 8) {
      scrolledRef.current = true
      setOffset(0)
      return
    }
    if (dx < 0) setOffset(Math.max(dx, -110))
  }

  const handleTouchEnd = () => {
    const ts = touchRef.current
    const scrolled = scrolledRef.current
    touchRef.current = null
    scrolledRef.current = false

    if (scrolled) { setOffset(0); return }

    if (offset < -80) {
      triggerWater()
    } else if (ts && Math.abs(offset) < 12) {
      navigate(`/plant/${plant.id}`)
    }
    setOffset(0)
  }

  // ── Mouse handlers (desktop) ─────────────────────────────────────────────
  const handleMouseDown = (e) => {
    mouseRef.current = { x: e.clientX, y: e.clientY }
  }

  const handleMouseUp = (e) => {
    if (!mouseRef.current) return
    const dx = Math.abs(e.clientX - mouseRef.current.x)
    const dy = Math.abs(e.clientY - mouseRef.current.y)
    mouseRef.current = null
    // Only navigate if mouse barely moved (real click, not drag-select)
    if (dx < 5 && dy < 5) navigate(`/plant/${plant.id}`)
  }

  const triggerWater = () => {
    setWatering(true)
    onWater(plant.id)
    const newDrops = Array.from({ length: 6 }, (_, i) => ({
      id: Date.now() + i,
      x: 30 + Math.random() * 40,
      delay: i * 80,
    }))
    setDrops(newDrops)
    setTimeout(() => { setWatering(false); setDrops([]) }, 900)
  }

  return (
    <article
      className={`plant-card-v2${watering ? ' watering' : ''}`}
      style={{ transform: `translateX(${offset}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      {drops.map((d) => (
        <span
          key={d.id}
          className="drop-burst"
          style={{ left: `${d.x}%`, animationDelay: `${d.delay}ms` }}
        >💧</span>
      ))}

      {/* Header */}
      <div className="pcv2-header">
        <div className="pcv2-emoji-wrap">
          <span className="pcv2-emoji">{plant.emoji}</span>
        </div>
        <div className="pcv2-info">
          <h3 className="pcv2-name">{plant.name}</h3>
          <div className="pcv2-tags">
            <span className="pcv2-tag">{plant.type}</span>
            <span className="pcv2-tag pcv2-tag-loc">📍 {plant.location}</span>
          </div>
        </div>
        <div className="pcv2-urgency-badge" style={{ color: textColor }}>
          <span className="pcv2-urgency-dot" style={{ background: textColor }} />
          {label}
        </div>
      </div>

      {/* Water bar */}
      <div className="pcv2-bar-section">
        <div className="pcv2-bar-header">
          <span className="pcv2-bar-label">💧 Hydratation du sol</span>
          <span className="pcv2-bar-pct" style={{ color: textColor }}>{level}%</span>
        </div>
        <WaterBar urgencyScore={urgencyScore} />
      </div>

      {/* Footer */}
      <div className="pcv2-footer">
        <div
          className="pcv2-date-pill"
          style={{
            background: isUrgent ? 'rgba(239,68,68,0.08)' : isMedium ? 'rgba(245,158,11,0.08)' : 'rgba(46,139,87,0.08)',
            color: textColor,
            borderColor: isUrgent ? 'rgba(239,68,68,0.25)' : isMedium ? 'rgba(245,158,11,0.25)' : 'rgba(46,139,87,0.25)',
          }}
        >
          ⏱ {dateLabel}
        </div>
        <button
          className="pcv2-water-btn"
          onClick={(e) => { e.stopPropagation(); triggerWater() }}
          aria-label="Arroser maintenant"
        >
          💧 J'arrose
        </button>
      </div>
    </article>
  )
}
