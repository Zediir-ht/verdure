import { usePlantsStore } from '../../store/usePlantsStore'

const TYPE_GROUPS = [
  { label: '🌵 Cactus & Succulentes', types: ['cactus', 'succulent'], emoji: '🌵' },
  { label: '🌿 Tropicaux', types: ['tropical', 'fern', 'orchid'], emoji: '🌿' },
  { label: '🌸 Plantes à fleurs', types: ['flower'], emoji: '🌸' },
  { label: '🌿 Aromatiques', types: ['aromatic'], emoji: '🌿' },
  { label: '🌳 Arbustes & extérieur', types: ['tree', 'shrub', 'default'], emoji: '🌳' },
]

function deriveImpact(plants, activeRisks, profile) {
  if (!plants.length) return null
  const ids = plants.map((p) => p.id)
  const plantRisks = activeRisks.filter((r) => ids.includes(r.plantId))

  const critical = plantRisks.filter((r) => r.level === 'critical' || r.level === 'danger')
  if (critical.length > 0) {
    const types = [...new Set(critical.map((r) => r.riskType))]
    const typeLabels = {
      frost: 'risque gel',
      heat: 'stress chaleur',
      wind: 'risque vent',
      rain: 'excès pluie',
      drought: 'sécheresse',
      uv: 'UV intense',
      humidity: 'humidité',
    }
    return { label: types.map((t) => typeLabels[t] ?? t).join(', '), cls: 'impact--risk' }
  }

  const warnings = plantRisks.filter((r) => r.level === 'warning')
  if (warnings.length > 0) {
    return { label: `${warnings.length} avertissement${warnings.length > 1 ? 's' : ''}`, cls: 'impact--warn' }
  }

  return { label: 'RAS', cls: 'impact--ok' }
}

export default function WeeklyImpact() {
  const plants = usePlantsStore((s) => s.plants)
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const globalSummary = usePlantsStore((s) => s.globalSummary)
  const enrichedProfiles = usePlantsStore((s) => s.enrichedProfiles)

  if (!plants.length) return null

  return (
    <div className="weekly-impact">
      {globalSummary?.weatherSummary && (
        <div className="weekly-impact__summary">
          <span className="wi-summary-icon">🌤</span>
          <p>{globalSummary.weatherSummary}</p>
        </div>
      )}

      <div className="wi-groups">
        {TYPE_GROUPS.map((group) => {
          const groupPlants = plants.filter((p) =>
            group.types.includes(p.type ?? 'default'),
          )
          if (!groupPlants.length) return null
          const impact = deriveImpact(groupPlants, activeRisks, enrichedProfiles)

          return (
            <div key={group.label} className="wi-group-chip">
              <span>{group.label}</span>
              {impact && (
                <span className={`wi-impact-badge ${impact.cls}`}>{impact.label}</span>
              )}
            </div>
          )
        })}
      </div>

      {globalSummary?.generalAdvice && (
        <div className="wi-advice">
          <span>💡</span>
          <p>{globalSummary.generalAdvice}</p>
        </div>
      )}
    </div>
  )
}
