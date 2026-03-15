import { useNavigate } from 'react-router-dom'
import { usePlantsStore } from '../../store/usePlantsStore'

export default function RiskBanner() {
  const navigate = useNavigate()
  const activeRisks = usePlantsStore((s) => s.activeRisks)

  const criticalCount = activeRisks.filter((r) => r.level === 'critical').length
  const dangerCount = activeRisks.filter((r) => r.level === 'danger').length
  const warningCount = activeRisks.filter((r) => r.level === 'warning').length

  if (!activeRisks.length) return null

  let className = 'risk-banner'
  let icon, label

  if (criticalCount > 0) {
    className += ' risk-banner--critical'
    icon = '🚨'
    label = `${criticalCount} plante${criticalCount > 1 ? 's' : ''} en danger — Action requise`
  } else if (dangerCount > 0) {
    className += ' risk-banner--danger'
    icon = '⚠️'
    label = `${dangerCount} alerte${dangerCount > 1 ? 's' : ''} importante${dangerCount > 1 ? 's' : ''}`
  } else {
    className += ' risk-banner--warning'
    icon = '🔔'
    label = `${warningCount} avertissement${warningCount > 1 ? 's' : ''}`
  }

  return (
    <button className={className} onClick={() => navigate('/alerts')} aria-label="Voir les alertes">
      <span className="risk-banner__icon">{icon}</span>
      <span className="risk-banner__label">{label}</span>
      <span className="risk-banner__arrow">›</span>
    </button>
  )
}
