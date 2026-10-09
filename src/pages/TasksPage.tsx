import { Plus, Tags } from 'lucide-react'
import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { EmptyState } from '@/components/common/EmptyState'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Button } from '@/components/ui/button'
import { ManageTagsDialog } from '@/features/tags/components/ManageTagsDialog'
import { TaskDetailDialog } from '@/features/tasks/components/TaskDetailDialog'
import { TaskFormDialog } from '@/features/tasks/components/TaskFormDialog'
import { TaskList } from '@/features/tasks/components/TaskList'
import { TasksFilters } from '@/features/tasks/components/TasksFilters'
import { useDeleteTask, useToggleTask } from '@/features/tasks/hooks/useTaskMutations'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import type { TaskFilters, TaskWithRelations } from '@/features/tasks/types'

export function TasksPage() {
  const [searchParams] = useSearchParams()

  // La URL es la fuente de verdad de los filtros (URLs compartibles)
  const filters: TaskFilters = {
    text: searchParams.get('q') || undefined,
    projectId: searchParams.get('project') || undefined,
    priority: (searchParams.get('priority') as TaskFilters['priority']) || undefined,
    status: (searchParams.get('status') as TaskFilters['status']) || undefined,
    due: (searchParams.get('due') as TaskFilters['due']) || undefined,
    tagId: searchParams.get('tag') || undefined,
  }

  const { data: tasks, isLoading, isError, refetch } = useTasks(filters)
  const toggleTask = useToggleTask()
  const deleteTask = useDeleteTask()

  const [formOpen, setFormOpen] = useState(false)
  const [tagsOpen, setTagsOpen] = useState(false)
  const [editing, setEditing] = useState<TaskWithRelations | null>(null)
  const [viewingId, setViewingId] = useState<string | null>(null)
  const [deleting, setDeleting] = useState<TaskWithRelations | null>(null)

  const openCreate = () => {
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (task: TaskWithRelations) => {
    setEditing(task)
    setFormOpen(true)
  }

  const confirmDelete = () => {
    if (!deleting) return
    deleteTask.mutate(deleting.id, { onSuccess: () => setDeleting(null) })
  }

  const hasFilters = Object.values(filters).some(Boolean)

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold">Tareas</h1>
          <p className="text-sm text-muted-foreground">
            {tasks ? `${tasks.length} ${hasFilters ? 'resultados' : 'en total'}` : 'Gestiona tus tareas'}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={() => setTagsOpen(true)}>
            <Tags className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Etiquetas</span>
          </Button>
          <Button onClick={openCreate}>
            <Plus className="size-4" aria-hidden="true" />
            <span className="hidden sm:inline">Nueva tarea</span>
          </Button>
        </div>
      </div>

      <TasksFilters />

      {isLoading && <LoadingSpinner />}

      {isError && (
        <ErrorState description="No se pudieron cargar tus tareas." onRetry={() => refetch()} />
      )}

      {tasks && tasks.length === 0 && (
        <EmptyState
          title={hasFilters ? 'Ninguna tarea coincide con los filtros' : 'No tienes tareas todavía'}
          description={
            hasFilters
              ? 'Prueba a ajustar la búsqueda o limpia los filtros.'
              : 'Crea tu primera tarea para empezar a organizarte.'
          }
          action={
            !hasFilters && (
              <Button onClick={openCreate} variant="outline" className="mt-2">
                <Plus className="size-4" aria-hidden="true" />
                Crear tarea
              </Button>
            )
          }
        />
      )}

      {tasks && tasks.length > 0 && (
        <TaskList
          tasks={tasks}
          onToggle={(task) =>
            toggleTask.mutate({
              id: task.id,
              status: task.status === 'done' ? 'pending' : 'done',
            })
          }
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

      <ManageTagsDialog open={tagsOpen} onOpenChange={setTagsOpen} />

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
