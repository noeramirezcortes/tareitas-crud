import { zodResolver } from '@hookform/resolvers/zod'
import { useForm } from 'react-hook-form'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

import { organizationFormSchema } from '../schemas'
import type { OrganizationFormValues } from '../schemas'

interface OrganizationFormProps {
  defaultValues?: Partial<OrganizationFormValues>
  onSubmit: (values: OrganizationFormValues) => void
  isPending?: boolean
  submitLabel: string
  pendingLabel?: string
}

export function OrganizationForm({
  defaultValues,
  onSubmit,
  isPending = false,
  submitLabel,
  pendingLabel = 'Guardando…',
}: OrganizationFormProps) {
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<OrganizationFormValues>({
    resolver: zodResolver(organizationFormSchema),
    defaultValues: {
      name: '',
      ...defaultValues,
    },
  })

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4" noValidate>
      <div className="space-y-2">
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          placeholder="Ej. Mi Empresa"
          autoFocus
          aria-invalid={!!errors.name}
          {...register('name')}
        />
        {errors.name && <p className="text-sm text-destructive">{errors.name.message}</p>}
      </div>

      <Button type="submit" className="w-full" disabled={isPending}>
        {isPending ? pendingLabel : submitLabel}
      </Button>
    </form>
  )
}