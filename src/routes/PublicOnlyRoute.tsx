import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useSession } from '@/features/auth/hooks/useSession'
import { getRedirectFrom } from '@/features/auth/redirect'

/**
 * Rutas solo para visitantes (login, register).
 * Un usuario autenticado se redirige a la ruta que quería visitar antes de
 * ser enviado aquí (p. ej. /invite/:token) o, si no hay, al dashboard.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useSession()
  const location = useLocation()

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (isAuthenticated) {
    return <Navigate to={getRedirectFrom(location.state) ?? '/dashboard'} replace />
  }

  return <Outlet />
}
