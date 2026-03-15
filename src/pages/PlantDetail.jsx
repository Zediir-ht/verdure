import { useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import PlantEnvironment from '../components/plants/PlantEnvironment'
import { calculateHydricBalance } from '../services/hydricBalance'
import { getPlantDetails } from '../services/plants'
import { usePlantsStore } from '../store/usePlantsStore'
import { formatDayLabel } from '../utils/date'

const TABS = [
  { id: 'watering', label: '💧 Arrosage' },
  { id: 'environment', label: '🌡 Env.' },
  { id: 'alerts', label: '🔔 Alertes' },
  { id: 'profile', label: '📋 Fiche' },
]

const VULNERABILITY_LABELS = {
  gel: '🧊 Gel',
  canicule: '☀️ Canicule',
  vent: '💨 Vent',
  'excès-eau': '🌧️ Excès eau',
  sécheresse: '🏜️ Sécheresse',
  humidité: '💧 Humidité',
}

const LEVEL_COLORS = { critical: 'var(--risk-critical)', danger: 'var(--risk-danger)', warning: 'var(--risk-warning)', info: 'var(--risk-info)' }

function barColor(v) {
  if (v < 12) return 'var(--red)'
  if (v < 25) return 'var(--amber)'
  return 'var(--green)'
}

function formatDate(isoString) {
  if (!isoString) return '—'
  return new Date(isoString).toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' })
}

function formatRelative(isoString) {
  if (!isoString) return '—'
  const diff = Math.round((new Date(isoString).getTime() - Date.now()) / 86400000)
  if (diff < 0) return 'Dépassé'
  if (diff === 0) return "Aujourd'hui"
  if (diff === 1) return 'Demain'
  return `Dans ${diff} jours`
}

// ─── Tab: Arrosage ────────────────────────────────────────────────────────────

function WateringTab({ plant, balance, chartDays, onWater, drop }) {
  const chartHeight = 160
  const chartWidth = 320
  const maxValue = Math.max(70, ...chartDays.map((d) => d.value), 1)

  return (
    <div className="tab-content">
      {balance && (
        <div className="detail-next-watering">
          <div className="next-watering-countdown">
            <span className="next-watering-label">Prochain arrosage</span>
            <span className="next-watering-date">{formatDate(balance.nextWateringDate?.toISOString())}</span>
            <span className="next-watering-relative">{formatRelative(balance.nextWateringDate?.toISOString())}</span>
          </div>
          <div className="urgency-ring" style={{ '--urgency': balance.urgencyScore }}>
            <span className="urgency-pct">{balance.urgencyScore}%</span>
            <span className="urgency-hint">urgence</span>
          </div>
        </div>
      )}

      <h3>Bilan hydrique (7 jours)</h3>
      <div className="chart-scroll">
        <svg width={chartWidth} height={chartHeight} className="chart-surface" role="img" aria-label="Bilan hydrique">
          {chartDays.map((d, i) => {
            const barWidth = 34
            const x = 8 + i * 44
            const h = Math.max(8, (d.value / maxValue) * 110)
            const y = 130 - h
            return (
              <g key={d.date}>
                <rect x={x} y={y} width={barWidth} height={h} rx="7" fill={barColor(d.value)} />
                <text x={x + barWidth / 2} y="147" textAnchor="middle" className="chart-label">
                  {formatDayLabel(d.date)}
                </text>
              </g>
            )
          })}
        </svg>
      </div>

      {balance && <p className="reasoning-text">{balance.reasoning}</p>}

      <h3>Historique d'arrosage</h3>
      <ul className="timeline">
        {(plant.history || []).slice(0, 5).map((entry, idx) => (
          <li key={`${entry.date}-${idx}`}>
            <strong>{new Date(entry.date).toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}</strong>
            <span>{entry.action}</span>
          </li>
        ))}
        {!(plant.history?.length) && <li className="text-dim">Aucun arrosage enregistré.</li>}
      </ul>

      <button className={`water-btn${drop ? ' water-btn--active' : ''}`} onClick={onWater}>
        💧 J'ai arrosé
        {drop && <span className="water-drop-burst" />}
      </button>
    </div>
  )
}

// ─── Tab: Alertes ─────────────────────────────────────────────────────────────

function AlertsTab({ plant, activeRisks, dismissRisk }) {
  const plantRisks = activeRisks.filter((r) => r.plantId === plant.id)

  return (
    <div className="tab-content">
      {!plantRisks.length ? (
        <div className="tab-empty">
          <span>🌿</span>
          <p>Aucune alerte active pour cette plante.</p>
        </div>
      ) : (
        plantRisks.map((risk) => (
          <div
            key={risk.id}
            className="detail-alert-card"
            style={{ borderLeftColor: LEVEL_COLORS[risk.level] }}
          >
            <div className="detail-alert-header">
              <strong>{risk.plantEmoji} {risk.title}</strong>
              <span className={`alert-badge alert-badge--${risk.level}`}>{risk.level.toUpperCase()}</span>
            </div>
            <p>{risk.message}</p>
            <div className="detail-alert-footer">
              <span className="alert-deadline-chip">⏱ {risk.deadline}</span>
              <button className="alert-dismiss-btn" onClick={() => dismissRisk(risk.id)}>Ignorer</button>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

// ─── Tab: Fiche plante ────────────────────────────────────────────────────────

function ProfileTab({ info, plant, profile }) {
  const MONTHS = ['Jan', 'Fév', 'Mar', 'Avr', 'Mai', 'Jun', 'Jul', 'Aoû', 'Sep', 'Oct', 'Nov', 'Déc']
  const SEASON_MONTHS = { spring: [2, 3, 4], summer: [5, 6, 7], autumn: [8, 9, 10], winter: [11, 0, 1] }

  function getSeasonForMonth(m) {
    for (const [s, months] of Object.entries(SEASON_MONTHS)) {
      if (months.includes(m)) return s
    }
    return null
  }

  const vulnerabilities = profile?.vulnerabilities ?? []
  const seasonalActions = profile?.seasonalActions ?? {}

  return (
    <div className="tab-content">
      {info?.description && (
        <div className="info-card">
          <p>{info.description}</p>
        </div>
      )}

      {vulnerabilities.length > 0 && (
        <div className="profile-section">
          <h4>Vulnérabilités</h4>
          <div className="vuln-badges">
            {vulnerabilities.map((v) => (
              <span key={v} className="vuln-badge">{VULNERABILITY_LABELS[v] ?? v}</span>
            ))}
          </div>
        </div>
      )}

      {Object.keys(seasonalActions).length > 0 && (
        <div className="profile-section">
          <h4>Soins saisonniers</h4>
          <div className="seasonal-actions">
            {Object.entries(seasonalActions).map(([season, action]) => (
              <div key={season} className="seasonal-row">
                <span className="seasonal-icon">
                  {{ spring: '🌱', summer: '☀️', autumn: '🍂', winter: '❄️' }[season]}
                </span>
                <span>{action}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* 12-month visual calendar */}
      <div className="profile-section">
        <h4>Calendrier annuel</h4>
        <div className="month-calendar">
          {MONTHS.map((label, m) => {
            const season = getSeasonForMonth(m)
            const action = season ? seasonalActions[season] : null
            return (
              <div key={label} className={`month-cell month-cell--${season ?? 'none'}`} title={action ?? ''}>
                <span className="month-label">{label}</span>
              </div>
            )
          })}
        </div>
      </div>

      {info && (
        <div className="profile-section">
          <h4>Données botaniques</h4>
          <div className="info-card">
            {info.watering && <p className="text-dim">💧 Arrosage : {info.wateringIntervalDays ? `tous les ${info.wateringIntervalDays} jours` : info.watering}</p>}
            {info.wateringTips && <p className="text-dim">💬 {info.wateringTips}</p>}
            {info.latinName && <p className="text-dim">🔬 {info.latinName}</p>}
            {(info.sunlight || []).length > 0 && <p className="text-dim">☀️ {info.sunlight.join(', ')}</p>}
          </div>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function PlantDetail() {
  const { id } = useParams()
  const navigate = useNavigate()

  const plant = usePlantsStore((s) => s.plants.find((p) => p.id === id))
  const weather = usePlantsStore((s) => s.weatherData)
  const waterPlant = usePlantsStore((s) => s.waterPlant)
  const deletePlant = usePlantsStore((s) => s.deletePlant)
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const dismissRisk = usePlantsStore((s) => s.dismissRisk)
  const enrichedProfiles = usePlantsStore((s) => s.enrichedProfiles)

  const [activeTab, setActiveTab] = useState('watering')
  const [info, setInfo] = useState(plant?.info ?? null)
  const [loadingInfo, setLoadingInfo] = useState(false)
  const [drop, setDrop] = useState(false)

  const remotePlantId = plant?.trefleId ?? plant?.perenualId
  const profile = enrichedProfiles[id] ?? null

  // Fetch Trefle botanical info
  useEffect(() => {
    let active = true
    if (!remotePlantId || info) return
    setLoadingInfo(true)
    getPlantDetails(remotePlantId)
      .then((payload) => { if (active) setInfo(payload) })
      .finally(() => { if (active) setLoadingInfo(false) })
    return () => { active = false }
  }, [remotePlantId, info])

  const balance = useMemo(() => {
    if (!plant) return null
    return calculateHydricBalance(plant, weather?.pastDays ?? [], weather?.daily ?? [])
  }, [plant, weather])

  const chartDays = useMemo(() => {
    const past = (weather?.pastDays ?? []).slice(-3)
    const upcoming = (weather?.daily ?? []).slice(0, 4)
    const merged = [...past, ...upcoming]
    if (!plant) return []
    const coeff = plant.wateringCoefficient || 0.6
    const locationFactor = plant.location === 'exterieur' ? 1 : plant.location === 'balcon' ? 0.5 : 0
    const capacity = plant.potSize === 'large' ? 70 : plant.potSize === 'small' ? 20 : 40
    let running = capacity
    return merged.map((d) => {
      running = running - d.et0 * coeff + d.precipitation * locationFactor
      return { date: d.date, value: Math.max(0, Math.round(running)) }
    })
  }, [weather, plant])

  const plantRisksCount = activeRisks.filter((r) => r.plantId === id).length

  if (!plant) {
    return (
      <section className="page">
        <p>Plante introuvable.</p>
        <button className="primary-btn" onClick={() => navigate('/')}>Retour</button>
      </section>
    )
  }

  const onWater = () => {
    setDrop(true)
    waterPlant(plant.id)
    setTimeout(() => setDrop(false), 700)
  }

  const onDelete = () => {
    if (!window.confirm(`Supprimer « ${plant.name} » ?`)) return
    deletePlant(plant.id)
    navigate('/', { replace: true })
  }

  return (
    <section className="page detail-page">
      {/* Header */}
      <div className="detail-hero">
        <button className="back-btn" onClick={() => navigate(-1)}>‹</button>
        <span className="detail-emoji">{plant.emoji}</span>
        <div className="detail-hero__info">
          <h2>{plant.name}</h2>
          {plant.latinName && <p className="text-dim italic">{plant.latinName}</p>}
          <p className="text-dim">{plant.type} · {plant.location ?? 'intérieur'}</p>
        </div>
        <button className="delete-plant-btn" onClick={onDelete} aria-label="Supprimer la plante">🗑</button>
      </div>

      {/* Tabs */}
      <div className="detail-tabs" role="tablist">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`detail-tab${activeTab === tab.id ? ' detail-tab--active' : ''}`}
            onClick={() => setActiveTab(tab.id)}
          >
            {tab.label}
            {tab.id === 'alerts' && plantRisksCount > 0 && (
              <span className="tab-badge">{plantRisksCount}</span>
            )}
          </button>
        ))}
      </div>

      {/* Tab panels */}
      {activeTab === 'watering' && (
        <WateringTab
          plant={plant}
          balance={balance}
          chartDays={chartDays}
          onWater={onWater}
          drop={drop}
        />
      )}
      {activeTab === 'environment' && <PlantEnvironment plant={plant} />}
      {activeTab === 'alerts' && (
        <AlertsTab plant={plant} activeRisks={activeRisks} dismissRisk={dismissRisk} />
      )}
      {activeTab === 'profile' && (
        loadingInfo
          ? <div className="tab-content"><div className="env-skeleton"><div className="skeleton-line" /><div className="skeleton-line" /></div></div>
          : <ProfileTab info={info} plant={plant} profile={profile} />
      )}
    </section>
  )
}

