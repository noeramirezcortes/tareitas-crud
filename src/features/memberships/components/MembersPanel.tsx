import { Trash2 } from 'lucide-react'
import { useState } from 'react'

import { ConfirmDialog } from '@/components/common/ConfirmDialog'
import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import type { OrgRole } from '@/features/organizations/types'
import { formatDueDate } from '@/utils/dates'

import { useLeaveOrganization, useMembers, useRemoveMember, useUpdateMemberRole } from '../hooks/useMembers'

const ROLE_LABELS: Record<OrgRole, string> = {
  owner: 'Owner',
  admin: 'Admin',
  member: 'Miembro',
}

interface MembersPanelProps {
  organizationId: string
  myUserId: string
  myRole: OrgRole | undefined
  /** Se llama tras salir de la organización (para refrescar y navegar). */
  onLeft: () => void
}

/**
 * Lista de miembros con gestión de roles, expulsión y salida voluntaria.
 * La UI refleja las reglas de la BD (que siguen siendo la barrera real):
 * sólo owners tocan owners, nadie se cambia ni expulsa a sí mismo, y el
 * último owner no puede salir (trigger de la BD).
 */
export function MembersPanel({ organizationId, myUserId, myRole, onLeft }: MembersPanelProps) {
  const { data: members, isLoading, isError, refetch } = useMembers(organizationId)
  const updateRole = useUpdateMemberRole(organizationId)
  const removeMember = useRemoveMember(organizationId)
  const leave = useLeaveOrganization(organizationId)
  const [leaveOpen, setLeaveOpen] = useState(false)

  const isOwner = myRole === 'owner'
  const isAdmin = myRole === 'owner' || myRole === 'admin'

  if (isLoading) return <LoadingSpinner />
  if (isError) return <ErrorState description="No se pudieron cargar los miembros." onRetry={() => refetch()} />

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {members?.map((member) => {
          const isMe = member.user_id === myUserId
          const isTargetOwner = member.role === 'owner'
          const canEdit = isAdmin && !isMe && (!isTargetOwner || isOwner)
          const canRemove = canEdit

          return (
            <li key={member.user_id} className="flex flex-wrap items-center gap-3 p-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {member.email}
                  {isMe && <span className="ml-2 text-xs text-muted-foreground">(tú)</span>}
                </p>
                <p className="text-xs text-muted-foreground">Desde {formatDueDate(member.created_at.slice(0, 10))}</p>
              </div>

              {canEdit ? (
                <Select
                  value={member.role}
                  onValueChange={(role) =>
                    updateRole.mutate({ userId: member.user_id, role: role as OrgRole })
                  }
                  disabled={updateRole.isPending}
                >
                  <SelectTrigger className="w-32" aria-label={`Rol de ${member.email}`}>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {isOwner && <SelectItem value="owner">Owner</SelectItem>}
                    <SelectItem value="admin">Admin</SelectItem>
                    <SelectItem value="member">Miembro</SelectItem>
                  </SelectContent>
                </Select>
              ) : (
                <Badge variant={isTargetOwner ? 'default' : 'secondary'}>{ROLE_LABELS[member.role]}</Badge>
              )}

              {canRemove && (
                <Button
                  variant="ghost"
                  size="icon"
                  className="text-destructive hover:text-destructive"
                  aria-label={`Expulsar a ${member.email}`}
                  disabled={removeMember.isPending}
                  onClick={() => removeMember.mutate(member.user_id)}
                >
                  <Trash2 className="size-4" aria-hidden="true" />
                </Button>
              )}

              {isMe && (
                <Button variant="outline" size="sm" onClick={() => setLeaveOpen(true)}>
                  Salir
                </Button>
              )}
            </li>
          )
        })}
      </ul>

      <ConfirmDialog
        open={leaveOpen}
        onOpenChange={setLeaveOpen}
        title="Salir de la organización"
        description="Perderás acceso a sus workspaces, proyectos y etiquetas. Si eres el único owner, no podrás salir hasta transferir el ownership."
        confirmLabel="Salir"
        destructive
        onConfirm={() =>
          leave.mutate(myUserId, {
            onSuccess: () => {
              setLeaveOpen(false)
              onLeft()
            },
          })
        }
      />
    </>
  )
}
