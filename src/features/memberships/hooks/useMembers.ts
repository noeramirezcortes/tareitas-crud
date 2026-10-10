import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'

import type { OrgRole } from '@/features/organizations/types'

import { listMembers, memberKeys, removeMember, updateMemberRole } from '../api'

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
