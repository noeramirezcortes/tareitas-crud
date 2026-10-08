import { Navigate, Outlet, useLocation } from 'react-router-dom'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { useSession } from '@/features/auth/hooks/useSession'

/**
 * Guard de rutas protegidas (solo UX).
 * La seguridad real la aplica Row Level Security en Supabase.
 */
export function ProtectedRoute() {
  const location = useLocation()
  const { isAuthenticated, isLoading } = useSession()

  if (isLoading) {
    return <LoadingSpinner className="min-h-screen" />
  }

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
