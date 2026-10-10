import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { useProjects } from '@/features/projects/hooks/useProjects'
import { useTags } from '@/features/tags/hooks/useTags'
import { useWorkspace } from '@/features/workspaces/WorkspaceContext'

import { useCreateTask, useUpdateTask } from '../hooks/useTaskMutations'
import type { TaskFormValues } from '../schemas'
import type { TaskWithRelations } from '../types'
import { TaskForm } from './TaskForm'

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si existe, el diálogo edita; si no, crea. */
  task?: TaskWithRelations | null
}

export function TaskFormDialog({ open, onOpenChange, task }: TaskFormDialogProps) {
  const { currentWorkspace } = useWorkspace()
  const workspaceId = currentWorkspace?.id ?? null
  const { data: projects } = useProjects(workspaceId)
  const { data: tags } = useTags(workspaceId)
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const isEditing = task != null
  const isPending = createTask.isPending || updateTask.isPending

  const handleSubmit = (values: TaskFormValues) => {
    const input = {
      title: values.title,
      description: values.description ? values.description : null,
      project_id: values.project_id === 'none' ? null : values.project_id,
      priority: values.priority,
      status: values.status,
      due_date: values.due_date ? values.due_date : null,
    }
    const onSuccess = () => onOpenChange(false)

    if (task) {
      updateTask.mutate({ id: task.id, ...input, tagIds: values.tagIds }, { onSuccess })
    } else {
      createTask.mutate({ ...input, tagIds: values.tagIds }, { onSuccess })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los campos y guarda los cambios.' : 'Añade una tarea a tu lista.'}
          </DialogDescription>
        </DialogHeader>

        {/* Render condicional: reinicia el estado del formulario en cada apertura */}
        {open && workspaceId && (
          <TaskForm
            defaultValues={
              task
                ? {
                    title: task.title,
                    description: task.description ?? '',
                    project_id: task.project_id ?? 'none',
                    priority: task.priority,
                    status: task.status,
                    due_date: task.due_date ?? '',
                    tagIds: task.tags.map((tag) => tag.id),
                  }
                : undefined
            }
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={isEditing ? 'Guardar cambios' : 'Crear tarea'}
            projects={projects ?? []}
            tags={tags ?? []}
            workspaceId={workspaceId}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
