import { useContext } from 'react'

import { AuthContext } from '../auth-context'

/**
 * Lee la sesión actual. Debe usarse dentro de <AuthProvider>.
 */
export function useSession() {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useSession debe usarse dentro de <AuthProvider>')
  }
  return context
}
