import { useState, useEffect } from 'react'

const API_URL = import.meta.env.VITE_API_URL || 'https://dev-api.omni7.io'

// ── PKCE helpers (required by X OAuth 2.0) ────────────────────────────────
function generateCodeVerifier() {
  const array = new Uint8Array(32)
  crypto.getRandomValues(array)
  return btoa(String.fromCharCode(...array))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

async function generateCodeChallenge(verifier) {
  const data   = new TextEncoder().encode(verifier)
  const digest = await crypto.subtle.digest('SHA-256', data)
  return btoa(String.fromCharCode(...new Uint8Array(digest)))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=/g, '')
}

const X_VERIFIER_KEY = 'omni_x_code_verifier'

export default function App() {
  // home | meta | google | linkedin | x
  const [screen, setScreen]           = useState('loading')
  const [error, setError]             = useState('')

  // ── Meta ──────────────────────────────────────────────────────────────────
  const [metaSub, setMetaSub]         = useState('idle')
  const [metaMsg, setMetaMsg]         = useState('')
  const [metaUser, setMetaUser]       = useState(null)
  const [pages, setPages]             = useState([])
  const [pageError, setPageError]     = useState('')
  const [syncing, setSyncing]         = useState(false)

  // ── Google ────────────────────────────────────────────────────────────────
  const [googleSub, setGoogleSub]     = useState('idle')
  const [googleMsg, setGoogleMsg]     = useState('')
  const [googleUser, setGoogleUser]   = useState(null)
  const [locations, setLocations]     = useState([])
  const [locationError, setLocationError] = useState('')
  const [syncingGoogle, setSyncingGoogle] = useState(false)

  // ── LinkedIn ───────────────────────────────────────────────────────────────
  const [linkedinSub, setLinkedinSub]     = useState('idle')
  const [linkedinMsg, setLinkedinMsg]     = useState('')
  const [linkedinUser, setLinkedinUser]   = useState(null)
  const [linkedinPages, setLinkedinPages] = useState([])
  const [linkedinError, setLinkedinError] = useState('')
  const [syncingLinkedin, setSyncingLinkedin] = useState(false)

  // ── X ─────────────────────────────────────────────────────────────────────
  const [xSub, setXSub]               = useState('idle')
  const [xMsg, setXMsg]               = useState('')
  const [xUser, setXUser]             = useState(null)
  const [xError, setXError]           = useState('')

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

    if (provider === 'linkedin') {
      setScreen('linkedin')
      if (oauthErr) { setError('LinkedIn authorisation was cancelled.'); setLinkedinSub('idle'); return }
      if (code) { setLinkedinSub('loading'); handleLinkedInCallback(code); return }
      setLinkedinSub('idle')
      return
    }

    if (provider === 'x') {
      setScreen('x')
      if (oauthErr) {
        sessionStorage.removeItem(X_VERIFIER_KEY)
        setError('X authorisation was cancelled.')
        setXSub('idle')
        return
      }
      if (code) {
        const verifier = sessionStorage.getItem(X_VERIFIER_KEY)
        sessionStorage.removeItem(X_VERIFIER_KEY)
        if (!verifier) {
          setError('PKCE session expired. Please try connecting again.')
          setXSub('idle')
          return
        }
        setXSub('loading')
        handleXCallback(code, verifier)
        return
      }
      setXSub('idle')
      return
    }

    if (oauthErr) { setScreen('meta'); setError('Authorisation was cancelled.'); setMetaSub('idle'); return }
    if (code) { setScreen('meta'); setMetaSub('loading'); handleMetaCallback(code); return }

    setScreen('home')
  }, [])

  // ── Meta OAuth ────────────────────────────────────────────────────────────

  async function handleMetaConnect() {
    setMetaSub('loading')
    setMetaMsg('Connecting to Facebook...')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/meta`, { method: 'POST' })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setMetaSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setMetaSub('idle') }
  }

  async function handleMetaCallback(code) {
    setMetaMsg('Verifying with Facebook...')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/meta/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setMetaSub('idle'); return }
      setMetaUser(data)
      setMetaMsg('Please wait, we are getting all your pages...')
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
    setGoogleMsg('Connecting to Google...')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/google`, { method: 'POST' })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setGoogleSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setGoogleSub('idle') }
  }

  async function handleGoogleCallback(code) {
    setGoogleMsg('Verifying with Google...')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/google/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setGoogleSub('idle'); return }
      setGoogleUser(data)
      setGoogleMsg('Please wait, we are getting all your locations...')
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

  // ── LinkedIn OAuth ─────────────────────────────────────────────────────────

  async function handleLinkedInConnect() {
    setLinkedinSub('loading')
    setLinkedinMsg('Connecting to LinkedIn...')
    setError('')
    try {
      const res = await fetch(`${API_URL}/api/v0/connect/user/linkedin`, { method: 'POST' })
      if (!res.ok) { setError('Something went wrong. Please try again.'); setLinkedinSub('idle'); return }
      const data = await res.json()
      window.location.href = data.url
    } catch { setError('Could not reach the server.'); setLinkedinSub('idle') }
  }

  async function handleLinkedInCallback(code) {
    setLinkedinMsg('Verifying with LinkedIn...')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/linkedin/user/detail?token=${encodeURIComponent(code)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setLinkedinSub('idle'); return }
      setLinkedinUser(data)
      setLinkedinMsg('Please wait, we are getting all your LinkedIn Pages...')
      await fetchLinkedInPages(data.access_token)
      setLinkedinSub('success')
    } catch { setError('Could not reach the server.'); setLinkedinSub('idle') }
  }

  async function fetchLinkedInPages(accessToken) {
    setSyncingLinkedin(true)
    setLinkedinError('')
    try {
      const res  = await fetch(
        `${API_URL}/api/v0/connect/linkedin/account?token=${encodeURIComponent(accessToken)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setLinkedinError(data?.message || 'Could not load LinkedIn Pages.')
      } else {
        setLinkedinPages(data.accounts || [])
        if ((data.accounts || []).length === 0) setLinkedinError('No LinkedIn Pages found on this account.')
      }
    } catch { setLinkedinError('Could not reach the server.') }
    setSyncingLinkedin(false)
  }

  // ── X OAuth ───────────────────────────────────────────────────────────────

  async function handleXConnect() {
    setXSub('loading')
    setXMsg('Preparing secure connection...')
    setError('')
    try {
      // Generate PKCE pair client-side (required by X)
      const verifier   = generateCodeVerifier()
      const challenge  = await generateCodeChallenge(verifier)

      // Persist verifier in sessionStorage — survives the OAuth redirect within same tab
      sessionStorage.setItem(X_VERIFIER_KEY, verifier)

      const res = await fetch(
        `${API_URL}/api/v0/connect/user/x?code_challenge=${encodeURIComponent(challenge)}`,
        { method: 'POST' }
      )
      if (!res.ok) {
        sessionStorage.removeItem(X_VERIFIER_KEY)
        setError('Something went wrong. Please try again.')
        setXSub('idle')
        return
      }
      const data = await res.json()
      window.location.href = data.url
    } catch {
      sessionStorage.removeItem(X_VERIFIER_KEY)
      setError('Could not reach the server.')
      setXSub('idle')
    }
  }

  async function handleXCallback(code, verifier) {
    setXMsg('Verifying with X...')
    try {
      const res = await fetch(
        `${API_URL}/api/v0/connect/x/user/detail` +
          `?token=${encodeURIComponent(code)}` +
          `&code_verifier=${encodeURIComponent(verifier)}`,
        { method: 'POST' }
      )
      const data = await res.json().catch(() => ({}))
      if (!res.ok) { setError(data?.message || 'Something went wrong.'); setXSub('idle'); return }
      setXUser(data)
      setXSub('success')
    } catch { setError('Could not reach the server.'); setXSub('idle') }
  }

  // ── Navigation ────────────────────────────────────────────────────────────

  function goHome()        { setError(''); setScreen('home') }
  function openMeta()      { setError(''); setScreen('meta') }
  function openGoogle()    { setError(''); setScreen('google') }
  function openLinkedIn()  { setError(''); setScreen('linkedin') }
  function openX()         { setError(''); setScreen('x') }

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

          <div className="platform-card platform-linkedin" onClick={openLinkedIn}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-linkedin">in</div>
              <div>
                <p className="platform-name">LinkedIn</p>
                <p className="platform-detail">Connect your company pages</p>
              </div>
            </div>
          </div>

          <div className="platform-card platform-x" onClick={openX}>
            <div className="platform-card-left">
              <div className="platform-icon platform-icon-x">𝕏</div>
              <div>
                <p className="platform-name">X (Twitter)</p>
                <p className="platform-detail">Connect your account</p>
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

          {metaSub === 'loading' && <p className="hint">{metaMsg || 'Connecting to Facebook...'}</p>}

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
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_token)}>Copy</button>
                      </div>
                      <div className="page-token-row" style={{ marginTop: 4 }}>
                        <span className="page-token" style={{ color: '#888' }}>ID: {p.account_id}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_id)}>Copy</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!syncing && pageError && <p className="err" style={{ marginTop: 12 }}>{pageError}</p>}
              {!syncing && metaUser?.user_token && (
                <button className="btn-text" onClick={() => fetchPages(metaUser.user_token)}>Resync pages</button>
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

          {googleSub === 'loading' && <p className="hint">{googleMsg || 'Connecting to Google...'}</p>}

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
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(loc.account_id)}>Copy</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!syncingGoogle && locationError && <p className="err" style={{ marginTop: 12 }}>{locationError}</p>}
              {!syncingGoogle && googleUser?.access_token && (
                <button className="btn-text" onClick={() => fetchLocations(googleUser.access_token)}>Resync locations</button>
              )}
              <button className="btn-text" onClick={goHome}>Back</button>
              <button className="btn-text" onClick={() => { setGoogleSub('idle'); setLocations([]); setGoogleUser(null) }}>
                Connect another account
              </button>
            </>
          )}
        </>
      )}

      {/* ────────────────────── LinkedIn ────────────────────── */}
      {screen === 'linkedin' && (
        <>
          {linkedinSub === 'idle' && (
            <>
              <h1>Connect LinkedIn</h1>
              <p className="sub" style={{ marginBottom: 24, fontSize: 13, color: '#888' }}>
                Connect your LinkedIn Company Pages to manage posts and engagement.
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn-linkedin" onClick={handleLinkedInConnect}>
                <span className="linkedin-in">in</span>
                Continue with LinkedIn
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {linkedinSub === 'loading' && <p className="hint">{linkedinMsg || 'Connecting to LinkedIn...'}</p>}

          {linkedinSub === 'success' && (
            <>
              <h1>LinkedIn connected</h1>
              {(linkedinUser?.name || linkedinUser?.email) && (
                <p className="sub">Signed in as <strong>{linkedinUser.name || linkedinUser.email}</strong></p>
              )}
              {syncingLinkedin && <p className="hint">Loading LinkedIn Pages...</p>}
              {!syncingLinkedin && linkedinPages.length > 0 && (
                <ul className="page-list">
                  {linkedinPages.map(p => (
                    <li key={p.account_id} className="page-item">
                      <div className="page-row">
                        <div className="page-info">
                          <span className="page-name">{p.account_name}</span>
                          <span className="page-platform">LinkedIn</span>
                        </div>
                      </div>
                      {p.vanity_name && (
                        <div className="page-token-row" style={{ marginTop: 4 }}>
                          <span className="page-token" style={{ color: '#888' }}>@{p.vanity_name}</span>
                        </div>
                      )}
                      <div className="page-token-row" style={{ marginTop: 4 }}>
                        <span className="page-token" style={{ color: '#888' }}>ID: {p.account_id}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(p.account_id)}>Copy</button>
                      </div>
                      <div className="page-token-row" style={{ marginTop: 4 }}>
                        <span className="page-token">{linkedinUser?.access_token}</span>
                        <button className="btn-copy" onClick={() => navigator.clipboard.writeText(linkedinUser?.access_token)}>Copy token</button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
              {!syncingLinkedin && linkedinError && <p className="err" style={{ marginTop: 12 }}>{linkedinError}</p>}
              {!syncingLinkedin && linkedinUser?.access_token && (
                <button className="btn-text" onClick={() => fetchLinkedInPages(linkedinUser.access_token)}>Resync pages</button>
              )}
              <button className="btn-text" onClick={goHome}>Back</button>
              <button className="btn-text" onClick={() => { setLinkedinSub('idle'); setLinkedinPages([]); setLinkedinUser(null) }}>
                Connect another account
              </button>
            </>
          )}
        </>
      )}

      {/* ────────────────────── X ────────────────────── */}
      {screen === 'x' && (
        <>
          {xSub === 'idle' && (
            <>
              <h1>Connect X</h1>
              <p className="sub" style={{ marginBottom: 24, fontSize: 13, color: '#888' }}>
                Connect your X account to manage posts and engagement.
              </p>
              {error && <p className="err">{error}</p>}
              <button className="btn-x" onClick={handleXConnect}>
                <span className="x-logo">𝕏</span>
                Continue with X
              </button>
              <button className="btn-back" onClick={goHome}>← Back</button>
            </>
          )}

          {xSub === 'loading' && <p className="hint">{xMsg || 'Connecting to X...'}</p>}

          {xSub === 'success' && (
            <>
              <h1>X connected</h1>
              {(xUser?.name || xUser?.username) && (
                <p className="sub">
                  Signed in as <strong>{xUser.name || xUser.username}</strong>
                  {xUser?.username && xUser?.name && <span style={{ color: '#888', fontWeight: 400 }}> @{xUser.username}</span>}
                </p>
              )}
              {xUser?.followers_count != null && (
                <p style={{ fontSize: 13, color: '#888', marginBottom: 16 }}>
                  {xUser.followers_count.toLocaleString()} followers
                </p>
              )}

              <ul className="page-list">
                <li className="page-item">
                  <div className="page-row">
                    <div className="page-info">
                      <span className="page-name">{xUser?.name || xUser?.username}</span>
                      <span className="page-platform">X</span>
                    </div>
                  </div>
                  {xUser?.username && (
                    <div className="page-token-row" style={{ marginTop: 4 }}>
                      <span className="page-token" style={{ color: '#888' }}>@{xUser.username}</span>
                      <button className="btn-copy" onClick={() => navigator.clipboard.writeText(xUser.username)}>Copy</button>
                    </div>
                  )}
                  {xUser?.x_user_id && (
                    <div className="page-token-row" style={{ marginTop: 4 }}>
                      <span className="page-token" style={{ color: '#888' }}>ID: {xUser.x_user_id}</span>
                      <button className="btn-copy" onClick={() => navigator.clipboard.writeText(xUser.x_user_id)}>Copy</button>
                    </div>
                  )}
                  <div className="page-token-row" style={{ marginTop: 4 }}>
                    <span className="page-token">{xUser?.access_token}</span>
                    <button className="btn-copy" onClick={() => navigator.clipboard.writeText(xUser?.access_token)}>Copy token</button>
                  </div>
                  {xUser?.refresh_token && (
                    <div className="page-token-row" style={{ marginTop: 4 }}>
                      <span className="page-token" style={{ color: '#aaa' }}>Refresh: {xUser.refresh_token}</span>
                      <button className="btn-copy" onClick={() => navigator.clipboard.writeText(xUser.refresh_token)}>Copy</button>
                    </div>
                  )}
                </li>
              </ul>

              {xError && <p className="err" style={{ marginTop: 12 }}>{xError}</p>}

              <button className="btn-text" onClick={goHome}>Back</button>
              <button className="btn-text" onClick={() => { setXSub('idle'); setXUser(null); setXError('') }}>
                Connect another account
              </button>
            </>
          )}
        </>
      )}
    </div>
  )
}
