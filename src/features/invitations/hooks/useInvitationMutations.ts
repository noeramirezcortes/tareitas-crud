import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import { billingKeys } from '@/features/billing/api'
import { notifyPlanLimit } from '@/features/billing/limits'

import { acceptInvitation, cancelInvitation, createInvitation, invitationKeys, listInvitations } from '../api'
import type { CreateInvitationInput } from '../api'

export function useInvitations(organizationId: string | null) {
  return useQuery({
    queryKey: organizationId ? invitationKeys.byOrg(organizationId) : ['invitations', 'none'],
    queryFn: () => listInvitations(organizationId as string),
    enabled: organizationId !== null,
  })
}

export function useCreateInvitation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (input: Omit<CreateInvitationInput, 'organizationId'>) =>
      createInvitation({ ...input, organizationId }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.byOrg(organizationId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.all })
      toast.success('Invitación creada. Copia el enlace para compartirlo.')
    },
    onError: (error) => {
      if (notifyPlanLimit(error)) return
      // Índice único parcial: ya hay una invitación pendiente para ese email.
      const duplicate = error.message.includes('invitations_email_org_pending_idx')
      toast.error(
        duplicate ? 'Ya hay una invitación pendiente para ese email' : error.message || 'No se pudo crear la invitación',
      )
    },
  })
}

export function useCancelInvitation(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (id: string) => cancelInvitation(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: invitationKeys.byOrg(organizationId) })
      queryClient.invalidateQueries({ queryKey: billingKeys.all })
      toast.success('Invitación cancelada')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo cancelar la invitación')
    },
  })
}

export function useAcceptInvitation() {
  return useMutation({
    mutationFn: (token: string) => acceptInvitation(token),
  })
}
