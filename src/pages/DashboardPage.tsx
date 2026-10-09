import { AlertTriangle, ArrowRight, CalendarClock, CheckCircle2, Clock, FolderKanban } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/hooks/useSession'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import type { TaskPriority } from '@/features/tasks/types'
import { PRIORITY_LABELS } from '@/features/tasks/types'
import { isDueSoon, isOverdue } from '@/utils/dates'

const PRIORITY_BAR_COLORS: Record<TaskPriority, string> = {
  high: 'bg-red-500',
  medium: 'bg-amber-500',
  low: 'bg-emerald-500',
}

export function DashboardPage() {
  const { user } = useSession()
  const { data: tasks, isLoading, isError, refetch } = useTasks()
  const { data: projects } = useProjects()

  if (isLoading) return <LoadingSpinner />
  if (isError) {
    return <ErrorState description="No se pudieron cargar tus tareas." onRetry={() => refetch()} />
  }

  const all = tasks ?? []
  const done = all.filter((task) => task.status === 'done')
  const pending = all.filter((task) => task.status !== 'done')
  const overdue = pending.filter((task) => isOverdue(task.due_date))
  const upcoming = pending.filter((task) => isDueSoon(task.due_date, 7))

  const stats = [
    {
      label: 'Pendientes',
      value: pending.length,
      icon: Clock,
      href: '/tasks',
    },
    {
      label: 'Completadas',
      value: done.length,
      icon: CheckCircle2,
      href: '/tasks?status=done',
    },
    {
      label: 'Vencidas',
      value: overdue.length,
      icon: AlertTriangle,
      href: '/tasks?due=overdue',
      highlight: overdue.length > 0,
    },
    {
      label: 'Próximos 7 días',
      value: upcoming.length,
      icon: CalendarClock,
      href: '/tasks?due=week',
    },
  ]

  // Distribución por prioridad (solo tareas no completadas: es lo accionable)
  const priorityDist = (['high', 'medium', 'low'] as TaskPriority[]).map((priority) => ({
    priority,
    count: pending.filter((task) => task.priority === priority).length,
  }))
  const maxPriorityCount = Math.max(...priorityDist.map(({ count }) => count), 1)

  // Proyectos activos: con al menos una tarea pendiente
  const activeProjects = (projects ?? [])
    .map((project) => ({
      ...project,
      pendingCount: pending.filter((task) => task.project_id === project.id).length,
    }))
    .filter((project) => project.pendingCount > 0)
    .sort((a, b) => b.pendingCount - a.pendingCount)
    .slice(0, 5)

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {user?.email}</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu actividad</p>
      </div>

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
        {stats.map(({ label, value, icon: Icon, href, highlight }) => (
          <Link key={label} to={href}>
            <Card
              className={
                highlight
                  ? 'border-destructive transition-colors hover:border-destructive/70'
                  : 'transition-colors hover:border-foreground/20'
              }
            >
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
                <Icon
                  className={highlight ? 'size-4 text-destructive' : 'size-4 text-muted-foreground'}
                  aria-hidden="true"
                />
              </CardHeader>
              <CardContent>
                <p className={highlight ? 'text-3xl font-bold text-destructive' : 'text-3xl font-bold'}>
                  {value}
                </p>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Prioridad de tareas pendientes</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {pending.length === 0 ? (
              <p className="text-sm text-muted-foreground">Sin tareas pendientes. 🎉</p>
            ) : (
              priorityDist.map(({ priority, count }) => (
                <div key={priority} className="space-y-1">
                  <div className="flex justify-between text-sm">
                    <span>{PRIORITY_LABELS[priority]}</span>
                    <span className="text-muted-foreground">{count}</span>
                  </div>
                  <div className="h-2 w-full rounded-full bg-secondary">
                    <div
                      className={`h-2 rounded-full ${PRIORITY_BAR_COLORS[priority]}`}
                      style={{ width: `${(count / maxPriorityCount) * 100}%` }}
                    />
                  </div>
                </div>
              ))
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-base">Proyectos activos</CardTitle>
            <Button variant="ghost" size="sm" asChild>
              <Link to="/projects">
                Ver todos
                <ArrowRight className="size-4" aria-hidden="true" />
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            {activeProjects.length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Ningún proyecto tiene tareas pendientes.{' '}
                <Link to="/projects" className="font-medium text-primary hover:underline">
                  Crear proyecto
                </Link>
              </p>
            ) : (
              <ul className="divide-y">
                {activeProjects.map((project) => (
                  <li key={project.id} className="flex items-center justify-between gap-2 py-2 text-sm">
                    <Link
                      to={`/tasks?project=${project.id}`}
                      className="flex min-w-0 items-center gap-2 hover:underline"
                    >
                      <FolderKanban className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                      <span className="truncate">{project.name}</span>
                    </Link>
                    <span className="shrink-0 text-muted-foreground">
                      {project.pendingCount} pendiente{project.pendingCount === 1 ? '' : 's'}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
