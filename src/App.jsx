import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AddPlantModal from './components/AddPlantModal'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import AIAdvisor from './pages/AIAdvisor'
import Dashboard from './pages/Dashboard'
import PlantDetail from './pages/PlantDetail'
import Settings from './pages/Settings'
import WeatherDetail from './pages/WeatherDetail'
import { DEFAULT_COORDS, fetchWeather } from './services/weather'
import { usePlantsStore } from './store/usePlantsStore'

function useWeatherBootstrap() {
  const updateWeather = usePlantsStore((s) => s.updateWeather)
  const [cityName, setCityName] = useState(DEFAULT_COORDS.city)
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    let active = true

    async function load(lat, lon, city = DEFAULT_COORDS.city) {
      try {
        setStatus({ loading: true, error: '' })
        const data = await fetchWeather(lat, lon)
        if (!active) return
        setCityName(city)
        updateWeather(data)
        setStatus({ loading: false, error: '' })
      } catch (e) {
        if (!active) return
        setStatus({ loading: false, error: e.message })
      }
    }

    const fallback = () => load(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon, DEFAULT_COORDS.city)

    if (!navigator.geolocation) {
      fallback()
    } else {
      navigator.geolocation.getCurrentPosition(
        (pos) => {
          load(pos.coords.latitude, pos.coords.longitude, 'Ma position')
        },
        () => fallback(),
        { enableHighAccuracy: true, maximumAge: 600000, timeout: 6000 },
      )
    }

    const refresh = setInterval(() => {
      fallback()
    }, 2 * 60 * 60 * 1000)

    return () => {
      active = false
      clearInterval(refresh)
    }
  }, [updateWeather])

  return { cityName, status }
}

export default function App() {
  const weather = usePlantsStore((s) => s.weatherData)
  const location = useLocation()
  const { cityName, status } = useWeatherBootstrap()

  const showHeader = useMemo(() => !location.pathname.startsWith('/add'), [location.pathname])

  return (
    <div className="app-shell">
      {showHeader ? <Header weather={weather?.current} cityName={cityName} /> : null}

      {status.loading && !weather ? <div className="status-banner">Chargement météo…</div> : null}
      {status.error ? <div className="status-banner error">{status.error}</div> : null}

      <main className="content">
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/plants" element={<Dashboard />} />
          <Route path="/plant/:id" element={<PlantDetail />} />
          <Route path="/add" element={<AddPlantModal />} />
          <Route path="/weather" element={<WeatherDetail />} />
          <Route path="/advisor" element={<AIAdvisor />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  )
}
