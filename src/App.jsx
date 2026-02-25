import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.omni7.io'

export default function App() {
  const [status, setStatus] = useState('idle')
  const [message, setMessage] = useState('')
  const [metaUser, setMetaUser] = useState(null)

  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error) {
      setStatus('error')
      setMessage('Authorisation was cancelled.')
      window.history.replaceState({}, '', window.location.pathname)
      return
    }

    if (code) {
      setStatus('loading')
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
        setMessage(data?.message || 'Something went wrong. Please try again.')
        return
      }
      setMetaUser(data)
      setStatus('success')
      window.history.replaceState({}, '', window.location.pathname)
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Check your connection.')
    }
  }

  async function handleConnect() {
    setStatus('loading')
    try {
      const res = await fetch(`${API_URL}/api/v1/connect/user/meta`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.status === 401) {
        setStatus('error')
        setMessage('You need to be logged in first.')
        return
      }
      if (!res.ok) {
        setStatus('error')
        setMessage('Something went wrong. Please try again.')
        return
      }
      const data = await res.json()
      window.location.href = data.url
    } catch {
      setStatus('error')
      setMessage('Could not reach the server. Check your connection.')
    }
  }

  return (
    <div className="wrap">
      <p className="wordmark">omni</p>

      {status === 'idle' && (
        <>
          <h1>Connect Facebook</h1>
          <p className="sub">Link your Facebook & Instagram account to get started.</p>
          <button className="btn-fb" onClick={handleConnect}>
            <span className="fb-f">f</span>
            Continue with Facebook
          </button>
        </>
      )}

      {status === 'loading' && (
        <p className="hint">Connecting...</p>
      )}

      {status === 'success' && (
        <>
          <h1>You're connected</h1>
          {metaUser && <p className="sub">Logged in as <strong>{metaUser.meta_user_name}</strong></p>}
          <button className="btn-text" onClick={() => setStatus('idle')}>Connect another account</button>
        </>
      )}

      {status === 'error' && (
        <>
          <h1>Something went wrong</h1>
          <p className="sub">{message}</p>
          <button className="btn-fb" onClick={() => setStatus('idle')}>Try again</button>
        </>
      )}
    </div>
  )
}
