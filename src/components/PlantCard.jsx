import { useEffect, useState } from 'react'
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
  const [touchStart, setTouchStart] = useState(null)
  const [offset, setOffset] = useState(0)
  const [watering, setWatering] = useState(false)
  const [drops, setDrops] = useState([])

  const { level, label, textColor } = hydrationInfo(urgencyScore)
  const dateLabel = formatRelativeDate(nextWateringDate)
  const isUrgent = urgencyScore > 70
  const isMedium = urgencyScore > 40

  const handleTouchStart = (e) => setTouchStart(e.changedTouches[0].clientX)
  const handleTouchMove = (e) => {
    if (touchStart === null) return
    const delta = e.changedTouches[0].clientX - touchStart
    if (delta < 0) setOffset(Math.max(delta, -110))
  }
  const handleTouchEnd = () => {
    if (offset < -80) triggerWater()
    else if (Math.abs(offset) < 12) navigate(`/plant/${plant.id}`)
    setOffset(0)
    setTouchStart(null)
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
      onClick={() => navigate(`/plant/${plant.id}`)}
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
