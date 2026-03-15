import WeatherIcon from './WeatherIcon'

export default function Header({ weather, cityName = 'Rodez' }) {
  return (
    <header className="header-glass">
      <div>
        <p className="eyebrow">Verdure</p>
        <h1 className="title-hero">Prends soin de tes plantes</h1>
        <p className="subtitle">{cityName}, France</p>
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
