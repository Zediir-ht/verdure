import { NavLink } from 'react-router-dom'

const items = [
  { to: '/', icon: '🏠', label: 'Dashboard' },
  { to: '/plants', icon: '🌿', label: 'Plantes' },
  { to: '/weather', icon: '🌤', label: 'Météo' },
  { to: '/advisor', icon: '✦', label: 'IA' },
  { to: '/settings', icon: '⚙️', label: 'Réglages' },
]

export default function BottomNav() {
  return (
    <nav className="bottom-nav" aria-label="Navigation principale">
      {items.map((item) => (
        <NavLink key={item.to} to={item.to} className="bottom-item">
          {({ isActive }) => (
            <>
              <span className="icon">{item.icon}</span>
              <span className="label">{item.label}</span>
              {isActive ? <span className="dot" /> : null}
            </>
          )}
        </NavLink>
      ))}
    </nav>
  )
}
