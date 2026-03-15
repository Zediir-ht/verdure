import { useMemo } from 'react'
import { calculateHydricBalance } from '../services/hydricBalance'
import { usePlantsStore } from '../store/usePlantsStore'
import { formatDayLabel } from '../utils/date'

export default function WeatherDetail() {
  const weather = usePlantsStore((s) => s.weatherData)
  const plants = usePlantsStore((s) => s.plants)

  const et0Points = useMemo(() => {
    const data = weather?.daily ?? []
    if (!data.length) return ''
    const max = Math.max(...data.map((d) => d.et0), 1)
    return data
      .map((d, i) => {
        const x = 20 + i * 45
        const y = 120 - (d.et0 / max) * 90
        return `${x},${y}`
      })
      .join(' ')
  }, [weather])

  const precipSeries = [...(weather?.pastDays ?? []), ...(weather?.daily ?? [])]

  const impactPlants = plants.filter((p) => p.location !== 'interieur')

  if (!weather) {
    return (
      <section className="page">
        <p>Météo indisponible pour le moment.</p>
      </section>
    )
  }

  return (
    <section className="page">
      <h2>Détail météo</h2>

      <h3>Prévisions 7 jours</h3>
      <div className="forecast-scroll">
        {weather.daily.map((d) => (
          <article key={d.date} className="forecast-card">
            <p>{formatDayLabel(d.date)}</p>
            <strong>{Math.round(d.tempMax)}° / {Math.round(d.tempMin)}°</strong>
            <small>Pluie: {Math.round(d.precipitation)} mm</small>
            <small>Probabilité: {Math.round(d.precipitationProbability)}%</small>
          </article>
        ))}
      </div>

      <h3>Courbe ET0</h3>
      <svg width="100%" viewBox="0 0 340 140" className="chart-surface" role="img" aria-label="Courbe ET0">
        <polyline points={et0Points} fill="none" stroke="var(--blue)" strokeWidth="4" strokeLinecap="round" />
      </svg>

      <h3>Précipitations (J-3 à J+7)</h3>
      <div className="precip-bars">
        {precipSeries.map((d, i) => (
          <div key={`${d.date}-${i}`} className="precip-item">
            <div className="bar-wrap">
              <div className="bar" style={{ height: `${Math.min(100, d.precipitation * 8)}%` }} />
            </div>
            <small>{formatDayLabel(d.date)}</small>
          </div>
        ))}
      </div>

      <h3>Impact sur tes plantes</h3>
      <ul className="impact-list">
        {impactPlants.length === 0 ? (
          <li>Aucune plante en extérieur ou balcon.</li>
        ) : (
          impactPlants.map((plant) => {
            const hydric = calculateHydricBalance(plant, weather.pastDays, weather.daily)
            return (
              <li key={plant.id}>
                <strong>{plant.emoji} {plant.name}</strong>
                <span>{hydric.forecastImpact}</span>
              </li>
            )
          })
        )}
      </ul>
    </section>
  )
}
