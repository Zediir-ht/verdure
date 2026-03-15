import { useEffect, useState } from 'react'
import { usePlantsStore } from '../../store/usePlantsStore'
import { weatherCodeToDesc } from '../../services/weatherRiskEngine'

const CLAUDE_URL = '/anthropic/v1/messages'

const SUNLIGHT_LABELS = {
  'plein-soleil': 'Plein soleil',
  'mi-ombre': 'Mi-ombre',
  ombre: 'Ombre',
}

const DAY_LABELS_SHORT = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam']

function statusIcon(ideal, actual, type) {
  if (type === 'temp') {
    const [min, max] = ideal
    if (actual >= min && actual <= max) return { icon: '✅', cls: 'ok' }
    if (actual < min - 5 || actual > max + 5) return { icon: '❌', cls: 'bad' }
    return { icon: '⚠️', cls: 'warn' }
  }
  if (type === 'humidity') {
    const [min, max] = ideal
    if (actual >= min && actual <= max) return { icon: '✅', cls: 'ok' }
    if (actual < min - 15 || actual > max + 15) return { icon: '❌', cls: 'bad' }
    return { icon: '⚠️', cls: 'warn' }
  }
  if (type === 'sunlight') {
    if (ideal === actual) return { icon: '✅', cls: 'ok' }
    const sunMap = { 'plein-soleil': 3, 'mi-ombre': 2, ombre: 1 }
    const diff = Math.abs((sunMap[ideal] ?? 2) - (sunMap[actual] ?? 2))
    if (diff >= 2) return { icon: '❌', cls: 'bad' }
    return { icon: '⚠️', cls: 'warn' }
  }
  return { icon: '—', cls: '' }
}

function estimateCurrentSunlight(weatherCode, hour = new Date().getHours()) {
  if (hour < 7 || hour > 20) return 'ombre'
  if (weatherCode <= 1) return 'plein-soleil'
  if (weatherCode <= 3) return 'mi-ombre'
  return 'ombre'
}

async function fetchPlacementAdvice(plant, profile, weather) {
  const apiKey = import.meta.env.VITE_ANTHROPIC_API_KEY
  if (!apiKey) return null

  const cacheKey = `placement_${plant.id}_${new Date().toDateString()}`
  try {
    const cached = sessionStorage.getItem(cacheKey)
    if (cached) return cached

    const desc = weatherCodeToDesc(weather?.current?.weatherCode ?? 0)
    const prompt = `Given ${plant.name} (${plant.latinName ?? ''}) needs ${SUNLIGHT_LABELS[profile.sunlight] ?? profile.sunlight}, ideal temp ${profile.minTemperature}–${profile.maxTemperature}°C, humidity ${profile.idealHumidity?.min}–${profile.idealHumidity?.max}%, current weather: ${weather?.current?.temperature ?? '?'}°C, ${weather?.current?.humidity ?? '?'}% humidity, ${desc}, location set to ${plant.location ?? 'intérieur'}. Give a 2-sentence placement recommendation in French.`

    const res = await fetch(CLAUDE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-20250514',
        max_tokens: 200,
        messages: [{ role: 'user', content: prompt }],
      }),
    })
    if (!res.ok) return null
    const data = await res.json()
    const text = data?.content?.[0]?.text ?? null
    if (text) sessionStorage.setItem(cacheKey, text)
    return text
  } catch {
    return null
  }
}

