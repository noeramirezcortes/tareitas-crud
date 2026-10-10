import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { OrgRole } from '@/features/organizations/types'

import { leaveOrganization, listMembers, memberKeys, removeMember, updateMemberRole } from '../api'

export function useMembers(organizationId: string | null) {
  return useQuery({
    queryKey: organizationId ? memberKeys.byOrg(organizationId) : ['members', 'none'],
    queryFn: () => listMembers(organizationId as string),
    enabled: organizationId !== null,
  })
}

export function useUpdateMemberRole(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: ({ userId, role }: { userId: string; role: OrgRole }) =>
      updateMemberRole(organizationId, userId, role),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.byOrg(organizationId) })
      toast.success('Rol actualizado')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo cambiar el rol')
    },
  })
}

export function useRemoveMember(organizationId: string) {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: (userId: string) => removeMember(organizationId, userId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: memberKeys.byOrg(organizationId) })
      toast.success('Miembro expulsado')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo expulsar al miembro')
    },
  })
}

/**
 * Salir de la organización. No invalida queries: quien llama navega fuera
 * y refresca el contexto de workspaces tras el éxito.
 */
export function useLeaveOrganization(organizationId: string) {
  return useMutation({
    mutationFn: (userId: string) => leaveOrganization(organizationId, userId),
    onSuccess: () => {
      toast.success('Has salido de la organización')
    },
    onError: (error) => {
      toast.error(error.message || 'No se pudo salir de la organización')
    },
  })
}
