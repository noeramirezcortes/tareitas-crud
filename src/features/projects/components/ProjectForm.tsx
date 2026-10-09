import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'

import { projectFormSchema } from '../schemas'
import type { ProjectFormValues } from '../schemas'

interface ProjectFormProps {
  defaultValues?: Partial<ProjectFormValues>
  onSubmit: (values: ProjectFormValues) => void
  isPending?: boolean
  submitLabel: string
  pendingLabel?: string
}

export function ProjectForm({
  defaultValues,
  onSubmit,
  isPending = false,
  submitLabel,
  pendingLabel = 'Guardando…',
}: ProjectFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ProjectFormValues>({
    resolver: zodResolver(projectFormSchema),
    defaultValues,
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="project-name">Nombre</Label>
        <Input
          id="project-name"
          placeholder="Ej. Lanzamiento web"
          autoFocus
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="project-description">Descripción (opcional)</Label>
        <Textarea
          id="project-description"
          rows={2}
          placeholder="¿De qué va este proyecto?"
          aria-invalid={!!errors.description}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
