import { lazy, Suspense } from 'react'
import { Route, Routes } from 'react-router-dom'

import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { AppLayout } from '@/components/layout/AppLayout'
import { HomePage } from '@/pages/HomePage'
import { LoginPage } from '@/pages/LoginPage'
import { RegisterPage } from '@/pages/RegisterPage'

import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'

// Las páginas de la app se cargan bajo demanda: login y registro (la
// primera visita) no descargan el código de tareas, proyectos ni organización.
const DashboardPage = lazy(() =>
  import('@/pages/DashboardPage').then((m) => ({ default: m.DashboardPage })),
)
const TasksPage = lazy(() => import('@/pages/TasksPage').then((m) => ({ default: m.TasksPage })))
const ProjectsPage = lazy(() =>
  import('@/pages/ProjectsPage').then((m) => ({ default: m.ProjectsPage })),
)
const OrganizationPage = lazy(() =>
  import('@/pages/OrganizationPage').then((m) => ({ default: m.OrganizationPage })),
)
const AcceptInvitationPage = lazy(() =>
  import('@/pages/AcceptInvitationPage').then((m) => ({ default: m.AcceptInvitationPage })),
)

export function AppRoutes() {
  return (
    <Suspense fallback={<LoadingSpinner className="min-h-screen" />}>
      <Routes>
        <Route path="/" element={<HomePage />} />

        <Route element={<PublicOnlyRoute />}>
          <Route path="/login" element={<LoginPage />} />
          <Route path="/register" element={<RegisterPage />} />
        </Route>

        <Route element={<ProtectedRoute />}>
          <Route element={<AppLayout />}>
            <Route path="/dashboard" element={<DashboardPage />} />
            <Route path="/tasks" element={<TasksPage />} />
            <Route path="/projects" element={<ProjectsPage />} />
            <Route path="/organization" element={<OrganizationPage />} />
            <Route path="/invite/:token" element={<AcceptInvitationPage />} />
          </Route>
        </Route>

        <Route
          path="*"
          element={
            <main className="flex min-h-screen items-center justify-center">
              <p className="text-muted-foreground">404 — Página no encontrada</p>
            </main>
          }
        />
      </Routes>
    </Suspense>
  )
}
