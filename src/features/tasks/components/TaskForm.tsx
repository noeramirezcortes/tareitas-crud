import { zodResolver } from '@hookform/resolvers/zod'
import { Controller, useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Textarea } from '@/components/ui/textarea'
import { TagPicker } from '@/features/tags/components/TagPicker'
import { useCreateTag } from '@/features/tags/hooks/useTagMutations'
import type { Tag } from '@/features/tags/types'

import { taskFormSchema } from '../schemas'
import type { TaskFormValues } from '../schemas'
import { PRIORITY_LABELS, STATUS_LABELS, TASK_PRIORITIES, TASK_STATUSES } from '../types'

interface TaskFormProps {
  defaultValues?: Partial<TaskFormValues>
  onSubmit: (values: TaskFormValues) => void
  isPending?: boolean
  submitLabel: string
  pendingLabel?: string
  /** Proyectos y etiquetas disponibles (cargados por el padre). */
  projects: { id: string; name: string }[]
  tags: Tag[]
}

/**
 * Formulario de tarea compartido por crear y editar.
 * Validación con zod vía React Hook Form.
 */
export function TaskForm({
  defaultValues,
  onSubmit,
  isPending = false,
  submitLabel,
  pendingLabel = 'Guardando…',
  projects,
  tags,
}: TaskFormProps) {
  const createTag = useCreateTag()

  const {
    register,
    control,
    handleSubmit,
    formState: { errors },
  } = useForm<TaskFormValues>({
    resolver: zodResolver(taskFormSchema),
    defaultValues: {
      title: '',
      description: '',
      project_id: 'none',
      priority: 'medium',
      status: 'pending',
      due_date: '',
      tagIds: [],
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="title">Título</Label>
        <Input
          id="title"
          placeholder="Ej. Comprar leche"
          autoFocus
          aria-invalid={!!errors.title}
          {...register('title')}
        />
        {errors.title && <p className="text-sm text-destructive">{errors.title.message}</p>}
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Descripción (opcional)</Label>
        <Textarea
          id="description"
          rows={3}
          placeholder="Detalles de la tarea…"
          aria-invalid={!!errors.description}
          {...register('description')}
        />
        {errors.description && (
          <p className="text-sm text-destructive">{errors.description.message}</p>
        )}
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label>Proyecto</Label>
          <Controller
            control={control}
            name="project_id"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue placeholder="Sin proyecto" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin proyecto</SelectItem>
                  {projects.map((project) => (
                    <SelectItem key={project.id} value={project.id}>
                      {project.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="due_date">Fecha límite</Label>
          <Input id="due_date" type="date" {...register('due_date')} />
        </div>

        <div className="space-y-2">
          <Label>Prioridad</Label>
          <Controller
            control={control}
            name="priority"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_PRIORITIES.map((priority) => (
                    <SelectItem key={priority} value={priority}>
                      {PRIORITY_LABELS[priority]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>

        <div className="space-y-2">
          <Label>Estado</Label>
          <Controller
            control={control}
            name="status"
            render={({ field }) => (
              <Select value={field.value} onValueChange={field.onChange}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {TASK_STATUSES.map((status) => (
                    <SelectItem key={status} value={status}>
                      {STATUS_LABELS[status]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label>Etiquetas</Label>
        <Controller
          control={control}
          name="tagIds"
          render={({ field }) => (
            <TagPicker
              options={tags}
              value={field.value}
              onChange={field.onChange}
              onCreateTag={(name) => createTag.mutateAsync(name)}
            />
          )}
        />
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}
