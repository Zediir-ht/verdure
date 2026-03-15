import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import AddPlantModal from './components/AddPlantModal'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import AlertCenter from './components/alerts/AlertCenter'
import AIAdvisor from './pages/AIAdvisor'
import Dashboard from './pages/Dashboard'
import PlantDetail from './pages/PlantDetail'
import Settings from './pages/Settings'
import WeatherDetail from './pages/WeatherDetail'
import { DEFAULT_COORDS, fetchWeather } from './services/weather'
import { requestNotificationPermission, scheduleDailyNotifications, notifyCriticalRisks } from './services/notifications'
import { usePlantsStore } from './store/usePlantsStore'

function useWeatherBootstrap() {
  const updateWeather = usePlantsStore((s) => s.updateWeather)
  const refreshRisks = usePlantsStore((s) => s.refreshRisks)
  const enrichAllPlants = usePlantsStore((s) => s.enrichAllPlants)
  const lastWeatherFetch = usePlantsStore((s) => s.lastWeatherFetch)
  const [cityName, setCityName] = useState(DEFAULT_COORDS.city)
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    let active = true

    async function load() {
      try {
        setStatus({ loading: true, error: '' })
        const data = await fetchWeather(DEFAULT_COORDS.lat, DEFAULT_COORDS.lon)
        if (!active) return
        setCityName(DEFAULT_COORDS.city)
        updateWeather(data)
        refreshRisks()
        setStatus({ loading: false, error: '' })
      } catch (e) {
        if (!active) return
        setStatus({ loading: false, error: e.message })
      }
    }

    load()

    // Refresh every 2 hours
    const refresh = setInterval(load, 2 * 60 * 60 * 1000)

    // Refresh on tab focus if last fetch > 1h ago
    function onVisibilityChange() {
      if (document.visibilityState !== 'visible') return
      const hourAgo = Date.now() - 60 * 60 * 1000
      const lastFetch = lastWeatherFetch ? new Date(lastWeatherFetch).getTime() : 0
      if (lastFetch < hourAgo) load()
    }

    document.addEventListener('visibilitychange', onVisibilityChange)

    // Tell SW to start background refresh
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.ready.then((reg) => {
        reg.active?.postMessage({ type: 'START_WEATHER_REFRESH' })
      })
      // Listen for SW-triggered refresh
      navigator.serviceWorker.addEventListener('message', (e) => {
        if (e.data?.type === 'REFRESH_WEATHER') load()
      })
    }

    return () => {
      active = false
      clearInterval(refresh)
      document.removeEventListener('visibilitychange', onVisibilityChange)
    }
  }, [updateWeather, refreshRisks]) // eslint-disable-line react-hooks/exhaustive-deps

  return { cityName, status }
}

function useEnrichAndNotify() {
  const plants = usePlantsStore((s) => s.plants)
  const enrichAllPlants = usePlantsStore((s) => s.enrichAllPlants)
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const weatherData = usePlantsStore((s) => s.weatherData)

  // Enrich plants whenever the plant list or weather data changes
  useEffect(() => {
    if (!plants.length) return
    enrichAllPlants()
  }, [plants.length, !!weatherData]) // eslint-disable-line react-hooks/exhaustive-deps

  // Request notification permission on first load
  useEffect(() => {
    requestNotificationPermission()
  }, [])

  // Schedule notifications when risks update
  useEffect(() => {
    if (!activeRisks.length) return
    scheduleDailyNotifications(plants, activeRisks)
    notifyCriticalRisks(activeRisks)
  }, [activeRisks.length]) // eslint-disable-line react-hooks/exhaustive-deps
}

export default function App() {
  const weather = usePlantsStore((s) => s.weatherData)
  const location = useLocation()
  const { cityName, status } = useWeatherBootstrap()
  useEnrichAndNotify()

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
          <Route path="/alerts" element={<AlertCenter />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>

      <BottomNav />
    </div>
  )
}

