import { supabase } from '@/lib/supabase/client'

/**
 * Acceso a Supabase Auth. Único punto del feature que toca supabase.auth.
 */
/**
 * `redirectTo` es la URL absoluta a la que lleva el enlace del correo de
 * confirmación. Debe estar en Authentication → URL Configuration → Redirect
 * URLs de Supabase; si no, Supabase usa el Site URL.
 */
export async function signUp(email: string, password: string, redirectTo?: string) {
  const { data, error } = await supabase.auth.signUp({
    email,
    password,
    options: redirectTo ? { emailRedirectTo: redirectTo } : undefined,
  })
  if (error) throw error
  return data
}

export async function signIn(email: string, password: string) {
  const { data, error } = await supabase.auth.signInWithPassword({ email, password })
  if (error) throw error
  return data
}

export async function signOut() {
  const { error } = await supabase.auth.signOut()
  if (error) throw error
}
