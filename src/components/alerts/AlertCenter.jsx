import { useNavigate } from 'react-router-dom'
import { usePlantsStore } from '../../store/usePlantsStore'

const RISK_ICONS = {
  frost: '🧊',
  heat: '🌡️',
  wind: '💨',
  rain: '🌧️',
  drought: '🏜️',
  uv: '☀️',
  humidity: '💧',
  seasonal: '🌿',
}

const LEVEL_LABELS = {
  critical: 'Critique',
  danger: 'Danger',
  warning: 'Avertissement',
  info: 'Info',
}

const LEVEL_ORDER = { critical: 0, danger: 1, warning: 2, info: 3 }

// Action contextuelle selon le type de risque
function getAction(risk) {
  switch (risk.riskType) {
    case 'drought': return { label: '💧 Arroser maintenant', to: `/plant/${risk.plantId}` }
    case 'frost': return { label: '🏠 Rentrer la plante', to: `/plant/${risk.plantId}` }
    case 'heat': return { label: '🌿 Voir la fiche', to: `/plant/${risk.plantId}` }
    case 'uv': return { label: '🌿 Voir la fiche', to: `/plant/${risk.plantId}` }
    default: return null
  }
}

function AlertCard({ risk, onDismiss }) {
  const navigate = useNavigate()
  const action = getAction(risk)

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
          <span className="alert-deadline-chip">⏱ {risk.deadline}</span>
          <span className="alert-trigger-chip">{risk.triggerValue}</span>
          {action && (
            <button
              className={`alert-action-btn alert-action-btn--${risk.level}`}
              onClick={() => navigate(action.to)}
            >
              {action.label}
            </button>
          )}
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

  const GROUP_ICONS = { critical: '🔴', danger: '🟠', warning: '🟡', info: '🔵' }

  return (
    <section className="page alert-center">
      <div className="alert-center__header">
        <button className="back-btn" onClick={() => navigate(-1)} aria-label="Retour">‹</button>
        <div>
          <h2 style={{ fontFamily: 'Fraunces, serif', fontStyle: 'italic', fontSize: '1.4rem', letterSpacing: '-0.02em' }}>
            Centre d'alertes
          </h2>
          {activeRisks.length > 0 && (
            <p style={{ color: 'var(--text-dim)', fontSize: '0.82rem', marginTop: 2 }}>
              {activeRisks.length} alerte{activeRisks.length > 1 ? 's' : ''} active{activeRisks.length > 1 ? 's' : ''}
            </p>
          )}
        </div>
      </div>

      {globalSummary?.weatherSummary && (
        <div className="weather-summary-chip">
          🌤 {globalSummary.weatherSummary}
        </div>
      )}

      {!activeRisks.length ? (
        <div className="alert-empty">
          <div className="alert-empty__icon">🌿</div>
          <h3>Tout va bien !</h3>
          <p>Aucune alerte active. Vos plantes sont en sécurité.</p>
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
                  {GROUP_ICONS[level]} {LEVEL_LABELS[level]}
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
