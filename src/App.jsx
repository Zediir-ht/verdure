import { useEffect, useMemo, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { ConfigProvider, App as AntApp } from 'antd'
import frFR from 'antd/locale/fr_FR'
import AddPlantModal from './components/AddPlantModal'
import BottomNav from './components/BottomNav'
import Header from './components/Header'
import AlertCenter from './components/alerts/AlertCenter'
import AIAdvisor from './pages/AIAdvisor'
import Dashboard from './pages/Dashboard'
import PlantDetail from './pages/PlantDetail'
import Settings from './pages/Settings'
import WeatherDetail from './pages/WeatherDetail'
import PlantCalendar from './pages/PlantCalendar'
import { DEFAULT_COORDS, fetchWeather } from './services/weather'
import { requestNotificationPermission, scheduleDailyNotifications, notifyCriticalRisks } from './services/notifications'
import { usePlantsStore } from './store/usePlantsStore'

const antTheme = {
  token: {
    colorPrimary: '#2d8653',
    colorSuccess: '#2d8653',
    colorLink: '#2d8653',
    colorTextBase: '#16301f',
    colorBgBase: '#f2f8f4',
    borderRadius: 12,
    borderRadiusLG: 16,
    borderRadiusSM: 8,
    fontFamily: "'Geist', system-ui, -apple-system, sans-serif",
    fontSize: 15,
    lineHeight: 1.6,
    colorBorder: '#d0e5d6',
    colorBorderSecondary: '#e5f0e8',
    boxShadow: '0 4px 16px rgba(22, 48, 31, 0.07), 0 2px 4px rgba(22, 48, 31, 0.04)',
    boxShadowSecondary: '0 1px 3px rgba(22, 48, 31, 0.06)',
    motionDurationMid: '0.18s',
    motionEaseInOut: 'cubic-bezier(0.4, 0, 0.2, 1)',
  },
  components: {
    Button: {
      borderRadius: 12,
      controlHeight: 42,
      paddingContentHorizontal: 18,
      fontWeight: 600,
      primaryShadow: '0 6px 20px rgba(45, 134, 83, 0.25)',
    },
    Card: {
      borderRadius: 18,
      boxShadow: '0 4px 16px rgba(22, 48, 31, 0.07), 0 2px 4px rgba(22, 48, 31, 0.04)',
      paddingLG: 18,
    },
    Modal: { borderRadius: 20 },
    Tabs: {
      borderRadius: 12,
      inkBarColor: '#2d8653',
      itemActiveColor: '#2d8653',
      itemSelectedColor: '#2d8653',
    },
    Progress: { borderRadius: 999 },
    Tag: { borderRadius: 999 },
    DatePicker: { borderRadius: 12 },
    Input: { borderRadius: 12, controlHeight: 42 },
    Select: { borderRadius: 12 },
    Message: { borderRadius: 14 },
  },
}

function useWeatherBootstrap() {
  const updateWeather = usePlantsStore((s) => s.updateWeather)
  const refreshRisks = usePlantsStore((s) => s.refreshRisks)
  const enrichAllPlants = usePlantsStore((s) => s.enrichAllPlants)
  const lastWeatherFetch = usePlantsStore((s) => s.lastWeatherFetch)
  const loadPlants = usePlantsStore((s) => s.loadPlants)
  const [cityName, setCityName] = useState(DEFAULT_COORDS.city)
  const [status, setStatus] = useState({ loading: true, error: '' })

  useEffect(() => {
    // Load plants from Supabase on mount
    loadPlants()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

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
    <ConfigProvider theme={antTheme} locale={frFR}>
      <AntApp>
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
              <Route path="/calendar" element={<PlantCalendar />} />
              <Route path="*" element={<Navigate to="/" replace />} />
            </Routes>
          </main>

          <BottomNav />
        </div>
      </AntApp>
    </ConfigProvider>
  )
}

