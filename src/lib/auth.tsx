import { createContext, useContext, useState, useEffect, ReactNode, useCallback } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { supabase } from './supabase'

const ANON_ID_KEY = 'voy-user-id'

function getAnonymousId(): string {
  let id = localStorage.getItem(ANON_ID_KEY)
  if (!id) {
    id = crypto.randomUUID()
    localStorage.setItem(ANON_ID_KEY, id)
  }
  return id
}

interface AuthContextValue {
  user: User | null
  session: Session | null
  loading: boolean
  anonymousId: string
  userId: string
  userIdShort: string
  admin: boolean
  signIn: (email: string, password: string) => Promise<{ error?: string }>
  signUp: (email: string, password: string) => Promise<{ error?: string }>
  signOut: () => Promise<void>
  refreshAdmin: () => void
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  loading: true,
  anonymousId: '',
  userId: '',
  userIdShort: '',
  admin: false,
  signIn: async () => ({}),
  signUp: async () => ({}),
  signOut: async () => {},
  refreshAdmin: () => {},
})

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [admin, setAdmin] = useState(false)

  const anonymousId = getAnonymousId()
  const userId = user?.id || anonymousId
  const userIdShort = userId.slice(0, 8)

  const refreshAdmin = useCallback(() => {
    const meta = user?.app_metadata
    const role = user?.user_metadata?.role
    setAdmin(role === 'admin' || meta?.role === 'admin')
  }, [user])

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s)
      setUser(s?.user ?? null)
      setLoading(false)
    })

    return () => subscription.unsubscribe()
  }, [])

  useEffect(() => {
    refreshAdmin()
  }, [refreshAdmin])

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  async function signUp(email: string, password: string) {
    const { error } = await supabase.auth.signUp({ email, password })
    if (error) return { error: error.message }
    return {}
  }

  async function signOut() {
    await supabase.auth.signOut()
  }

  return (
    <AuthContext.Provider value={{ user, session, loading, anonymousId, userId, userIdShort, admin, signIn, signUp, signOut, refreshAdmin }}>
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  return useContext(AuthContext)
}
