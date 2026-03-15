import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { calculateHydricBalance } from '../services/hydricBalance'
import { getPlantDetails } from '../services/plants'
import { usePlantsStore } from '../store/usePlantsStore'
import { formatDayLabel } from '../utils/date'

function barColor(v) {
  if (v < 12) return 'var(--red)'
  if (v < 25) return 'var(--amber)'
  return 'var(--green)'
}

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const plant = usePlantsStore((s) => s.plants.find((p) => p.id === id))
  const weather = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)

  const [info, setInfo] = useState(plant?.info ?? null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [drop, setDrop] = useState(false)

  useEffect(() => {
    let active = true
    if (!plant?.perenualId || info) return

    setLoadingInfo(true)
    getPlantDetails(plant.perenualId)
      .then((payload) => {
        if (active) setInfo(payload)
      })
      .finally(() => {
        if (active) setLoadingInfo(false)
      })

    return () => {
      active = false
    }
  }, [plant?.perenualId, info])

  const balance = useMemo(() => {
    if (!plant) return null
    return calculateHydricBalance(plant, weather?.pastDays ?? [], weather?.daily ?? [])
  }, [plant, weather])

  const chartDays = useMemo(() => {
    const past = (weather?.pastDays ?? []).slice(-3)
    const upcoming = (weather?.daily ?? []).slice(0, 4)
    const merged = [...past, ...upcoming]

    if (!plant) return []

    const coeff = plant.wateringCoefficient || 0.6
    const locationFactor = plant.location === 'exterieur' ? 1 : plant.location === 'balcon' ? 0.5 : 0
    const capacity = plant.potSize === 'large' ? 70 : plant.potSize === 'small' ? 20 : 40

    let running = capacity
    return merged.map((d) => {
      running = running - d.et0 * coeff + d.precipitation * locationFactor
      return {
        date: d.date,
        value: Math.max(0, Math.round(running)),
      }
    })
  }, [weather, plant])

  if (!plant) {
    return (
      <section className="page">
        <p>Plante introuvable.</p>
        <button className="primary-btn" onClick={() => navigate('/')}>
          Retour
        </button>
      </section>
    )
  }

  const chartHeight = 170
  const chartWidth = 320
  const maxValue = Math.max(70, ...chartDays.map((d) => d.value), 1)

  const onWaterNow = () => {
    setDrop(true)
    waterPlant(plant.id)
    setTimeout(() => setDrop(false), 700)
  }

  return (
    <section className="page">
      <div className="hero-card">
        <span className="hero-emoji">{plant.emoji}</span>
        <div>
          <h2>{plant.name}</h2>
          <p className="text-dim">Type: {plant.type}</p>
          {balance ? <p className="text-dim">Urgence: {balance.urgencyScore}%</p> : null}
        </div>
      </div>

      <h3>Bilan hydrique (7 jours)</h3>
      <div className="chart-scroll">
        <svg width={chartWidth} height={chartHeight} className="chart-surface" role="img" aria-label="Bilan hydrique">
          {chartDays.map((d, i) => {
            const barWidth = 34
            const x = 8 + i * 44
            const h = Math.max(8, (d.value / maxValue) * 120)
            const y = 140 - h
            return (
              <g key={d.date}>
                <rect x={x} y={y} width={barWidth} height={h} rx="8" fill={barColor(d.value)} />
                <text x={x + barWidth / 2} y="156" textAnchor="middle" className="chart-label">
                  {formatDayLabel(d.date)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      <h3>Historique d'arrosage</h3>
      <ul className="timeline">
        {(plant.history || []).map((entry, idx) => (
          <li key={`${entry.date}-${idx}`}>
            <strong>{new Date(entry.date).toLocaleDateString('fr-FR')}</strong>
            <span>{entry.action}</span>
          </li>
        ))}
      </ul>

      <h3>Infos plante</h3>
      {loadingInfo ? <p>Chargement…</p> : null}
      {info ? (
        <div className="info-card">
          <p>{info.description}</p>
          <p className="text-dim">Lumière: {(info.sunlight || []).join(', ') || 'Variable'}</p>
          <p className="text-dim">Fréquence d'arrosage: {info.watering}</p>
        </div>
      ) : null}

      <button className="water-btn" onClick={onWaterNow}>
        💧 J'ai arrosé
      </button>
      {drop ? <span className="water-drop detail">💧</span> : null}
    </section>
  )
}
