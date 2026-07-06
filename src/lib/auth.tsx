import { createContext, useContext, useEffect, useState, type ReactNode } from 'react'
import type { Session } from '@supabase/supabase-js'
import { supabase, supabaseConfigured } from './supabase'
import type { Profile } from './types'

type AuthCtx = {
  session: Session | null
  profile: Profile | null
  loading: boolean
  refreshProfile: () => Promise<void>
}

const Ctx = createContext<AuthCtx>({ session: null, profile: null, loading: true, refreshProfile: async () => {} })

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [profile, setProfile] = useState<Profile | null>(null)
  const [loading, setLoading] = useState(true)

  async function loadProfile(userId: string) {
    const { data } = await supabase.from('profiles').select('*').eq('id', userId).single()
    setProfile((data as Profile) ?? null)
  }

  useEffect(() => {
    if (!supabaseConfigured) {
      setLoading(false)
      return
    }
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      if (data.session) loadProfile(data.session.user.id).finally(() => setLoading(false))
      else setLoading(false)
    })
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => {
      setSession(s)
      if (s) loadProfile(s.user.id)
      else setProfile(null)
    })
    return () => sub.subscription.unsubscribe()
  }, [])

  // heartbeat last_seen_at (compteurs internes, pas de tracker externe)
  useEffect(() => {
    if (!session) return
    supabase
      .from('profiles')
      .update({ last_seen_at: new Date().toISOString() })
      .eq('id', session.user.id)
      .then(() => {})
  }, [session?.user.id])

  return (
    <Ctx.Provider
      value={{
        session,
        profile,
        loading,
        refreshProfile: async () => {
          if (session) await loadProfile(session.user.id)
        },
      }}
    >
      {children}
    </Ctx.Provider>
  )
}

export const useAuth = () => useContext(Ctx)
