import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { formatRelativeDate } from '../utils/date'

function scoreColor(score) {
  if (score > 70) return 'var(--red)'
  if (score > 40) return 'var(--amber)'
  return 'var(--green)'
}

export default function PlantCard({ plant, urgencyScore, nextWateringDate, reasoning, onWater }) {
  const navigate = useNavigate()
  const [touchStart, setTouchStart] = useState(0)
  const [offset, setOffset] = useState(0)
  const [drop, setDrop] = useState(false)

  const radius = 24
  const circumference = 2 * Math.PI * radius
  const dash = useMemo(() => circumference * (Math.max(0, Math.min(100, urgencyScore)) / 100), [urgencyScore, circumference])

  const handleTouchStart = (e) => {
    setTouchStart(e.changedTouches[0].clientX)
  }

  const handleTouchMove = (e) => {
    const delta = e.changedTouches[0].clientX - touchStart
    if (delta < 0) {
      setOffset(Math.max(delta, -110))
    }
  }

  const handleTouchEnd = () => {
    if (offset < -80) {
      setDrop(true)
      onWater(plant.id)
      setTimeout(() => setDrop(false), 700)
    } else if (Math.abs(offset) < 12) {
      navigate(`/plant/${plant.id}`)
    }
    setOffset(0)
  }

  return (
    <article
      className="plant-card"
      style={{ transform: `translateX(${offset}px)` }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={() => navigate(`/plant/${plant.id}`)}
    >
      {drop ? <span className="water-drop">💧</span> : null}
      <div className="plant-head">
        <span className="plant-emoji">{plant.emoji}</span>
        <div>
          <h3>{plant.name}</h3>
          <span className="type-badge">{plant.type}</span>
        </div>
      </div>

      <div className="card-row">
        <svg width="64" height="64" viewBox="0 0 64 64" aria-label={`Urgence ${urgencyScore}%`}>
          <circle cx="32" cy="32" r={radius} className="ring-bg" />
          <circle
            cx="32"
            cy="32"
            r={radius}
            className="ring-value"
            stroke={scoreColor(urgencyScore)}
            strokeDasharray={`${dash} ${circumference - dash}`}
          />
          <text x="32" y="36" textAnchor="middle" className="ring-text">
            {urgencyScore}
          </text>
        </svg>

        <div className="plant-meta">
          <p>Prochain arrosage: {formatRelativeDate(nextWateringDate)}</p>
          <p className="reasoning">{reasoning}</p>
        </div>
      </div>
    </article>
  )
}
