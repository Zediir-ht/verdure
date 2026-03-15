function resolveIcon(code) {
  if ([0, 1].includes(code)) return { emoji: '☀️', cls: 'sun' }
  if ([2, 3, 45, 48].includes(code)) return { emoji: '☁️', cls: 'cloud' }
  if ([51, 53, 55, 61, 63, 65, 80, 81, 82].includes(code)) return { emoji: '🌧️', cls: 'rain' }
  if ([71, 73, 75, 85, 86].includes(code)) return { emoji: '❄️', cls: 'snow' }
  if ([95, 96, 99].includes(code)) return { emoji: '⛈️', cls: 'storm' }
  return { emoji: '🌤️', cls: 'sun' }
}

export default function WeatherIcon({ weatherCode = 0, large = false }) {
  const icon = resolveIcon(weatherCode)
  return (
    <span className={`weather-icon ${icon.cls} ${large ? 'large' : ''}`} aria-hidden="true">
      {icon.emoji}
    </span>
  )
}
