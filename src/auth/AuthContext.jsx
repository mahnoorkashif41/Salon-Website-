import { createContext, useContext, useEffect, useMemo, useState } from 'react'
import { isSupabaseConfigured, supabase } from '../lib/supabase.js'

const AuthContext = createContext(null)

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null)
  const [profile, setProfile] = useState(null)
  const [ready, setReady] = useState(!isSupabaseConfigured)

  useEffect(() => {
    if (!supabase) return undefined
    let active = true

    const loadProfile = async (user) => {
      if (!user) {
        if (active) setProfile(null)
        return
      }
      const { data, error } = await supabase
        .from('profiles')
        .select('id, name, email, phone, role, created_at')
        .eq('id', user.id)
        .maybeSingle()
      if (active) setProfile(error ? null : data)
    }

    supabase.auth.getSession().then(async ({ data, error }) => {
      if (!active) return
      const nextSession = error ? null : data.session
      setSession(nextSession)
      await loadProfile(nextSession?.user ?? null)
      if (active) setReady(true)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      if (!active) return
      setSession(nextSession)
      if (!nextSession) {
        setProfile(null)
        setReady(true)
        return
      }
      setReady(false)
      // Defer the profile request so it runs after Supabase finishes its auth callback.
      setTimeout(async () => {
        if (!active) return
        await loadProfile(nextSession.user)
        if (active) setReady(true)
      }, 0)
    })

    return () => {
      active = false
      subscription.unsubscribe()
    }
  }, [])

  const value = useMemo(() => ({
    session,
    user: session?.user ?? null,
    profile,
    ready,
    configured: isSupabaseConfigured,
    signOut: async () => {
      if (!supabase) return { error: new Error('Supabase is not configured.') }
      return supabase.auth.signOut()
    },
  }), [session, profile, ready])

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used inside AuthProvider')
  return context
}
