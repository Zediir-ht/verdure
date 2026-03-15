self.addEventListener('install', () => self.skipWaiting())

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', () => {
  // Cache strategy intentionally minimal for this app version.
})

// ─── Background weather refresh every 2 hours ────────────────────────────────

const WEATHER_ALARM_TAG = 'verdure-weather-refresh'
const WEATHER_INTERVAL_MS = 2 * 60 * 60 * 1000

// Schedule periodic background sync
self.addEventListener('periodicsync', (event) => {
  if (event.tag === WEATHER_ALARM_TAG) {
    event.waitUntil(notifyClientsToRefresh())
  }
})

// Fallback: use setTimeout loop registered via message
let weatherRefreshInterval = null

self.addEventListener('message', (event) => {
  const { type, payload } = event.data ?? {}

  if (type === 'START_WEATHER_REFRESH') {
    if (weatherRefreshInterval) clearInterval(weatherRefreshInterval)
    weatherRefreshInterval = setInterval(() => {
      notifyClientsToRefresh()
    }, WEATHER_INTERVAL_MS)
  }

  if (type === 'SCHEDULE_NOTIFICATIONS') {
    scheduleNotifications(payload)
  }
})

async function notifyClientsToRefresh() {
  const clients = await self.clients.matchAll({ type: 'window' })
  clients.forEach((client) => {
    client.postMessage({ type: 'REFRESH_WEATHER' })
  })
}

// ─── Notification scheduling ──────────────────────────────────────────────────

function scheduleNotifications({ plantsNeedingWater = [], criticalRisks = [] } = {}) {
  const now = new Date()

  // Morning check at 8:00 AM
  const morning = new Date(now)
  morning.setHours(8, 0, 0, 0)
  if (morning <= now) morning.setDate(morning.getDate() + 1)
  const msToMorning = morning.getTime() - now.getTime()

  setTimeout(() => {
    if (plantsNeedingWater.length > 0) {
      const names = plantsNeedingWater.slice(0, 3).join(', ')
      const extra = plantsNeedingWater.length > 3 ? ` et ${plantsNeedingWater.length - 3} autre(s)` : ''
      self.registration.showNotification('💧 Arrosage du jour', {
        body: `À arroser aujourd'hui : ${names}${extra}`,
        tag: 'verdure-watering',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-72.png',
      })
    }

    for (const risk of criticalRisks.slice(0, 2)) {
      self.registration.showNotification(`🚨 ${risk.title}`, {
        body: risk.message,
        tag: `verdure-risk-${risk.title}`,
        icon: '/icons/icon-192.png',
      })
    }
  }, msToMorning)

  // Evening alert at 19:00 for next-day critical risks
  const evening = new Date(now)
  evening.setHours(19, 0, 0, 0)
  if (evening <= now) evening.setDate(evening.getDate() + 1)
  const msToEvening = evening.getTime() - now.getTime()

  setTimeout(() => {
    if (criticalRisks.length > 0) {
      self.registration.showNotification('⚠️ Alerte Verdure ce soir', {
        body: `${criticalRisks.length} alerte(s) pour cette nuit ou demain matin — vérifiez l'appli.`,
        tag: 'verdure-evening',
        icon: '/icons/icon-192.png',
      })
    }
  }, msToEvening)
}

// ─── Notification click → open app ───────────────────────────────────────────

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  event.waitUntil(
    self.clients.matchAll({ type: 'window' }).then((clients) => {
      const existing = clients.find((c) => c.url.includes(self.location.origin))
      if (existing) return existing.focus()
      return self.clients.openWindow('/')
    }),
  )
})

