import { useNavigate } from 'react-router-dom'
import { usePlantsStore } from '../../store/usePlantsStore'

const RISK_ICONS = {
  frost: '🧊',
  heat: '☀️',
  wind: '💨',
  rain: '🌧️',
  drought: '🏜️',
  uv: '🔆',
  humidity: '💧',
  seasonal: '🌿',
}

const LEVEL_LABELS = {
  critical: 'CRITIQUE',
  danger: 'DANGER',
  warning: 'AVERTISSEMENT',
  info: 'INFO',
}

const LEVEL_ORDER = { critical: 0, danger: 1, warning: 2, info: 3 }

function AlertCard({ risk, onDismiss }) {
  return (
    <div className={`alert-card alert-card--${risk.level}`}>
      <div className="alert-card__border" />
      <div className="alert-card__body">
        <div className="alert-card__header">
          <span className="alert-card__type-icon">{RISK_ICONS[risk.riskType] ?? '⚠️'}</span>
          <span className="alert-card__plant">
            {risk.plantEmoji} <strong>{risk.plantName}</strong>
          </span>
          <span className={`alert-badge alert-badge--${risk.level}`}>
            {LEVEL_LABELS[risk.level]}
          </span>
        </div>

        <p className="alert-card__title">{risk.title}</p>
        <p className="alert-card__message">{risk.message}</p>

        <div className="alert-card__footer">
          <span className="alert-deadline-chip">
            ⏱ {risk.deadline}
          </span>
          <span className="alert-trigger-chip">
            {risk.triggerValue}
          </span>
          <button
            className="alert-dismiss-btn"
            onClick={() => onDismiss(risk.id)}
            aria-label="Ignorer cette alerte"
          >
            Ignorer
          </button>
        </div>
      </div>
    </div>
  )
}

export default function AlertCenter() {
  const navigate = useNavigate()
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const globalSummary = usePlantsStore((s) => s.globalSummary)
  const dismissRisk = usePlantsStore((s) => s.dismissRisk)

  const sorted = [...activeRisks].sort(
    (a, b) => (LEVEL_ORDER[a.level] ?? 9) - (LEVEL_ORDER[b.level] ?? 9),
  )

  const groups = {
    critical: sorted.filter((r) => r.level === 'critical'),
    danger: sorted.filter((r) => r.level === 'danger'),
    warning: sorted.filter((r) => r.level === 'warning'),
    info: sorted.filter((r) => r.level === 'info'),
  }

  return (
    <section className="page alert-center">
      <div className="alert-center__header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Retour">
          ‹
        </button>
        <h2>Centre d'alertes</h2>
        {globalSummary && (
          <div className="weather-summary-chip">
            🌤 {globalSummary.weatherSummary}
          </div>
        )}
      </div>

      {!activeRisks.length ? (
        <div className="alert-empty">
          <div className="alert-empty__icon">🌿</div>
          <h3>Toutes vos plantes sont en sécurité</h3>
          <p>Aucune alerte active pour le moment. Beau travail !</p>
        </div>
      ) : (
        <div className="alert-list">
          {globalSummary?.generalAdvice && (
            <div className="alert-advice-card">
              <span>💡</span>
              <p>{globalSummary.generalAdvice}</p>
            </div>
          )}

          {Object.entries(groups).map(([level, risks]) => {
            if (!risks.length) return null
            return (
              <div key={level} className="alert-group">
                <h3 className={`alert-group__title alert-group__title--${level}`}>
                  {RISK_ICONS[level] ?? '⚠️'} {LEVEL_LABELS[level]}
                  <span className="alert-group__count">{risks.length}</span>
                </h3>
                {risks.map((risk) => (
                  <AlertCard key={risk.id} risk={risk} onDismiss={dismissRisk} />
                ))}
              </div>
            )
          })}
        </div>
      )}
    </section>
  )
}
