import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.omni7.io'

export default function App() {
  // ── Top-level screen ──────────────────────────────────────────────────────
  // checking | login | home | meta | google
  const [screen, setScreen]           = useState('checking')

  // ── Auth ──────────────────────────────────────────────────────────────────
  const [user, setUser]               = useState(null)
  const [form, setForm]               = useState({ Email: '', Password: '' })
  const [loggingIn, setLoggingIn]     = useState(false)
  const [error, setError]             = useState('')

  // ── Meta ──────────────────────────────────────────────────────────────────
  // idle | loading | success | manage | needs_reauth
  const [metaSub, setMetaSub]         = useState('idle')
  const [metaStatus, setMetaStatus]   = useState(null)
  const [metaUser, setMetaUser]       = useState(null)
  const [pages, setPages]             = useState([])
  const [selectedPages, setSelectedPages] = useState([])
  const [pageError, setPageError]     = useState('')

  // ── Google ────────────────────────────────────────────────────────────────
  // idle | loading | success | manage | needs_reauth
  const [googleSub, setGoogleSub]     = useState('idle')
  const [googleStatus, setGoogleStatus] = useState(null)
  const [googleUser, setGoogleUser]   = useState(null)
  const [locations, setLocations]     = useState([])
  const [selectedLocs, setSelectedLocs] = useState([])
  const [locationError, setLocationError] = useState('')

  // ── Shared loading flags ──────────────────────────────────────────────────
  const [syncing, setSyncing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)

  // ── Boot ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const params     = new URLSearchParams(window.location.search)
    const code       = params.get('code')
    const oauthError = params.get('error')
    const provider   = params.get('provider') // 'google' injected by /google redirect page

    window.history.replaceState({}, '', window.location.pathname)

    if (provider === 'google') {
      checkSession().then(loggedIn => {
        if (!loggedIn) { setScreen('login'); return }
        if (oauthError) {
          checkBothStatuses().then(() => setError('Google authorisation was cancelled.'))
          return
        }
        if (code) {
          setScreen('google')
          setGoogleSub('loading')
          handleGoogleCallback(code)
          return
        }
        checkBothStatuses()
      })
      return
    }

    if (oauthError) {
      checkSession().then(loggedIn => {
        if (!loggedIn) { setScreen('login'); return }
        checkBothStatuses().then(() => setError('Authorisation was cancelled.'))
      })
      return
    }

    if (code) {
      checkSession().then(loggedIn => {
        if (!loggedIn) { setScreen('login'); return }
        setScreen('meta')
        setMetaSub('loading')
        handleMetaCallback(code)
      })
      return
    }

    checkSession().then(loggedIn => {
      if (!loggedIn) { setScreen('login'); return }
      checkBothStatuses()
    })
  }, [])

  // ── Auth ──────────────────────────────────────────────────────────────────

  async function checkSession() {
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/user/detail`, { credentials: 'include' })
      if (res.ok) { setUser(await res.json()); return true }
      return false
    } catch { return false }
  }

  async function handleLogin(e) {
    e.preventDefault()
    setLoggingIn(true)
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/auth/public/login`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (!res.ok) { setError('Incorrect email or password.'); setLoggingIn(false); return }
      setUser(await res.json())
      checkBothStatuses()
    } catch { setError('Could not reach the server.') }
    setLoggingIn(false)
  }

  // ── Status checks ─────────────────────────────────────────────────────────

  async function checkBothStatuses() {
    await Promise.all([checkMetaStatus(), checkGoogleStatus()])
    setScreen('home')
  }

  async function checkMetaStatus() {
    try {
      const res  = await fetch(`${API_URL}/api/v1/connect/meta/user/status`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.is_connected) { setMetaStatus(null); setMetaSub('idle'); return }
      setMetaStatus(data)
      if (data.connection_status === 'needs_reauth') { setMetaSub('needs_reauth'); return }
      if (data.connection_status === 'revoked')      { setMetaStatus(null); setMetaSub('idle'); return }
      setMetaSub('manage')
    } catch { setMetaStatus(null); setMetaSub('idle') }
  }

  async function checkGoogleStatus() {
    try {
      const res  = await fetch(`${API_URL}/api/v0/connect/google/user/status`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || !data.is_connected) { setGoogleStatus(null); setGoogleSub('idle'); return }
      setGoogleStatus(data)
      if (data.connection_status === 'needs_reauth') { setGoogleSub('needs_reauth'); return }
      if (data.connection_status === 'revoked')      { setGoogleStatus(null); setGoogleSub('idle'); return }
      setGoogleSub('manage')
    } catch { setGoogleStatus(null); setGoogleSub('idle') }
  }

  // ── Meta OAuth ────────────────────────────────────────────────────────────

  async function handleMetaConnect() {
    setMetaSub('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/connect/user/meta`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.status === 401) { setUser(null); setError('Your session has expired. Please sign in again.'); setScreen('login'); return }
      if (!res.ok) { setError('Something went wrong. Please try again.'); setMetaSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setMetaSub('idle') }
  }

  async function handleMetaCallback(code) {
    try {
      const res  = await fetch(
        `${API_URL}/api/v1/connect/meta/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST', credentials: 'include' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setMetaSub('idle'); return }
      setMetaUser(data)
      await syncPages(true)
      await checkMetaStatus()
      setMetaSub('success')
    } catch { setError('Could not reach the server.'); setMetaSub('idle') }
  }

  async function syncPages(selectAll = false) {
    setSyncing(true)
    setPageError('')
    try {
      const res  = await fetch(`${API_URL}/api/v1/connect/meta/page`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPageError(data?.message || 'Could not load pages.')
      } else {
        const accounts = data.accounts || []
        setPages(accounts)
        setSelectedPages(selectAll
          ? accounts.map(a => a.account_id)
          : accounts.filter(a => a.is_active).map(a => a.account_id)
        )
        if (accounts.length === 0) setPageError('No Facebook Pages found on this account.')
      }
    } catch { setPageError('Could not reach the server.') }
    setSyncing(false)
  }

  async function loadPages() {
    setSyncing(true)
    setPageError('')
    try {
      const res  = await fetch(`${API_URL}/api/v1/connect/meta/page`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setPageError(data?.message || 'Could not load pages.')
      } else {
        const accounts = data.accounts || []
        setPages(accounts)
        setSelectedPages(accounts.filter(a => a.is_active).map(a => a.account_id))
        if (accounts.length === 0) setPageError('No pages connected yet.')
      }
    } catch { setPageError('Could not reach the server.') }
    setSyncing(false)
  }

  async function savePageSelection() {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/v1/connect/meta/page`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: selectedPages }),
      })
    } catch { /* non-fatal */ }
    setSaving(false)
  }

  function togglePage(id) {
    setSelectedPages(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleMetaDisconnect() {
    setDisconnecting(true)
    try {
      await fetch(`${API_URL}/api/v1/connect/meta/user/detail`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch { /* non-fatal */ }
    setDisconnecting(false)
    setPages([])
    setSelectedPages([])
    setMetaUser(null)
    setMetaStatus(null)
    setMetaSub('idle')
    setError('')
    setScreen('home')
  }

  // ── Google OAuth ──────────────────────────────────────────────────────────

  async function handleGoogleConnect() {
    setGoogleSub('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/google`, {
        method: 'POST',
        credentials: 'include',
      })
      if (res.status === 401) { setUser(null); setError('Your session has expired. Please sign in again.'); setScreen('login'); return }
      if (!res.ok) { setError('Something went wrong. Please try again.'); setGoogleSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setGoogleSub('idle') }
  }

  async function handleGoogleCallback(code) {
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/google/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST', credentials: 'include' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setGoogleSub('idle'); return }
      setGoogleUser(data)
      await syncLocations(true)
      await checkGoogleStatus()
      setGoogleSub('success')
    } catch { setError('Could not reach the server.'); setGoogleSub('idle') }
  }

  async function syncLocations(selectAll = false) {
    setSyncing(true)
    setLocationError('')
    try {
      const res  = await fetch(`${API_URL}/api/v0/connect/google/account`, {
        method: 'POST',
        credentials: 'include',
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLocationError(data?.message || 'Could not load locations.')
      } else {
        const accounts = data.accounts || []
        setLocations(accounts)
        setSelectedLocs(selectAll
          ? accounts.map(a => a.account_id)
          : accounts.filter(a => a.is_active).map(a => a.account_id)
        )
        if (accounts.length === 0) setLocationError('No Google Business Profile locations found.')
      }
    } catch { setLocationError('Could not reach the server.') }
    setSyncing(false)
  }

  async function loadLocations() {
    setSyncing(true)
    setLocationError('')
    try {
      const res  = await fetch(`${API_URL}/api/v0/connect/google/account`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLocationError(data?.message || 'Could not load locations.')
      } else {
        const accounts = data.accounts || []
        setLocations(accounts)
        setSelectedLocs(accounts.filter(a => a.is_active).map(a => a.account_id))
        if (accounts.length === 0) setLocationError('No locations connected yet.')
      }
    } catch { setLocationError('Could not reach the server.') }
    setSyncing(false)
  }

  async function saveLocationSelection() {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/v0/connect/google/account`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: selectedLocs }),
      })
    } catch { /* non-fatal */ }
    setSaving(false)
  }

  function toggleLocation(id) {
    setSelectedLocs(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  async function handleGoogleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch(`${API_URL}/api/v0/connect/google/user/detail`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch { /* non-fatal */ }
    setDisconnecting(false)
    setLocations([])
    setSelectedLocs([])
    setGoogleUser(null)
    setGoogleStatus(null)
    setGoogleSub('idle')
    setError('')
    setScreen('home')
  }

  // ── Navigation helpers ────────────────────────────────────────────────────

  function goHome() {
    setError('')
    setScreen('home')
  }

  function openMeta() {
    setError('')
    setScreen('meta')
    if (metaSub === 'manage') loadPages()
  }

  function openGoogle() {
    setError('')
    setScreen('google')
    if (googleSub === 'manage') loadLocations()
  }

  // ── Helpers ───────────────────────────────────────────────────────────────

  function metaExpiryLabel() {
    if (!metaStatus?.days_until_expiry) return null
    const d = metaStatus.days_until_expiry
    if (d <= 3)  return { text: `Token expires in ${d} day${d !== 1 ? 's' : ''} — reconnect soon`, warn: true }
    if (d <= 10) return { text: `Token expires in ${d} days`, warn: false }
    return null
  }

  function platformStatusText(status, countKey, countLabel) {
    if (!status?.is_connected) return 'Not connected'
    if (status.connection_status === 'needs_reauth') return 'Needs reconnection'
    if (status.connection_status === 'revoked') return 'Not connected'
    const n = status[countKey] ?? 0
    return `Connected · ${n} active ${countLabel}${n !== 1 ? 's' : ''}`
  }

  function platformDotClass(status) {
    if (!status?.is_connected) return 'off'
    if (status.connection_status === 'needs_reauth') return 'warn'
    if (status.connection_status === 'revoked') return 'off'
    return 'on'
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (screen === 'checking') return null

  const metaExpiry = metaExpiryLabel()

  return (
    <div className="wrap">
      <p className="wordmark">omni</p>

      {/* ────────────────────── Login ────────────────────── */}
      {screen === 'login' && (
        <>
          <h1>Sign in</h1>
          <p className="sub">Sign in to your Omni account to continue.</p>
          <form onSubmit={handleLogin}>
            <input
              className="input" type="email" placeholder="Email"
              value={form.Email}
              onChange={e => setForm(f => ({ ...f, Email: e.target.value }))}
              required
            />
            <input
              className="input" type="password" placeholder="Password"
              value={form.Password}
              onChange={e => setForm(f => ({ ...f, Password: e.target.value }))}
              required
            />
            {error && <p className="err">{error}</p>}
            <button className="btn-primary" type="submit" disabled={loggingIn}>
              {loggingIn ? 'Signing in...' : 'Sign in'}
            </button>
          </form>
        </>
      )}

      {/* ────────────────────── Home hub ────────────────────── */}
      {screen === 'home' && (
        <>
          <h1>Connections</h1>
          <p className="sub">
            Signed in as <strong>{user?.firstName} {user?.lastName}</strong> · {user?.email}
          </p>
          {error && <p className="err">{error}</p>}

          <div className="platform-card platform-meta" onClick={openMeta}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-fb">f</div>
              <div>
                <p className="platform-name">Facebook &amp; Instagram</p>
                <p className="platform-detail">
                  {platformStatusText(metaStatus, 'active_pages', 'page')}
                </p>
              </div>
            </div>
            <span className={`status-dot ${platformDotClass(metaStatus)}`} />
          </div>

          <div className="platform-card platform-google" onClick={openGoogle}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-google">G</div>
              <div>
                <p className="platform-name">Google Business Profile</p>
                <p className="platform-detail">
                  {platformStatusText(googleStatus, 'active_locations', 'location')}
                </p>
              </div>
            </div>
            <span className={`status-dot ${platformDotClass(googleStatus)}`} />
          </div>
        </>
      )}

      {/* ────────────────────── Meta screens ────────────────────── */}
      {screen === 'meta' && (
        <>
          {/* idle */}
          {metaSub === 'idle' && (
            <>
              <h1>Connect Facebook</h1>
              <p className="sub">
                Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn-fb" onClick={handleMetaConnect}>
                <span className="fb-f">f</span>
                Continue with Facebook
              </button>
              <button className="btn-text" onClick={() => { setMetaSub('manage'); loadPages() }}>
                Manage connected pages
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {/* loading */}
          {metaSub === 'loading' && <p className="hint">Connecting to Facebook...</p>}

          {/* needs_reauth */}
          {metaSub === 'needs_reauth' && (
            <>
              <h1>Reconnect Facebook</h1>
              <p className="sub">
                Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
                {metaStatus?.meta_user_name && <> · Facebook: <strong>{metaStatus.meta_user_name}</strong></>}
              </p>
              <p className="err" style={{ marginBottom: 16 }}>
                Your Facebook token has expired. Please reconnect to keep posting.
              </p>
              <button className="btn-fb" onClick={handleMetaConnect}>
                <span className="fb-f">f</span>
                Reconnect Facebook
              </button>
              <button className="btn-disconnect" onClick={handleMetaDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect Facebook'}
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {/* success + manage */}
          {(metaSub === 'success' || metaSub === 'manage') && (
            <>
              {metaSub === 'success' && (
                <>
                  <h1>Facebook connected</h1>
                  {metaUser && <p className="sub">Logged in as <strong>{metaUser.meta_user_name}</strong></p>}
                </>
              )}
              {metaSub === 'manage' && (
                <>
                  <h1>Manage pages</h1>
                  <p className="sub">
                    Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
                    {metaStatus?.meta_user_name && <> · Facebook: <strong>{metaStatus.meta_user_name}</strong></>}
                  </p>
                  {metaExpiry && (
                    <p className={metaExpiry.warn ? 'err' : 'hint'} style={{ marginBottom: 12 }}>
                      {metaExpiry.text}
                    </p>
                  )}
                  {metaStatus?.active_pages != null && (
                    <p className="hint" style={{ marginBottom: 12 }}>
                      {metaStatus.active_pages} active page{metaStatus.active_pages !== 1 ? 's' : ''}
                    </p>
                  )}
                </>
              )}

              {syncing && <p className="hint">Loading pages...</p>}

              {!syncing && pages.length > 0 && (
                <>
                  <ul className="page-list">
                    {pages.map(p => (
                      <li key={p.account_id} className="page-item">
                        <label className="page-row">
                          <div className="page-info">
                            <span className="page-name">{p.account_name || p.account_id}</span>
                            <span className="page-platform">{p.platform}</span>
                          </div>
                          <input
                            type="checkbox"
                            className="page-check"
                            checked={selectedPages.includes(p.account_id)}
                            onChange={() => togglePage(p.account_id)}
                          />
                        </label>
                        {p.account_token && (
                          <div className="page-token-row">
                            <span className="page-token">{p.account_token}</span>
                            <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_token)}>
                              Copy
                            </button>
                          </div>
                        )}
                      </li>
                    ))}
                  </ul>
                  <button className="btn-primary" onClick={savePageSelection} disabled={saving}>
                    {saving ? 'Saving...' : 'Save selection'}
                  </button>
                </>
              )}

              {!syncing && pageError && <p className="err" style={{ marginTop: 12 }}>{pageError}</p>}
              {!syncing && <button className="btn-text" onClick={() => syncPages(false)}>Resync pages</button>}

              <button className="btn-text" onClick={goHome}>
                {metaSub === 'manage' ? 'Back' : 'Connect another account'}
              </button>
              <button className="btn-disconnect" onClick={handleMetaDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect Facebook'}
              </button>
            </>
          )}
        </>
      )}

      {/* ────────────────────── Google screens ────────────────────── */}
      {screen === 'google' && (
        <>
          {/* idle */}
          {googleSub === 'idle' && (
            <>
              <h1>Connect Google</h1>
              <p className="sub">
                Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
              </p>
              <p className="sub" style={{ marginTop: -20, marginBottom: 24, fontSize: 13, color: '#888' }}>
                Connect your Google Business Profile to manage and respond to reviews.
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn-google" onClick={handleGoogleConnect}>
                <span className="google-g">G</span>
                Continue with Google
              </button>
              <button className="btn-text" onClick={() => { setGoogleSub('manage'); loadLocations() }}>
                Manage connected locations
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {/* loading */}
          {googleSub === 'loading' && <p className="hint">Connecting to Google...</p>}

          {/* needs_reauth */}
          {googleSub === 'needs_reauth' && (
            <>
              <h1>Reconnect Google</h1>
              <p className="sub">
                Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
                {googleStatus?.email && <> · Google: <strong>{googleStatus.email}</strong></>}
              </p>
              <p className="err" style={{ marginBottom: 16 }}>
                Your Google access has expired or been revoked. Please reconnect.
              </p>
              <button className="btn-google" onClick={handleGoogleConnect}>
                <span className="google-g">G</span>
                Reconnect Google
              </button>
              <button className="btn-disconnect" onClick={handleGoogleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect Google'}
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {/* success + manage */}
          {(googleSub === 'success' || googleSub === 'manage') && (
            <>
              {googleSub === 'success' && (
                <>
                  <h1>Google connected</h1>
                  {(googleUser || googleStatus) && (
                    <p className="sub">
                      Signed in as <strong>{googleUser?.email || googleStatus?.email}</strong>
                    </p>
                  )}
                </>
              )}
              {googleSub === 'manage' && (
                <>
                  <h1>Manage locations</h1>
                  <p className="sub">
                    Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
                    {googleStatus?.email && <> · Google: <strong>{googleStatus.email}</strong></>}
                  </p>
                  {googleStatus?.active_locations != null && (
                    <p className="hint" style={{ marginBottom: 12 }}>
                      {googleStatus.active_locations} active location{googleStatus.active_locations !== 1 ? 's' : ''}
                    </p>
                  )}
                </>
              )}

              {syncing && <p className="hint">Loading locations...</p>}

              {!syncing && locations.length > 0 && (
                <>
                  <ul className="page-list">
                    {locations.map(loc => (
                      <li key={loc.account_id} className="page-item">
                        <label className="page-row">
                          <div className="page-info">
                            <span className="page-name">{loc.account_name || loc.account_id}</span>
                            <span className="page-platform">Google Business</span>
                          </div>
                          <input
                            type="checkbox"
                            className="page-check"
                            checked={selectedLocs.includes(loc.account_id)}
                            onChange={() => toggleLocation(loc.account_id)}
                          />
                        </label>
                      </li>
                    ))}
                  </ul>
                  <button className="btn-primary" onClick={saveLocationSelection} disabled={saving}>
                    {saving ? 'Saving...' : 'Save selection'}
                  </button>
                </>
              )}

              {!syncing && locationError && <p className="err" style={{ marginTop: 12 }}>{locationError}</p>}
              {!syncing && <button className="btn-text" onClick={() => syncLocations(false)}>Resync locations</button>}

              <button className="btn-text" onClick={goHome}>
                {googleSub === 'manage' ? 'Back' : 'Connect another account'}
              </button>
              <button className="btn-disconnect" onClick={handleGoogleDisconnect} disabled={disconnecting}>
                {disconnecting ? 'Disconnecting...' : 'Disconnect Google'}
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
