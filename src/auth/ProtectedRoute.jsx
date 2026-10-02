import { Navigate, useLocation } from 'react-router-dom'
import { useAuth } from './AuthContext.jsx'

export default function ProtectedRoute({ role, children }) {
  const { user, profile, ready, configured } = useAuth()
  const location = useLocation()

  if (!configured) return <Navigate to={role === 'admin'? '/admin/login' : '/login'} replace state={{ from: location }} />
  if (!ready) return <main className="auth-loading" aria-live="polite">Opening your Élan space…</main>
  if (!user) {
    const loginPath = role === 'admin'? '/admin/login' : '/login'
    return <Navigate to={loginPath} replace state={{ from: location }} />
  }
  if (!profile) return <main className="auth-page"><div className="auth-card"><span className="eyebrow"><span className="eyebrow-dot" /> PROFILE UNAVAILABLE</span><h1>One moment,<br /><em>please.</em></h1><p>Your account is signed in, but its profile could not be loaded. Check that the Supabase profile migration has been applied, then try again.</p></div></main>
  if (profile.role !== role) {
    return <Navigate to={profile.role === 'admin'? '/admin/dashboard' : '/dashboard'} replace />
  }
  return children
}
