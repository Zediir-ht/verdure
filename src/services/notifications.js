// Notification service: requests permission and schedules plant care notifications

const NOTIF_PERMISSION_KEY = 'verdure:notif:permission_asked'

export async function requestNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  if (Notification.permission === 'granted') return 'granted'
  if (Notification.permission === 'denied') return 'denied'

  // Only ask once
  const alreadyAsked = localStorage.getItem(NOTIF_PERMISSION_KEY)
  if (alreadyAsked) return Notification.permission

  const result = await Notification.requestPermission()
  localStorage.setItem(NOTIF_PERMISSION_KEY, '1')
  return result
}

export function getNotificationPermission() {
  if (!('Notification' in window)) return 'unsupported'
  return Notification.permission
}

// Send immediate push via service worker or fallback to direct Notification
export function sendNotification(title, body, tag = 'verdure') {
  if (!('Notification' in window) || Notification.permission !== 'granted') return

  if ('serviceWorker' in navigator) {
    navigator.serviceWorker.ready
      .then((reg) => {
        reg.showNotification(title, {
          body,
          tag,
          icon: '/icons/icon-192.png',
          badge: '/icons/icon-72.png',
          vibrate: [200, 100, 200],
        })
      })
      .catch(() => {
        new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
      })
  } else {
    new Notification(title, { body, tag, icon: '/icons/icon-192.png' })
  }
}

// Schedule daily morning check via SW message
export function scheduleDailyNotifications(plants, activeRisks) {
  if (!('serviceWorker' in navigator) || !navigator.serviceWorker.controller) return

  const criticalRisks = activeRisks.filter((r) => r.level === 'critical' || r.level === 'danger')
  const plantsNeedingWater = plants.filter((p) => {
    if (!p.lastWatered) return true
    const daysSince = (Date.now() - new Date(p.lastWatered).getTime()) / 86400000
    const interval = p.info?.wateringIntervalDays ?? p.wateringIntervalDays ?? 7
    return daysSince >= interval
  })

  navigator.serviceWorker.controller.postMessage({
    type: 'SCHEDULE_NOTIFICATIONS',
    payload: {
      plantsNeedingWater: plantsNeedingWater.map((p) => p.name),
      criticalRisks: criticalRisks.map((r) => ({ title: r.title, message: r.message })),
    },
  })
}

// Send immediate critical alerts (called when new risks appear)
export function notifyCriticalRisks(risks) {
  const critical = risks.filter((r) => r.level === 'critical')
  if (!critical.length) return

  const names = [...new Set(critical.map((r) => r.plantName))].join(', ')
  sendNotification(
    '🚨 Alerte critique Verdure',
    `${critical.length} plante${critical.length > 1 ? 's' : ''} en danger : ${names}`,
    'verdure-critical',
  )
}
