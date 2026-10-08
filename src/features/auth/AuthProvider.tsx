import type { ReactNode } from 'react'
import { useEffect, useMemo, useState } from 'react'

import type { Session } from '@supabase/supabase-js'

import { supabase } from '@/lib/supabase/client'

import { AuthContext } from './auth-context'
import type { AuthContextValue } from './auth-context'

/**
 * Estado global mínimo de sesión (decisión de arquitectura #10).
 *
 * - Persistencia: supabase-js guarda la sesión en localStorage por defecto.
 * - Recarga: getSession() la recupera antes de levantar isLoading.
 * - Multi-pestaña y refresh de token: onAuthStateChange mantiene el estado
 *   sincronizado sin escribir código extra.
 */
export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session)
      setIsLoading(false)
    })

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession)
    })

    return () => subscription.unsubscribe()
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      isLoading,
      isAuthenticated: session !== null,
    }),
    [session, isLoading],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
