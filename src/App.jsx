import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.omni7.io'

export default function App() {
  const [status, setStatus] = useState('idle') // idle | loading | success | error
  const [message, setMessage] = useState('')
  const [metaUser, setMetaUser] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMessage('Meta authorisation was denied. Please try again.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (code) {
      setStatus('loading')
      setMessage('Connecting your Meta account...')
      handleCallback(code)
    }
  }, [])

  async function handleCallback(code) {
    try {
      const res = await fetch(
        `${API_URL}/api/v1/connect/meta/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST', credentials: 'include' }
      )

      const data = await res.json().catch(() => ({}))

      if (!res.ok) {
        setStatus('error')
        setMessage(data?.message || 'Failed to connect Meta account. Please try again.')
        return
      }

      setMetaUser(data)
      setStatus('success')
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      setStatus('error')
      setMessage('Network error. Please check your connection and try again.')
    }
  }

  async function handleConnect() {
    setStatus('loading')
    setMessage('Preparing Meta connection...')

    try {
      const res = await fetch(`${API_URL}/api/v1/connect/user/meta`, {
        method: 'POST',
        credentials: 'include',
      })

      if (res.status === 401) {
        setStatus('error')
        setMessage('You are not logged in. Please log in to the Omni API first, then return here.')
        return
      }

      if (!res.ok) {
        setStatus('error')
        setMessage('Failed to initiate Meta connection. Please try again.')
        return
      }

      const data = await res.json()
      window.location.href = data.url
    } catch {
      setStatus('error')
      setMessage('Network error. Please check your connection and try again.')
    }
  }

  return (
    <div className="page">
      <div className="card">
        <div className="brand">
          <svg viewBox="0 0 200 200" className="meta-icon" aria-label="Meta">
            <path fill="#1877F2" d="M100 0C44.8 0 0 44.8 0 100s44.8 100 100 100 100-44.8 100-100S155.2 0 100 0z"/>
            <path fill="#fff" d="M138.5 68c-7.2 0-13.5 3.3-18.2 8.8C115.5 70.8 108.5 67 100 67c-8.5 0-15.5 3.8-20.3 9.8C75.0 71.3 68.7 68 61.5 68 47.6 68 37 80.2 37 96.5c0 7.2 2.4 13.8 6.5 19l.1.1 19.2 25.5c3.2 4.3 8.3 6.9 13.7 6.9 4.8 0 9.3-1.9 12.6-5.3l.9-1 1 1.3c3.3 4 8.1 6 13.3 6 5.2 0 10.1-2.1 13.4-6.1l.9-1.1.9 1c3.3 3.4 7.8 5.2 12.6 5.2 5.4 0 10.5-2.6 13.7-6.9l19.3-25.6.1-.1c4.1-5.2 6.5-11.8 6.5-19C163 80.2 152.4 68 138.5 68zM73.5 138c-2.2 0-4.3-1-5.7-2.8L48.6 109.7c-2.7-3.4-4.1-7.7-4.1-13.2C44.5 84.2 52 76 61.5 76c5 0 9.7 2.8 13.6 8.1l15.6 21.5L73.5 138zm26.5-9.8L82.3 103l-.2-.3c-2-2.8-3.8-7.3-3.8-12.2 0-12.2 9.4-16 21.7-16 12.3 0 21.7 3.8 21.7 16 0 4.9-1.8 9.4-3.8 12.2l-.2.3-17.7 25.2zm38 7c-1.4 1.8-3.5 2.8-5.7 2.8l-17.2-31.4 15.6-21.5c3.9-5.3 8.6-8.1 13.6-8.1 9.5 0 17 8.2 17 20.5.0 5.5-1.4 9.8-4.1 13.2L138 135.2z"/>
          </svg>
          <span className="brand-name">Omni</span>
        </div>

        <h1 className="title">Connect Meta Account</h1>
        <p className="subtitle">Link your Facebook & Instagram to Omni</p>

        {status === 'idle' && (
          <div className="content">
            <div className="permissions">
              <div className="perm-item">
                <span className="perm-icon">📄</span>
                <span>Read page engagement</span>
              </div>
              <div className="perm-item">
                <span className="perm-icon">✏️</span>
                <span>Manage page posts</span>
              </div>
              <div className="perm-item">
                <span className="perm-icon">📸</span>
                <span>Publish to Instagram</span>
              </div>
            </div>
            <button onClick={handleConnect} className="btn-meta">
              <svg viewBox="0 0 24 24" className="btn-icon" fill="white">
                <path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/>
              </svg>
              Continue with Meta
            </button>
          </div>
        )}

        {status === 'loading' && (
          <div className="content center">
            <div className="spinner" />
            <p className="status-msg">{message}</p>
          </div>
        )}

        {status === 'success' && (
          <div className="content center">
            <div className="success-icon">✓</div>
            <p className="status-msg success-text">Meta account connected!</p>
            {metaUser && (
              <div className="user-info">
                <p className="user-name">{metaUser.meta_user_name}</p>
                <p className="user-detail">ID: {metaUser.meta_user_id}</p>
                <p className="user-detail">
                  Token expires:{' '}
                  {new Date(metaUser.token_expiry).toLocaleDateString('en-AU', {
                    day: 'numeric', month: 'short', year: 'numeric'
                  })}
                </p>
              </div>
            )}
            <button onClick={() => setStatus('idle')} className="btn-secondary">
              Connect Another Account
            </button>
          </div>
        )}

        {status === 'error' && (
          <div className="content center">
            <div className="error-icon">✕</div>
            <p className="status-msg error-text">{message}</p>
            <button onClick={() => setStatus('idle')} className="btn-secondary">
              Try Again
            </button>
          </div>
        )}

        <p className="footer">Powered by <strong>Omni API</strong> · <a href="https://api.omni7.io/swagger" target="_blank" rel="noreferrer">API Docs</a></p>
      </div>
    </div>
  )
}
