import { Plus } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { TaskDetailDialog } from '@/features/tasks/components/TaskDetailDialog'
import { TaskFormDialog } from '@/features/tasks/components/TaskFormDialog'
import { TaskList } from '@/features/tasks/components/TaskList'
import { useDeleteTask, useToggleTask } from '@/features/tasks/hooks/useTaskMutations'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import type { Task } from '@/features/tasks/types'

export function TasksPage() {
  const { data: tasks, isLoading, isError, refetch } = useTasks()
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<Task | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (task: Task) => {
    setEditing(task)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteTask.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {tasks ? `${tasks.length} en total` : 'Gestiona tus tareas'}
          </p>
        </div>
        <Button onClick={openCreate}>
          <Plus className="size-4" aria-hidden="true" />
          Nueva tarea
        </Button>
      </div>

      {isLoading && <LoadingSpinner />}

      {isError && (
        <ErrorState description="No se pudieron cargar tus tareas." onRetry={() => refetch()} />
      )}

      {tasks && tasks.length === 0 && (
        <EmptyState
          title="No tienes tareas todavía"
          description="Crea tu primera tarea para empezar a organizarte."
          action={
            <Button onClick={openCreate} variant="outline" className="mt-2">
              <Plus className="size-4" aria-hidden="true" />
              Crear tarea
            </Button>
          }
        />
      )}

      {tasks && tasks.length > 0 && (
        <TaskList
          tasks={tasks}
          onToggle={(task) => toggleTask.mutate({ id: task.id, completed: !task.completed })}
          onView={(task) => setViewingId(task.id)}
          onEdit={openEdit}
          onDelete={setDeleting}
        />
      )}

      <TaskFormDialog open={formOpen} onOpenChange={setFormOpen} task={editing} />

      <TaskDetailDialog
        taskId={viewingId}
        open={viewingId !== null}
        onOpenChange={(open) => !open && setViewingId(null)}
      />

      <ConfirmDialog
        open={deleting !== null}
        onOpenChange={(open) => !open && setDeleting(null)}
        title="¿Eliminar esta tarea?"
        description={deleting ? `"${deleting.title}" se eliminará permanentemente.` : undefined}
        confirmLabel={deleteTask.isPending ? 'Eliminando…' : 'Eliminar'}
        destructive
        onConfirm={confirmDelete}
      />
    </div>
  )
}
