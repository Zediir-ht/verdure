import WeatherIcon from './WeatherIcon'

export default function Header({ weather, cityName = 'Rodez' }) {
  const temp = Math.round(weather?.temperature ?? 0)
  const humidity = weather?.humidity
  const wind = weather?.windSpeed ? Math.round(weather.windSpeed) : null

  return (
    <header className="header-glass">
      <div>
        <p className="eyebrow">🌿 Verdure · {cityName}</p>
        <h1 className="title-hero">Coco & Cam</h1>
        <p className="subtitle">Votre jardin d'intérieur, suivi avec soin</p>
      </div>
      <div className="weather-pill" role="status" aria-live="polite">
        <WeatherIcon weatherCode={weather?.weatherCode} large />
        <div>
          <strong>{temp}°C</strong>
          <small>
            {humidity != null ? `${humidity}% hum.` : 'Météo locale'}
            {wind != null ? ` · ${wind} km/h` : ''}
          </small>
        </div>
      </div>
    </header>
  )
}
