import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://api.omni7.io'

export default function App() {
  // checking | login | idle | needs_reauth | loading | success | manage
  const [status, setStatus]           = useState('checking')
  const [error, setError]             = useState('')
  const [metaUser, setMetaUser]       = useState(null)
  const [metaStatus, setMetaStatus]   = useState(null)   // GET /connect/meta/user/status response
  const [pages, setPages]             = useState([])
  const [selected, setSelected]       = useState([])
  const [pageError, setPageError]     = useState('')
  const [syncing, setSyncing]         = useState(false)
  const [saving, setSaving]           = useState(false)
  const [disconnecting, setDisconnecting] = useState(false)
  const [user, setUser]               = useState(null)
  const [form, setForm]               = useState({ Email: '', Password: '' })
  const [loggingIn, setLoggingIn]     = useState(false)

  useEffect(() => {
    const params      = new URLSearchParams(window.location.search)
    const code        = params.get('code')
    const oauthError  = params.get('error')

    if (oauthError) {
      window.history.replaceState({}, '', window.location.pathname)
      checkSession().then(loggedIn => {
        if (loggedIn) checkMetaStatus().then(() => setError('Authorisation was cancelled.'))
      })
      return
    }

    if (code) {
      window.history.replaceState({}, '', window.location.pathname)
      checkSession().then(loggedIn => {
        if (loggedIn) {
          setStatus('loading')
          handleCallback(code)
        }
      })
      return
    }

    checkSession().then(loggedIn => {
      if (!loggedIn) { setStatus('login'); return }
      checkMetaStatus()
    })
  }, [])

  // ── Auth ────────────────────────────────────────────────────────────────

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
      checkMetaStatus()
    } catch { setError('Could not reach the server.') }
    setLoggingIn(false)
  }

  // ── Meta status check ───────────────────────────────────────────────────

  async function checkMetaStatus() {
    try {
      const res  = await fetch(`${API_URL}/api/v1/connect/meta/user/status`, { credentials: 'include' })
      const data = await res.json().catch(() => ({}))

      if (!res.ok || !data.is_connected) { setStatus('idle'); return }

      setMetaStatus(data)

      if (data.connection_status === 'needs_reauth') { setStatus('needs_reauth'); return }
      if (data.connection_status === 'revoked')      { setStatus('idle'); return }

      // active — go straight to manage
      setStatus('manage')
      loadPages()
    } catch { setStatus('idle') }
  }

  // ── OAuth flow ──────────────────────────────────────────────────────────

  async function handleConnect() {
    setStatus('loading')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v1/connect/user/meta`, {
        method: 'POST',
        credentials: 'include',
      })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setStatus('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setStatus('idle') }
  }

  async function handleCallback(code) {
    try {
      const res  = await fetch(
        `${API_URL}/api/v1/connect/meta/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST', credentials: 'include' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setStatus('idle'); return }
      setMetaUser(data)
      await syncPages(true)
      setStatus('success')
    } catch { setError('Could not reach the server.'); setStatus('idle') }
  }

  // ── Pages ───────────────────────────────────────────────────────────────

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
        setSelected(selectAll
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
        setSelected(accounts.filter(a => a.is_active).map(a => a.account_id))
        if (accounts.length === 0) setPageError('No pages connected yet.')
      }
    } catch { setPageError('Could not reach the server.') }
    setSyncing(false)
  }

  async function saveSelection() {
    setSaving(true)
    try {
      await fetch(`${API_URL}/api/v1/connect/meta/page`, {
        method: 'PATCH',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ accountIds: selected }),
      })
    } catch { /* non-fatal */ }
    setSaving(false)
  }

  function togglePage(id) {
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id])
  }

  // ── Disconnect ──────────────────────────────────────────────────────────

  async function handleDisconnect() {
    setDisconnecting(true)
    try {
      await fetch(`${API_URL}/api/v1/connect/meta/user/detail`, {
        method: 'DELETE',
        credentials: 'include',
      })
    } catch { /* non-fatal */ }
    setDisconnecting(false)
    setPages([])
    setSelected([])
    setMetaUser(null)
    setMetaStatus(null)
    setStatus('idle')
    setError('')
  }

  async function openManage() {
    setStatus('manage')
    await loadPages()
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  function expiryLabel() {
    if (!metaStatus?.days_until_expiry) return null
    const d = metaStatus.days_until_expiry
    if (d <= 3)  return { text: `Token expires in ${d} day${d !== 1 ? 's' : ''} — reconnect soon`, warn: true }
    if (d <= 10) return { text: `Token expires in ${d} days`, warn: true }
    return null
  }

  // ── Render ───────────────────────────────────────────────────────────────

  if (status === 'checking') return null

  const expiry = expiryLabel()

  return (
    <div className="wrap">
      <p className="wordmark">omni</p>

      {/* ── Login ── */}
      {status === 'login' && (
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

      {/* ── Idle (not connected) ── */}
      {status === 'idle' && (
        <>
          <h1>Connect Facebook</h1>
          <p className="sub">
            Signed in as <strong>{user?.firstName} {user?.lastName}</strong> · {user?.email}
          </p>
          {error && <p className="err">{error}</p>}
          <button className="btn-fb" onClick={handleConnect}>
            <span className="fb-f">f</span>
            Continue with Facebook
          </button>
          <button className="btn-text" onClick={openManage}>
            Manage connected pages
          </button>
        </>
      )}

      {/* ── Needs reauth ── */}
      {status === 'needs_reauth' && (
        <>
          <h1>Reconnect Facebook</h1>
          <p className="sub">
            Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
            {metaStatus?.meta_user_name && <> · Facebook: <strong>{metaStatus.meta_user_name}</strong></>}
          </p>
          <p className="err" style={{ marginBottom: 16 }}>
            Your Facebook token has expired. Please reconnect to keep posting.
          </p>
          <button className="btn-fb" onClick={handleConnect}>
            <span className="fb-f">f</span>
            Reconnect Facebook
          </button>
          <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting...' : 'Disconnect Facebook'}
          </button>
        </>
      )}

      {/* ── Loading ── */}
      {status === 'loading' && <p className="hint">Connecting...</p>}

      {/* ── Success / Manage ── */}
      {(status === 'success' || status === 'manage') && (
        <>
          {status === 'success' && (
            <>
              <h1>You're connected</h1>
              {metaUser && <p className="sub">Logged in as <strong>{metaUser.meta_user_name}</strong></p>}
            </>
          )}
          {status === 'manage' && (
            <>
              <h1>Manage pages</h1>
              <p className="sub">
                Signed in as <strong>{user?.firstName} {user?.lastName}</strong>
                {metaStatus?.meta_user_name && <> · Facebook: <strong>{metaStatus.meta_user_name}</strong></>}
              </p>
              {expiry && (
                <p className={expiry.warn ? 'err' : 'hint'} style={{ marginBottom: 12 }}>
                  {expiry.text}
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
                        checked={selected.includes(p.account_id)}
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
              <button className="btn-primary" onClick={saveSelection} disabled={saving}>
                {saving ? 'Saving...' : 'Save selection'}
              </button>
            </>
          )}

          {!syncing && pageError && <p className="err" style={{ marginTop: 12 }}>{pageError}</p>}
          {!syncing && <button className="btn-text" onClick={() => syncPages(false)}>Resync pages</button>}

          <button className="btn-text" onClick={() => { setStatus('idle'); setError('') }}>
            {status === 'manage' ? 'Back' : 'Connect another account'}
          </button>
          <button className="btn-disconnect" onClick={handleDisconnect} disabled={disconnecting}>
            {disconnecting ? 'Disconnecting...' : 'Disconnect Facebook'}
          </button>
        </>
      )}
    </div>
  )
}
