import { ArrowRight, CheckCircle2, Clock, ListTodo } from 'lucide-react'
import { Link } from 'react-router-dom'

import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { useSession } from '@/features/auth/hooks/useSession'
import { useTasks } from '@/features/tasks/hooks/useTasks'

export function DashboardPage() {
  const { user } = useSession()
  const { data: tasks, isLoading, isError, refetch } = useTasks()

  if (isLoading) return <LoadingSpinner />
  if (isError) {
    return (
      <ErrorState
        description="No se pudieron cargar tus tareas."
        onRetry={() => refetch()}
      />
    )
  }

  const all = tasks ?? []
  const completed = all.filter((task) => task.completed)
  const pending = all.filter((task) => !task.completed)
  const recent = all.slice(0, 5)

  const stats = [
    { label: 'Total', value: all.length, icon: ListTodo },
    { label: 'Pendientes', value: pending.length, icon: Clock },
    { label: 'Completadas', value: completed.length, icon: CheckCircle2 },
  ]

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Hola, {user?.email}</h1>
        <p className="text-sm text-muted-foreground">Resumen de tu actividad</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {stats.map(({ label, value, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" aria-hidden="true" />
            </CardHeader>
            <CardContent>
              <p className="text-3xl font-bold">{value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <CardTitle className="text-base">Tareas recientes</CardTitle>
          <Button variant="ghost" size="sm" asChild>
            <Link to="/tasks">
              Ver todas
              <ArrowRight className="size-4" aria-hidden="true" />
            </Link>
          </Button>
        </CardHeader>
        <CardContent>
          {recent.length === 0 ? (
            <p className="text-sm text-muted-foreground">
              Aún no tienes tareas.{' '}
              <Link to="/tasks" className="font-medium text-primary hover:underline">
                Crea la primera
              </Link>
            </p>
          ) : (
            <ul className="divide-y">
              {recent.map((task) => (
                <li key={task.id} className="flex items-center gap-2 py-2 text-sm">
                  <CheckCircle2
                    className={
                      task.completed ? 'size-4 text-green-500' : 'size-4 text-muted-foreground/40'
                    }
                    aria-hidden="true"
                  />
                  <span className={task.completed ? 'text-muted-foreground line-through' : ''}>
                    {task.title}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
