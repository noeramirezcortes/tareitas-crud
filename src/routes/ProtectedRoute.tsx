import { Navigate, Outlet, useLocation } from 'react-router-dom'

/**
 * Guard de rutas protegidas.
 *
 * OJO: esto es solo una medida de UX. La seguridad real la aplica
 * Row Level Security en Supabase.
 *
 * TODO(Fase 1): sustituir el placeholder por la verificación real
 * de sesión (AuthProvider + useSession sobre Supabase Auth).
 */
export function ProtectedRoute() {
  const location = useLocation()
  const isAuthenticated = true // TODO(Fase 1): leer sesión real

  if (!isAuthenticated) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
