import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCreateProject, useUpdateProject } from '../hooks/useProjectMutations'
import type { ProjectFormValues } from '../schemas'
import type { Project } from '../types'
import { ProjectForm } from './ProjectForm'

interface ProjectFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Si existe, el diálogo edita; si no, crea. */
  project?: Project | null
}

export function ProjectFormDialog({ open, onOpenChange, project }: ProjectFormDialogProps) {
  const createProject = useCreateProject()
  const updateProject = useUpdateProject()
  const isEditing = project != null
  const isPending = createProject.isPending || updateProject.isPending

  const handleSubmit = (values: ProjectFormValues) => {
    const input = {
      name: values.name,
      description: values.description ? values.description : null,
    }

    if (isEditing) {
      updateProject.mutate({ id: project.id, ...input }, { onSuccess: () => onOpenChange(false) })
    } else {
      createProject.mutate(input, { onSuccess: () => onOpenChange(false) })
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar proyecto' : 'Nuevo proyecto'}</DialogTitle>
          <DialogDescription>
            {isEditing
              ? 'Modifica los campos y guarda los cambios.'
              : 'Agrupa tus tareas en un proyecto.'}
          </DialogDescription>
        </DialogHeader>

        {open && (
          <ProjectForm
            defaultValues={
              isEditing ? { name: project.name, description: project.description ?? '' } : undefined
            }
            onSubmit={handleSubmit}
            isPending={isPending}
            submitLabel={isEditing ? 'Guardar cambios' : 'Crear proyecto'}
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
