import { useState } from 'react'
import { usePlantsStore } from '../store/usePlantsStore'

const hasTrefle = !!import.meta.env.VITE_TREFLE_USER_TOKEN
const hasAI = !!import.meta.env.VITE_ANTHROPIC_API_KEY

function StatusBadge({ ok, label }) {
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', gap: 6,
      fontSize: '0.82rem', fontWeight: 600,
      color: ok ? 'var(--green)' : 'var(--amber)',
    }}>
      <span style={{
        width: 8, height: 8, borderRadius: '50%',
        background: ok ? 'var(--green)' : 'var(--amber)',
        boxShadow: ok ? '0 0 6px var(--green-light)' : '0 0 6px var(--amber)',
        display: 'inline-block',
      }} />
      {label}
    </span>
  )
}

export default function Settings() {
  const plants = usePlantsStore((s) => s.plants)
  const weatherData = usePlantsStore((s) => s.weatherData)
  const [cleared, setCleared] = useState(false)
  const [cacheCleared, setCacheCleared] = useState(false)

  const plantCount = plants.length
  const lastWateredCount = plants.filter((p) => p.lastWatered).length
  const storageUsed = (() => {
    try {
      const raw = localStorage.getItem('verdure-store')
      return raw ? (new Blob([raw]).size / 1024).toFixed(1) + ' Ko' : '—'
    } catch { return '—' }
  })()

  const clearCache = () => {
    Object.keys(sessionStorage).filter(k => k.startsWith('verdure:')).forEach(k => sessionStorage.removeItem(k))
    setCacheCleared(true)
    setTimeout(() => setCacheCleared(false), 2500)
  }

  const clearAllData = () => {
    if (!window.confirm('Supprimer toutes les plantes et données météo ?')) return
    usePlantsStore.setState({ plants: [], weatherData: null, lastWeatherFetch: null })
    setCleared(true)
    setTimeout(() => setCleared(false), 2500)
  }

  return (
    <section className="page">
      <h2>Réglages</h2>

      {/* Connexions */}
      <div className="info-card" style={{ padding: 16, display: 'grid', gap: 14 }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Connexions</h3>
        <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Trefle.io</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Base de données botanique</p>
            </div>
            <StatusBadge ok={hasTrefle} label={hasTrefle ? 'Connecté' : 'Non configuré'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Conseiller IA</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Claude (Anthropic)</p>
            </div>
            <StatusBadge ok={hasAI} label={hasAI ? 'Connecté' : 'Non configuré'} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <p style={{ margin: 0, fontWeight: 600 }}>Météo</p>
              <p style={{ margin: 0, fontSize: '0.8rem', color: 'var(--text-dim)' }}>Open-Meteo (gratuit)</p>
            </div>
            <StatusBadge ok={!!weatherData} label={weatherData ? 'Données disponibles' : 'En attente de position'} />
          </div>
        </div>
      </div>

      {/* Stats */}
      <div className="info-card" style={{ padding: 16, display: 'grid', gap: 14 }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Données locales</h3>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 10, textAlign: 'center' }}>
          {[
            { value: plantCount, label: 'Plantes' },
            { value: lastWateredCount, label: 'Arrosées' },
            { value: storageUsed, label: 'Stockage' },
          ].map(({ value, label }) => (
            <div key={label} style={{
              background: 'var(--surface2)', borderRadius: 14, padding: '14px 8px',
              border: '1px solid var(--border)',
            }}>
              <p style={{ margin: 0, fontSize: '1.5rem', fontWeight: 700, color: 'var(--green-dark)' }}>{value}</p>
              <p style={{ margin: 0, fontSize: '0.75rem', color: 'var(--text-dim)' }}>{label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Actions */}
      <div className="info-card" style={{ padding: 16, display: 'grid', gap: 10 }}>
        <h3 style={{ fontSize: '0.95rem', color: 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.06em', margin: 0 }}>Actions</h3>
        <button
          onClick={clearCache}
          style={{
            width: '100%', border: '1px solid var(--border)', borderRadius: 12,
            background: 'var(--surface2)', color: 'var(--text)', padding: '12px 14px',
            fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>🗑️</span>
          <span>{cacheCleared ? '✓ Cache vidé !' : 'Vider le cache Trefle / IA'}</span>
        </button>
        <button
          onClick={clearAllData}
          style={{
            width: '100%', border: '1px solid rgba(239,68,68,0.4)', borderRadius: 12,
            background: 'rgba(239,68,68,0.05)', color: 'var(--red)', padding: '12px 14px',
            fontWeight: 500, textAlign: 'left', display: 'flex', alignItems: 'center', gap: 10,
          }}
        >
          <span style={{ fontSize: '1.2rem' }}>⚠️</span>
          <span>{cleared ? '✓ Données supprimées' : 'Supprimer toutes les données'}</span>
        </button>
      </div>

      {/* À propos */}
      <div className="info-card" style={{ padding: 16 }}>
        <p style={{ margin: 0, fontWeight: 600 }}>Verdure <span style={{ color: 'var(--text-dim)', fontWeight: 400, fontSize: '0.85rem' }}>v0.0.0</span></p>
        <p className="text-dim" style={{ margin: '6px 0 0', fontSize: '0.83rem', lineHeight: 1.5 }}>
          PWA mobile-first · Données locales · Bilan hydrique quotidien
        </p>
      </div>
    </section>
  )
}
