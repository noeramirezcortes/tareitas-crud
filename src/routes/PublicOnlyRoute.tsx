import { Navigate, Outlet } from 'react-router-dom'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useSession } from '@/features/auth/hooks/useSession'

/**
 * Rutas solo para visitantes (login, register).
 * Un usuario autenticado se redirige al dashboard.
 */
export function PublicOnlyRoute() {
  const { isAuthenticated, isLoading } = useSession()

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (isAuthenticated) {
    return <Navigate to="/dashboard" replace />
  }

  return <Outlet />
}
