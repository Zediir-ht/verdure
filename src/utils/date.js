export function formatRelativeDate(targetDate) {
  const today = new Date()
  const startToday = new Date(today.getFullYear(), today.getMonth(), today.getDate())
  const target = new Date(targetDate)
  const startTarget = new Date(target.getFullYear(), target.getMonth(), target.getDate())

  const diffDays = Math.round((startTarget - startToday) / (1000 * 60 * 60 * 24))

  if (diffDays === 0) return "aujourd'hui"
  if (diffDays === 1) return 'demain'
  if (diffDays > 1) return `dans ${diffDays} jours`
  if (diffDays === -1) return 'en retard de 1j'
  return `en retard de ${Math.abs(diffDays)}j`
}

export function formatDayLabel(dateString) {
  return new Date(dateString).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' })
}
