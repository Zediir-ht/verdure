import { useState } from 'react'

const HASH = '9b3f4c2e1a8d76051fce2b0493a7e5d8f1c6b24390a7e1d5f8c2b04936a7e1d5'

// Simple djb2-based hex fingerprint (client-side gate, not cryptographic)
function fingerprint(str) {
  let h = 5381
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) + h) ^ str.charCodeAt(i)
    h = h >>> 0
  }
  // stretch with a second pass to produce a longer hex string
  let h2 = h
  for (let i = str.length - 1; i >= 0; i--) {
    h2 = ((h2 << 5) + h2) ^ str.charCodeAt(i)
    h2 = h2 >>> 0
  }
  return (h.toString(16).padStart(8, '0') + h2.toString(16).padStart(8, '0')).padEnd(64, '0')
}

const CORRECT = fingerprint('Leskakous12')
const STORAGE_KEY = 'verdure_auth'

export default function PasswordGate({ children }) {
  const [unlocked, setUnlocked] = useState(() => localStorage.getItem(STORAGE_KEY) === CORRECT)
  const [value, setValue] = useState('')
  const [error, setError] = useState(false)
  const [shake, setShake] = useState(false)

  if (unlocked) return children

  const attempt = (e) => {
    e.preventDefault()
    if (fingerprint(value) === CORRECT) {
      localStorage.setItem(STORAGE_KEY, CORRECT)
      setUnlocked(true)
    } else {
      setError(true)
      setShake(true)
      setValue('')
      setTimeout(() => setShake(false), 500)
    }
  }

  return (
    <div className="gate-backdrop">
      <div className={`gate-card ${shake ? 'gate-shake' : ''}`}>
        <span className="gate-logo">🌿</span>
        <h1 className="gate-title">Verdure</h1>
        <p className="gate-sub">Application privée</p>

        <form className="gate-form" onSubmit={attempt}>
          <input
            className={`input gate-input ${error ? 'gate-input-error' : ''}`}
            type="password"
            placeholder="Mot de passe"
            autoComplete="current-password"
            value={value}
            onChange={(e) => {
              setValue(e.target.value)
              setError(false)
            }}
            autoFocus
          />
          {error ? <p className="gate-error">Mot de passe incorrect</p> : null}
          <button type="submit" className="primary-btn gate-btn">
            Entrer ✦
          </button>
        </form>
      </div>
    </div>
  )
}
