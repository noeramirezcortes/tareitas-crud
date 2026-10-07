import { Route, Routes } from 'react-router-dom'

import { HomePage } from '@/pages/HomePage'

import { ProtectedRoute } from './ProtectedRoute'

export function AppRoutes() {
  return (
    <Routes>
      <Route path="/" element={<HomePage />} />

      <Route element={<ProtectedRoute />}>{/* Rutas protegidas — Fase 1 */}</Route>

      <Route
        path="*"
        element={
          <main className="flex min-h-screen items-center justify-center">
            <p className="text-muted-foreground">404 — Página no encontrada</p>
          </main>
        }
      />
    </Routes>
  )
}
