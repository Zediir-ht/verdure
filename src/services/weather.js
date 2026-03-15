const WEATHER_ENDPOINT = 'https://api.open-meteo.com/v1/forecast'
export const DEFAULT_COORDS = { lat: 44.35, lon: 2.57, city: 'Rodez' }

function buildDailyItems(daily = {}) {
  const {
    time = [],
    precipitation_sum = [],
    et0_fao_evapotranspiration = [],
    temperature_2m_max = [],
    temperature_2m_min = [],
    precipitation_probability_max = [],
  } = daily

  return time.map((date, i) => ({
    date,
    precipitation: Number(precipitation_sum[i] ?? 0),
    et0: Number(et0_fao_evapotranspiration[i] ?? 0),
    tempMax: Number(temperature_2m_max[i] ?? 0),
    tempMin: Number(temperature_2m_min[i] ?? 0),
    precipitationProbability: Number(precipitation_probability_max[i] ?? 0),
  }))
}

function pickCurrentSoilMoisture(hourly = {}) {
  const { time = [], soil_moisture_0_to_1cm: moisture = [] } = hourly
  if (!time.length) return null

  const now = Date.now()
  let bestIdx = 0
  let bestDiff = Number.POSITIVE_INFINITY

  time.forEach((t, i) => {
    const diff = Math.abs(new Date(t).getTime() - now)
    if (diff < bestDiff) {
      bestDiff = diff
      bestIdx = i
    }
  })

  const value = moisture[bestIdx]
  return typeof value === 'number' ? value : null
}

export async function fetchWeather(lat = DEFAULT_COORDS.lat, lon = DEFAULT_COORDS.lon) {
  const params = new URLSearchParams({
    latitude: String(lat),
    longitude: String(lon),
    current:
      'temperature_2m,relative_humidity_2m,precipitation,weather_code,wind_speed_10m,et0_fao_evapotranspiration',
    hourly: 'soil_moisture_0_to_1cm',
    daily:
      'precipitation_sum,et0_fao_evapotranspiration,temperature_2m_max,temperature_2m_min,precipitation_probability_max',
    past_days: '3',
    forecast_days: '7',
    timezone: 'Europe/Paris',
  })

  const response = await fetch(`${WEATHER_ENDPOINT}?${params.toString()}`)
  if (!response.ok) {
    throw new Error('Impossible de récupérer la météo.')
  }

  const data = await response.json()
  const mergedDays = buildDailyItems(data.daily)
  const pastDays = mergedDays.slice(0, 3)
  const daily = mergedDays.slice(3)

  return {
    current: {
      temperature: Number(data.current?.temperature_2m ?? 0),
      humidity: Number(data.current?.relative_humidity_2m ?? 0),
      precipitation: Number(data.current?.precipitation ?? 0),
      weatherCode: Number(data.current?.weather_code ?? 0),
      windSpeed: Number(data.current?.wind_speed_10m ?? 0),
      et0: Number(data.current?.et0_fao_evapotranspiration ?? 0),
      soilMoisture: pickCurrentSoilMoisture(data.hourly),
      time: data.current?.time,
    },
    daily,
    pastDays,
  }
}
