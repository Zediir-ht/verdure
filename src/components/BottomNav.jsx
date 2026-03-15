import { NavLink } from 'react-router-dom'
import { usePlantsStore } from '../store/usePlantsStore'

const navItems = [
  { to: '/', icon: '🏠', label: 'Dashboard', exact: true },
  { to: '/weather', icon: '🌤', label: 'Météo' },
  { to: '/alerts', icon: '🔔', label: 'Alertes' },
  { to: '/advisor', icon: '✦', label: 'IA' },
  { to: '/settings', icon: '⚙️', label: 'Réglages' },
]

export default function BottomNav() {
  const activeRisks = usePlantsStore((s) => s.activeRisks)
  const criticalCount = activeRisks.filter((r) => r.level === 'critical' || r.level === 'danger').length

  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {navItems.map((item) => (
        <NavLink
          key={item.to}
          to={item.to}
          end={item.exact}
          className={({ isActive }) => `bottom-item${isActive ? ' active' : ''}`}
        >
          <span className="icon" style={{ position: 'relative' }}>
            {item.icon}
            {item.to === '/alerts' && criticalCount > 0 && (
              <span style={{
                position: 'absolute', top: -4, right: -4,
                background: 'var(--risk-danger)', color: 'white',
                borderRadius: '999px', fontSize: '0.6rem', fontWeight: 700,
                minWidth: 14, height: 14, display: 'inline-flex',
                alignItems: 'center', justifyContent: 'center', padding: '0 3px',
              }}>
                {criticalCount}
              </span>
            )}
          </span>
          <span className="label">{item.label}</span>
        </NavLink>
      ))}
    </nav>
  )
}

