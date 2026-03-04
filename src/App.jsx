import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://dev-api.omni7.io'

export default function App() {
  // home | meta | google
  const [screen, setScreen]           = useState('loading')
  const [error, setError]             = useState('')

  // ── Meta ──────────────────────────────────────────────────────────────────
  // idle | loading | success
  const [metaSub, setMetaSub]         = useState('idle')
  const [metaUser, setMetaUser]       = useState(null)   // { user_token, meta_user_name }
  const [pages, setPages]             = useState([])
  const [pageError, setPageError]     = useState('')
  const [syncing, setSyncing]         = useState(false)

  // ── Google ────────────────────────────────────────────────────────────────
  // idle | loading | success
  const [googleSub, setGoogleSub]     = useState('idle')
  const [googleUser, setGoogleUser]   = useState(null)   // { access_token, email }
  const [locations, setLocations]     = useState([])
  const [locationError, setLocationError] = useState('')
  const [syncingGoogle, setSyncingGoogle] = useState(false)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params   = new URLSearchParams(window.location.search)
    const code     = params.get('code')
    const oauthErr = params.get('error')
    const provider = params.get('provider')

    window.history.replaceState({}, '', window.location.pathname)

    if (provider === 'google') {
      setScreen('google')
      if (oauthErr) { setError('Google authorisation was cancelled.'); setGoogleSub('idle'); return }
      if (code) { setGoogleSub('loading'); handleGoogleCallback(code); return }
      setGoogleSub('idle')
      return
    }

    if (oauthErr) { setScreen('meta'); setError('Authorisation was cancelled.'); setMetaSub('idle'); return }

    if (code) { setScreen('meta'); setMetaSub('loading'); handleMetaCallback(code); return }

    setScreen('home')
  }, [])

  // ── Meta OAuth ────────────────────────────────────────────────────────────

  async function handleMetaConnect() {
    setMetaSub('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/meta`, { method: 'POST' })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setMetaSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setMetaSub('idle') }
  }

  async function handleMetaCallback(code) {
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/meta/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setMetaSub('idle'); return }

      setMetaUser(data)
      await fetchPages(data.user_token)
      setMetaSub('success')
    } catch { setError('Could not reach the server.'); setMetaSub('idle') }
  }

  async function fetchPages(userToken) {
    setSyncing(true)
    setPageError('')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/meta/page?token=${encodeURIComponent(userToken)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPageError(data?.message || 'Could not load pages.')
      } else {
        setPages(data.accounts || [])
        if ((data.accounts || []).length === 0) setPageError('No Facebook Pages found on this account.')
      }
    } catch { setPageError('Could not reach the server.') }
    setSyncing(false)
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function handleGoogleConnect() {
    setGoogleSub('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/google`, { method: 'POST' })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setGoogleSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setGoogleSub('idle') }
  }

  async function handleGoogleCallback(code) {
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/google/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setGoogleSub('idle'); return }

      setGoogleUser(data)
      await fetchLocations(data.access_token)
      setGoogleSub('success')
    } catch { setError('Could not reach the server.'); setGoogleSub('idle') }
  }

  async function fetchLocations(accessToken) {
    setSyncingGoogle(true)
    setLocationError('')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/google/account?token=${encodeURIComponent(accessToken)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLocationError(data?.message || 'Could not load locations.')
      } else {
        setLocations(data.accounts || [])
        if ((data.accounts || []).length === 0) setLocationError('No Google Business Profile locations found.')
      }
    } catch { setLocationError('Could not reach the server.') }
    setSyncingGoogle(false)
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function goHome()     { setError(''); setScreen('home') }
  function openMeta()   { setError(''); setScreen('meta') }
  function openGoogle() { setError(''); setScreen('google') }

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'loading') return null

  return (
    <div className="wrap">
      <p className="wordmark">omni</p>

      {/* ────────────────────── Home ────────────────────── */}
      {screen === 'home' && (
        <>
          <h1>Connections</h1>
          {error && <p className="err">{error}</p>}

          <div className="platform-card platform-meta" onClick={openMeta}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-fb">f</div>
              <div>
                <p className="platform-name">Facebook &amp; Instagram</p>
                <p className="platform-detail">Connect your pages</p>
              </div>
            </div>
          </div>

          <div className="platform-card platform-google" onClick={openGoogle}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-google">G</div>
              <div>
                <p className="platform-name">Google Business Profile</p>
                <p className="platform-detail">Connect your locations</p>
              </div>
            </div>
          </div>
        </>
      )}

      {/* ────────────────────── Meta ────────────────────── */}
      {screen === 'meta' && (
        <>
          {metaSub === 'idle' && (
            <>
              <h1>Connect Facebook</h1>
              {error && <p className="err">{error}</p>}
              <button className="btn-fb" onClick={handleMetaConnect}>
                <span className="fb-f">f</span>
                Continue with Facebook
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {metaSub === 'loading' && <p className="hint">Connecting to Facebook...</p>}

          {metaSub === 'success' && (
            <>
              <h1>Facebook connected</h1>
              {metaUser?.meta_user_name && (
                <p className="sub">Logged in as <strong>{metaUser.meta_user_name}</strong></p>
              )}

              {syncing && <p className="hint">Loading pages...</p>}

              {!syncing && pages.length > 0 && (
                <ul className="page-list">
                  {pages.map(p => (
                    <li key={p.account_id} className="page-item">
                      <div className="page-row">
                        <div className="page-info">
                          <span className="page-name">{p.account_name || p.account_id}</span>
                          <span className="page-platform">{p.platform}</span>
                        </div>
                      </div>
                      <div className="page-token-row">
                        <span className="page-token">{p.account_token}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_token)}>
                          Copy
                        </button>
                      </div>
                      <div className="page-token-row" style={{ marginTop: 4 }}>
                        <span className="page-token" style={{ color: '#888' }}>ID: {p.account_id}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_id)}>
                          Copy
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!syncing && pageError && <p className="err" style={{ marginTop: 12 }}>{pageError}</p>}

              {!syncing && metaUser?.user_token && (
                <button className="btn-text" onClick={() => fetchPages(metaUser.user_token)}>
                  Resync pages
                </button>
              )}

              <button className="btn-text" onClick={goHome}>Back</button>
              <button className="btn-text" onClick={() => { setMetaSub('idle'); setPages([]); setMetaUser(null) }}>
                Connect another account
              </button>
            </>
          )}
        </>
      )}

      {/* ────────────────────── Google ────────────────────── */}
      {screen === 'google' && (
        <>
          {googleSub === 'idle' && (
            <>
              <h1>Connect Google</h1>
              <p className="sub" style={{ marginBottom: 24, fontSize: 13, color: '#888' }}>
                Connect your Google Business Profile to manage and respond to reviews.
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn-google" onClick={handleGoogleConnect}>
                <span className="google-g">G</span>
                Continue with Google
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {googleSub === 'loading' && <p className="hint">Connecting to Google...</p>}

          {googleSub === 'success' && (
            <>
              <h1>Google connected</h1>
              {googleUser?.email && (
                <p className="sub">Signed in as <strong>{googleUser.email}</strong></p>
              )}

              {syncingGoogle && <p className="hint">Loading locations...</p>}

              {!syncingGoogle && locations.length > 0 && (
                <ul className="page-list">
                  {locations.map(loc => (
                    <li key={loc.account_id} className="page-item">
                      <div className="page-row">
                        <div className="page-info">
                          <span className="page-name">{loc.account_name || loc.account_id}</span>
                          <span className="page-platform">Google Business</span>
                        </div>
                      </div>
                      <div className="page-token-row" style={{ marginTop: 4 }}>
                        <span className="page-token" style={{ color: '#888' }}>ID: {loc.account_id}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(loc.account_id)}>
                          Copy
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}

              {!syncingGoogle && locationError && <p className="err" style={{ marginTop: 12 }}>{locationError}</p>}

              {!syncingGoogle && googleUser?.access_token && (
                <button className="btn-text" onClick={() => fetchLocations(googleUser.access_token)}>
                  Resync locations
                </button>
              )}

              <button className="btn-text" onClick={goHome}>Back</button>
              <button className="btn-text" onClick={() => { setGoogleSub('idle'); setLocations([]); setGoogleUser(null) }}>
                Connect another account
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
