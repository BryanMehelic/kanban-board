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
import { supabase } from '../lib/supabase'

interface AuthContextValue {
  user: User | null
  session: Session | null
  isGuest: boolean
  loading: boolean
  error: string | null
  signIn: (email: string, password: string) => Promise<void>
  signUp: (email: string, password: string) => Promise<void>
  upgradeAccount: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let mounted = true

    async function initAuth() {
      try {
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession()

        if (sessionError) throw sessionError

        if (sessionData.session) {
          if (mounted) {
            setSession(sessionData.session)
            setUser(sessionData.session.user)
          }
          return
        }

        const { data: anonData, error: anonError } = await supabase.auth.signInAnonymously()
        if (anonError) throw anonError

        if (mounted) {
          setSession(anonData.session)
          setUser(anonData.session?.user ?? null)
        }
      } catch (err) {
        if (mounted) {
          setError(err instanceof Error ? err.message : 'Failed to initialize auth')
        }
      } finally {
        if (mounted) setLoading(false)
      }
    }

    void initAuth()

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
      setUser(nextSession?.user ?? null)
    })

    return () => {
      mounted = false
      subscription.unsubscribe()
    }
  }, [])

  const signIn = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: signInError } = await supabase.auth.signInWithPassword({ email, password })
    if (signInError) {
      setError(signInError.message)
      throw signInError
    }
  }, [])

  const signUp = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: signUpError } = await supabase.auth.signUp({ email, password })
    if (signUpError) {
      setError(signUpError.message)
      throw signUpError
    }
  }, [])

  const upgradeAccount = useCallback(async (email: string, password: string) => {
    setError(null)
    const { error: upgradeError } = await supabase.auth.updateUser({ email, password })
    if (upgradeError) {
      setError(upgradeError.message)
      throw upgradeError
    }
  }, [])

  const signOut = useCallback(async () => {
    setError(null)
    const { error: signOutError } = await supabase.auth.signOut()
    if (signOutError) {
      setError(signOutError.message)
      throw signOutError
    }
    const { data, error: anonError } = await supabase.auth.signInAnonymously()
    if (anonError) {
      setError(anonError.message)
      throw anonError
    }
    setSession(data.session)
    setUser(data.session?.user ?? null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      session,
      isGuest: user?.is_anonymous ?? true,
      loading,
      error,
      signIn,
      signUp,
      upgradeAccount,
      signOut,
    }),
    [user, session, loading, error, signIn, signUp, upgradeAccount, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider')
  }
  return context
}
