import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'

import { useCreateOrganization } from '../hooks/useOrganizationMutations'
import type { OrganizationFormValues } from '../schemas'
import { OrganizationForm } from './OrganizationForm'

interface OrganizationFormDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  /** Se llama con el id de la organización creada. */
  onCreated: (organizationId: string) => void
}

export function OrganizationFormDialog({ open, onOpenChange, onCreated }: OrganizationFormDialogProps) {
  const createOrganization = useCreateOrganization()

  const handleSubmit = (values: OrganizationFormValues) => {
    createOrganization.mutate(values.name, {
      onSuccess: (organizationId) => {
        onCreated(organizationId)
        onOpenChange(false)
      },
    })
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Nueva organización</DialogTitle>
          <DialogDescription>
            Se creará con un workspace inicial “General”. Tú serás su owner.
          </DialogDescription>
        </DialogHeader>

        {open && (
          <OrganizationForm
            onSubmit={handleSubmit}
            isPending={createOrganization.isPending}
            submitLabel="Crear organización"
          />
        )}
      </DialogContent>
    </Dialog>
  )
}
