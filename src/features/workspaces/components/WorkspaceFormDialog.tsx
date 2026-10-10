import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { useCreateWorkspace } from '../hooks/useWorkspaceMutations'
import { workspaceFormSchema } from '../schemas'
import type { WorkspaceFormValues } from '../schemas'
import type { Workspace } from '../types'

interface WorkspaceFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  organizationId: string
  /** Se llama con el workspace creado (para seleccionarlo). */
  onCreated: (workspace: Workspace) => void
}

export function WorkspaceFormDialog({
  open,
  onOpenChange,
  organizationId,
  onCreated,
}: WorkspaceFormDialogProps) {
  const createWorkspace = useCreateWorkspace()

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nuevo workspace</DialogTitle>
          <DialogDescription>
            Los workspaces agrupan proyectos y etiquetas dentro de la organización.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <WorkspaceForm
            isPending={createWorkspace.isPending}
            onSubmit={(values) =>
              createWorkspace.mutate(
                {
                  organization_id: organizationId,
                  name: values.name,
                  description: values.description ? values.description : null,
                },
                {
                  onSuccess: (workspace) => {
                    onCreated(workspace)
                    onOpenChange(false)
                  },
                },
              )
            }
          />
        )}
      </DialogContent>
    </Dialog>
  )
}

function WorkspaceForm({
  isPending,
  onSubmit,
}: {
  isPending: boolean
  onSubmit: (values: WorkspaceFormValues) => void
}) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkspaceFormValues>({
    resolver: zodResolver(workspaceFormSchema),
    defaultValues: { name: '', description: '' },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="workspace-name">Nombre</Label>
        <Input
          id="workspace-name"
          placeholder="Ej. Marketing"
          autoFocus
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="workspace-description">Descripción (opcional)</Label>
        <Textarea id="workspace-description" rows={2} {...register('description')} />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? 'Creando…' : 'Crear workspace'}
      </Button>
    </form>
  )
}
