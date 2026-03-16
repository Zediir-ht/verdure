import WeatherIcon from './WeatherIcon'

export default function Header({ weather, cityName = 'Rodez' }) {
  return (
    <header className="header-glass">
      <div>
        <p className="eyebrow">🌿 Coco et Cam font pousser</p>
        <h1 className="title-hero">On a la main verte…</h1>
        <p className="subtitle">…en théorie 😄 · {cityName}, France</p>
      </div>
      <div className="weather-pill" role="status" aria-live="polite">
        <WeatherIcon weatherCode={weather?.weatherCode} large />
        <div>
          <strong>{Math.round(weather?.temperature ?? 0)}°C</strong>
          <small>Météo actuelle</small>
        </div>
      </div>
    </header>
  )
}
