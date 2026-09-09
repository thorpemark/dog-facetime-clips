import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { Session, User } from '@supabase/supabase-js'
import { authRedirectUrl, setPostAuthPath } from '../lib/authRedirect'
import { getSupabase, isSupabaseConfigured } from '../lib/supabase'
import { claimPendingMemorials } from '../services/memorialService'

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  authAvailable: boolean
  signInWithEmail: (email: string, redirectTo?: string) => Promise<{ error: string | null }>
  verifyEmailOtp: (email: string, code: string) => Promise<{ error: string | null }>
  signInWithGoogle: (redirectTo?: string) => Promise<{ error: string | null }>
  signOut: () => Promise<void>
  claimPending: () => Promise<number>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(isSupabaseConfigured)

  const claimPending = useCallback(async () => {
    if (!isSupabaseConfigured) return 0
    return claimPendingMemorials()
  }, [])

  useEffect(() => {
    const supabase = getSupabase()
    if (!supabase) {
      setLoading(false)
      return
    }

    let mounted = true

    supabase.auth.getSession().then(({ data }) => {
      if (!mounted) return
      setSession(data.session)
      setUser(data.session?.user ?? null)
      setLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_IN' && nextSession) {
        await claimPendingMemorials()
      }
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, redirectTo = '/my') => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Sign-in is not available in demo mode' }

    setPostAuthPath(redirectTo)
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: {
        emailRedirectTo: authRedirectUrl(),
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const verifyEmailOtp = useCallback(async (email: string, code: string) => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Sign-in is not available in demo mode' }

    const { error } = await supabase.auth.verifyOtp({
      email: email.trim(),
      token: code.trim(),
      type: 'email',
    })
    return { error: error?.message ?? null }
  }, [])

  const signInWithGoogle = useCallback(async (redirectTo = '/my') => {
    const supabase = getSupabase()
    if (!supabase) return { error: 'Sign-in is not available in demo mode' }

    setPostAuthPath(redirectTo)
    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: {
        redirectTo: authRedirectUrl(),
      },
    })
    return { error: error?.message ?? null }
  }, [])

  const signOut = useCallback(async () => {
    const supabase = getSupabase()
    if (!supabase) return
    await supabase.auth.signOut()
  }, [])

  const value = useMemo(
    () => ({
      user,
      session,
      loading,
      authAvailable: isSupabaseConfigured,
      signInWithEmail,
      verifyEmailOtp,
      signInWithGoogle,
      signOut,
      claimPending,
    }),
    [user, session, loading, signInWithEmail, verifyEmailOtp, signInWithGoogle, signOut, claimPending],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