export default function PlantEnvironment({ plant }) {
  const weather = usePlantsStore((s) => s.weatherData)
  const enrichedProfiles = usePlantsStore((s) => s.enrichedProfiles)
  const profile = enrichedProfiles[plant?.id] ?? null

  const [placementAdvice, setPlacementAdvice] = useState(null)
  const [loadingAdvice, setLoadingAdvice] = useState(false)

  useEffect(() => {
    if (!plant || !profile || !weather) return
    setLoadingAdvice(true)
    fetchPlacementAdvice(plant, profile, weather)
      .then(setPlacementAdvice)
      .finally(() => setLoadingAdvice(false))
  }, [plant?.id, !!profile, !!weather]) // eslint-disable-line react-hooks/exhaustive-deps

  if (!weather) {
    return <div className="env-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div>
  }

  const current = weather.current ?? {}
  const forecast = weather.daily ?? []

  const currentSunlight = estimateCurrentSunlight(current.weatherCode ?? 0)

  // Build comparison rows
  const idealTemp = [profile?.minTemperature ?? 5, profile?.maxTemperature ?? 35]
  const idealHumidity = [profile?.idealHumidity?.min ?? 40, profile?.idealHumidity?.max ?? 70]
  const idealSunlight = profile?.sunlight ?? 'mi-ombre'
  const idealWatering = profile?.baseFrequencyDays?.spring ?? 7

  const rows = [
    {
      label: 'Température',
      ideal: `${idealTemp[0]}–${idealTemp[1]}°C`,
      actual: `${current.temperature?.toFixed(1) ?? '?'}°C`,
      status: statusIcon(idealTemp, current.temperature ?? 20, 'temp'),
    },
    {
      label: 'Humidité air',
      ideal: `${idealHumidity[0]}–${idealHumidity[1]}%`,
      actual: `${current.humidity ?? '?'}%`,
      status: statusIcon(idealHumidity, current.humidity ?? 50, 'humidity'),
    },
    {
      label: 'Ensoleillement',
      ideal: SUNLIGHT_LABELS[idealSunlight] ?? idealSunlight,
      actual: SUNLIGHT_LABELS[currentSunlight],
      status: statusIcon(idealSunlight, currentSunlight, 'sunlight'),
    },
    {
      label: 'Arrosage',
      ideal: `Tous les ${idealWatering}j`,
      actual: plant?.lastWatered
        ? `J+${Math.round((Date.now() - new Date(plant.lastWatered).getTime()) / 86400000)}`
        : 'Jamais',
      status: { icon: '💧', cls: 'ok' },
    },
    {
      label: 'Vent',
      ideal: 'Protégé',
      actual: current.windSpeed ? `${current.windSpeed.toFixed(0)} km/h` : '—',
      status:
        (current.windGusts ?? current.windSpeed ?? 0) > 40
          ? { icon: '⚠️', cls: 'warn' }
          : { icon: '✅', cls: 'ok' },
    },
  ]

  // Weekly forecast impact per day
  const forecastDays = forecast.slice(0, 7)

  return (
    <div className="plant-env">
      {/* Conditions table */}
      <div className="env-section">
        <h4 className="env-section__title">Conditions actuelles vs idéales</h4>
        <div className="env-table">
          <div className="env-table__head">
            <span>Paramètre</span>
            <span>Idéal</span>
            <span>Actuel</span>
            <span>État</span>
          </div>
          {rows.map((row) => (
            <div key={row.label} className={`env-table__row env-row--${row.status.cls}`}>
              <span className="env-row__label">{row.label}</span>
              <span className="env-row__ideal">{row.ideal}</span>
              <span className="env-row__actual">{row.actual}</span>
              <span className="env-row__status">{row.status.icon}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Placement advice */}
      <div className="env-section">
        <h4 className="env-section__title">Recommandation de placement</h4>
        {loadingAdvice ? (
          <div className="env-skeleton"><div className="skeleton-line" /><div className="skeleton-line w-3/4" /></div>
        ) : placementAdvice ? (
          <div className="env-placement-card">
            <span className="env-placement-icon">📍</span>
            <p>{placementAdvice}</p>
          </div>
        ) : (
          <div className="env-placement-card env-placement-card--default">
            <span className="env-placement-icon">📍</span>
            <p>
              {plant?.location === 'exterieur'
                ? 'Plante en extérieur. Vérifiez les alertes météo pour les jours à venir.'
                : plant?.location === 'balcon'
                  ? 'Balcon orienté selon les besoins lumineux de la plante.'
                  : 'Intérieur : placer près d\'une fenêtre adaptée à ses besoins lumineux.'}
            </p>
          </div>
        )}
      </div>

      {/* Weekly forecast */}
      <div className="env-section">
        <h4 className="env-section__title">Impact météo cette semaine</h4>
        <div className="env-forecast">
          {forecastDays.map((day, idx) => {
            const date = new Date(day.date)
            const dayLabel = DAY_LABELS_SHORT[date.getDay()]
            const tooHot = day.tempMax > (profile?.maxTemperature ?? 35)
            const tooCold = day.tempMin < (profile?.minTemperature ?? 3)
            const rainGood = day.precipitation > 3 && plant?.location !== 'interieur'
            let dayClass = 'env-forecast__day'
            if (tooHot || tooCold) dayClass += ' env-day--risk'
            else if (rainGood) dayClass += ' env-day--ok'
            else dayClass += ' env-day--neutral'

            const shouldWater = !rainGood && idx % (profile?.baseFrequencyDays?.summer ?? 7) === 0

            return (
              <div key={day.date} className={dayClass}>
                <span className="env-day__label">{dayLabel}</span>
                <span className="env-day__temp">{day.tempMax?.toFixed(0)}°</span>
                <span className="env-day__drop" title={shouldWater ? 'Arroser' : 'Passer'}>
                  {shouldWater ? '💧' : day.precipitation > 2 ? '🌧️' : '·'}
                </span>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
