import { Route, Routes } from 'react-router-dom'

import { AppLayout } from '@/components/layout/AppLayout'
import { DashboardPage } from '@/pages/DashboardPage'
import { HomePage } from '@/pages/HomePage'
import { AcceptInvitationPage } from '@/pages/AcceptInvitationPage'
import { LoginPage } from '@/pages/LoginPage'
import { OrganizationPage } from '@/pages/OrganizationPage'
import { ProjectsPage } from '@/pages/ProjectsPage'
import { RegisterPage } from '@/pages/RegisterPage'
import { TasksPage } from '@/pages/TasksPage'

import { ProtectedRoute } from './ProtectedRoute'
import { PublicOnlyRoute } from './PublicOnlyRoute'

export function AppRoutes() {
  return (
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
  )
}
