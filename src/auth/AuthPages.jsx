import { useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ArrowLeft, ArrowRight, LogOut, ShieldCheck } from 'lucide-react'
import { useAuth } from './AuthContext.jsx'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

function AuthShell({ eyebrow, title, intro, children, aside }) {
  return <main className="auth-page"><section className="auth-card"><Link className="auth-back" to="/"><ArrowLeft size={14} /> Élan Beauty Studio</Link><span className="eyebrow"><span className="eyebrow-dot" /> {eyebrow}</span><h1>{title}</h1><p className="auth-intro">{intro}</p>{children}{aside}</section><div className="auth-side"><span className="auth-side-mark">E.</span><p>A little time for yourself.<br /><em>A feeling that stays with you.</em></p><span className="auth-side-caption">ÉLAN BEAUTY STUDIO · GULBERG, LAHORE</span></div></main>
}

function ConfigurationNotice() {
  if (isSupabaseConfigured) return null
  return <div className="auth-config-notice" role="status"><strong>Supabase setup needed</strong><span>Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_ANON_KEY</code> to <code>.env.local</code>, run the profile migration, and restart Vite. See <a href="/SUPABASE_SETUP.md" target="_blank" rel="noreferrer">Supabase setup</a>.</span></div>
}

function AuthForm({ mode = 'login', admin = false }) {
  const signup = mode === 'signup'
  const { signOut } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  const destination = location.state?.from?.pathname || (admin? '/admin/dashboard' : '/dashboard')

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setMessage('')
    if (!supabase) {
      setError('Connect Supabase before creating an account or signing in.')
      return
    }
    const formData = new FormData(event.currentTarget)
    const email = String(formData.get('email')).trim().toLowerCase()
    const password = String(formData.get('password'))
    setBusy(true)
    try {
      if (signup) {
        const name = String(formData.get('name')).trim()
        const phone = String(formData.get('phone')).trim()
        const { data, error: authError } = await supabase.auth.signUp({
          email,
          password,
          options: { data: { name, phone } },
        })
        if (authError) throw authError
        if (data.session) {
          navigate('/dashboard', { replace: true })
        } else {
          setMessage('Your account is ready. Check your email to confirm your address, then log in to continue.')
        }
      } else {
        const { data, error: authError } = await supabase.auth.signInWithPassword({ email, password })
        if (authError) throw authError
        const { data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', data.user.id)
          .maybeSingle()
        if (profileError || !profile) {
          await signOut()
          throw new Error('We could not load the profile for this account. Make sure the Supabase profile migration has been run.')
        }
        if (admin && profile.role !== 'admin') {
          await signOut()
          throw new Error('This account does not have admin access. Use customer login instead.')
        }
        if (!admin && profile.role !== 'customer') {
          await signOut()
          throw new Error('This is an admin account. Please use the admin login page.')
        }
        navigate(destination, { replace: true })
      }
    } catch (authError) {
      setError(authError.message === 'Invalid login credentials'? 'Email or password wasn’t recognized.' : authError.message || 'Something went wrong. Please try again.')
    } finally {
      setBusy(false)
    }
  }

  return <form className="auth-form" onSubmit={handleSubmit}>
    <ConfigurationNotice />
    {signup && <label>Name<input type="text" name="name" autoComplete="name" placeholder="Your name" required minLength={2} disabled={busy} /></label>}
    <label>Email<input type="email" name="email" autoComplete="email" placeholder="you@example.com" required disabled={busy} /></label>
    {signup && <label>Phone<input type="tel" name="phone" autoComplete="tel" placeholder="+92 300 1234567" pattern="[+0-9() -]{7,20}" title="Enter a valid phone number" required disabled={busy} /></label>}
    <label>Password<input type="password" name="password" autoComplete={signup? 'new-password' : 'current-password'} placeholder={signup? 'At least 8 characters' : 'Your password'} required minLength={signup? 8 : undefined} disabled={busy} /></label>
    {error && <p className="auth-alert error" role="alert">{error}</p>}
    {message && <p className="auth-alert success" role="status">{message}</p>}
    <button className="button button-dark auth-submit" type="submit" disabled={busy}>{busy? 'Please wait…' : signup? 'Create your account' : admin? 'Log in to admin' : 'Log in'} <ArrowRight size={15} /></button>
  </form>
}

export function AuthPage({ mode }) {
  const signup = mode === 'signup'
  return <AuthShell eyebrow={signup? 'A LITTLE SPACE FOR YOU' : 'WELCOME BACK'} title={signup? <>Make yourself<br /><em>at home.</em></> : <>Good to see<br /><em>you again.</em></>} intro={signup? 'Create your Élan account to keep your details close.' : 'Log in to your Élan account to continue.'}>
    <AuthForm mode={mode} />
    <p className="auth-switch">{signup? 'Already have an account?' : 'New to Élan?'} <Link to={signup? '/login' : '/signup'}>{signup? 'Log in' : 'Create an account'}</Link></p>
    <Link to="/admin/login" className="auth-admin-link">Salon team? Admin login <ArrowRight size={13} /></Link>
  </AuthShell>
}

export function AdminLoginPage() {
  return <AuthShell eyebrow="SALON TEAM" title={<>Your studio,<br /><em>at a glance.</em></>} intro="Sign in with your Élan administrator account.">
    <div className="admin-login-mark"><ShieldCheck size={17} /> Administrator access</div>
    <AuthForm admin />
    <Link to="/login" className="auth-admin-link"><ArrowLeft size={13} /> Customer login</Link>
  </AuthShell>
}

function Dashboard({ admin }) {
  const { profile, signOut } = useAuth()
  const navigate = useNavigate()
  async function handleSignOut() {
    await signOut()
    navigate(admin? '/admin/login' : '/', { replace: true })
  }
  return <main className="dashboard-page"><div className="dashboard-card"><span className="eyebrow"><span className="eyebrow-dot" /> {admin? 'SALON ADMIN' : 'YOUR ÉLAN SPACE'}</span><h1>{admin? <>Welcome to<br /><em>your studio.</em></> : <>Hello, {profile?.name?.split(' ')[0] || 'lovely'}.</>}</h1><p>{admin? 'You’re signed in with administrator access.' : 'Your account is ready. We look forward to welcoming you to the studio.'}</p><div className="dashboard-profile"><span>{profile?.name || 'Élan member'}</span><span>{profile?.email}</span><span>{profile?.phone}</span><span className="role-pill">{profile?.role}</span></div><button className="button button-dark" onClick={handleSignOut}>Log out <LogOut size={15} /></button><Link to="/services" className="underlined-link">Explore our services <ArrowRight size={15} /></Link></div></main>
}

export function CustomerDashboard() { return <Dashboard admin={false} /> }
export function AdminDashboard() { return <Dashboard admin /> }
