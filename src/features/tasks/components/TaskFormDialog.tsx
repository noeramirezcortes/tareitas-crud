import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCreateTask, useUpdateTask } from '../hooks/useTaskMutations'
import type { TaskFormValues } from '../schemas'
import type { Task } from '../types'
import { TaskForm } from './TaskForm'

interface TaskFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si existe, el diálogo edita; si no, crea. */
  task?: Task | null
}

export function TaskFormDialog({ open, onOpenChange, task }: TaskFormDialogProps) {
  const createTask = useCreateTask()
  const updateTask = useUpdateTask()
  const isEditing = task != null
  const isPending = createTask.isPending || updateTask.isPending

  const handleSubmit = (values: TaskFormValues) => {
    const input = {
      title: values.title,
      description: values.description ? values.description : null,
    }

    if (isEditing) {
      updateTask.mutate({ id: task.id, ...input }, { onSuccess: () => onOpenChange(false) })
    } else {
      createTask.mutate(input, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
          <DialogDescription>
            {isEditing ? 'Modifica los campos y guarda los cambios.' : 'Añade una tarea a tu lista.'}
          </DialogDescription>
        </DialogHeader>

        {/* Render condicional: reinicia el estado del form en cada apertura */}
        {open && (
          <TaskForm
            defaultValues={
              isEditing ? { title: task.title, description: task.description ?? '' } : undefined
            }
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={isEditing ? 'Guardar cambios' : 'Crear tarea'}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
