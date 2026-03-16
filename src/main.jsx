import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App'
import PasswordGate from './components/PasswordGate'
import './index.css'

class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }
  static getDerivedStateFromError(error) {
    return { error }
  }
  render() {
    if (this.state.error) {
      return (
        <div style={{ padding: 24, fontFamily: 'sans-serif', color: '#dc2626' }}>
          <h2>Erreur inattendue</h2>
          <pre style={{ whiteSpace: 'pre-wrap', fontSize: 13, color: '#555' }}>
            {this.state.error.toString()}
          </pre>
          <button onClick={() => window.location.reload()} style={{ marginTop: 12 }}>
            Recharger
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {
      // registration failure is non-blocking
    })
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <PasswordGate>
        <BrowserRouter>
          <App />
        </BrowserRouter>
      </PasswordGate>
    </ErrorBoundary>
  </React.StrictMode>,
)
