import { Copy, Plus, X } from 'lucide-react'
import { useState } from 'react'
import { toast } from 'sonner'

import { ErrorState } from '@/components/common/ErrorState'
import { LoadingSpinner } from '@/components/common/LoadingSpinner'
import { Badge } from '@/components/ui/badge'
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
import type { OrgRole } from '@/features/organizations/types'
import { formatDueDate } from '@/utils/dates'

import { invitationLink } from '../api'
import { useCancelInvitation, useCreateInvitation, useInvitations } from '../hooks/useInvitationMutations'
import type { Invitation } from '../types'

interface InvitationsPanelProps {
  organizationId: string
  myUserId: string
  isOwner: boolean
}

type InvitationStatus = 'pending' | 'accepted' | 'expired'

function statusOf(invitation: Invitation): InvitationStatus {
  if (invitation.accepted_at) return 'accepted'
  if (new Date(invitation.expires_at) <= new Date()) return 'expired'
  return 'pending'
}

const STATUS_LABELS: Record<InvitationStatus, string> = {
  pending: 'Pendiente',
  accepted: 'Aceptada',
  expired: 'Expirada',
}

/**
 * Invitaciones por email. Sin proveedor de correo, el admin copia el enlace
 * y lo comparte; el enlace sólo funciona para el email invitado.
 */
export function InvitationsPanel({ organizationId, myUserId, isOwner }: InvitationsPanelProps) {
  const { data: invitations, isLoading, isError, refetch } = useInvitations(organizationId)
  const createInvitation = useCreateInvitation(organizationId)
  const cancelInvitation = useCancelInvitation(organizationId)

  const [email, setEmail] = useState('')
  const [role, setRole] = useState<OrgRole>('member')

  const submit = (event: React.FormEvent) => {
    event.preventDefault()
    const trimmed = email.trim()
    if (!trimmed.includes('@')) {
      toast.error('Introduce un email válido')
      return
    }
    createInvitation.mutate(
      { email: trimmed, role, invitedBy: myUserId },
      { onSuccess: () => setEmail('') },
    )
  }

  const copyLink = async (token: string) => {
    try {
      await navigator.clipboard.writeText(invitationLink(token))
      toast.success('Enlace copiado')
    } catch {
      toast.error('No se pudo copiar. Selecciona el enlace manualmente.')
    }
  }

  return (
    <div className="space-y-4">
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto] sm:items-end">
        <div className="space-y-2">
          <Label htmlFor="invite-email">Email</Label>
          <Input
            id="invite-email"
            type="email"
            placeholder="persona@empresa.com"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="off"
          />
        </div>

        <div className="space-y-2">
          <Label>Rol</Label>
          <Select value={role} onValueChange={(value) => setRole(value as OrgRole)}>
            <SelectTrigger aria-label="Rol de la invitación">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {isOwner && <SelectItem value="owner">Owner</SelectItem>}
              <SelectItem value="admin">Admin</SelectItem>
              <SelectItem value="member">Miembro</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <Button type="submit" disabled={createInvitation.isPending}>
          <Plus className="size-4" aria-hidden="true" />
          Invitar
        </Button>
      </form>

      {isLoading && <LoadingSpinner />}
      {isError && (
        <ErrorState description="No se pudieron cargar las invitaciones." onRetry={() => refetch()} />
      )}

      {invitations && invitations.length === 0 && (
        <p className="text-sm text-muted-foreground">No hay invitaciones todavía.</p>
      )}

      {invitations && invitations.length > 0 && (
        <ul className="divide-y rounded-lg border">
          {invitations.map((invitation) => {
            const status = statusOf(invitation)
            const isPending = status === 'pending'
            return (
              <li key={invitation.id} className="flex flex-wrap items-center gap-3 p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{invitation.email}</p>
                  <p className="text-xs text-muted-foreground">
                    {invitation.role} · {STATUS_LABELS[status]}
                    {isPending && ` · vence ${formatDueDate(invitation.expires_at.slice(0, 10))}`}
                  </p>
                </div>
                <Badge variant={isPending ? 'default' : 'secondary'}>{STATUS_LABELS[status]}</Badge>

                {isPending && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => copyLink(invitation.token)}>
                      <Copy className="size-4" aria-hidden="true" />
                      Copiar enlace
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label={`Cancelar invitación de ${invitation.email}`}
                      disabled={cancelInvitation.isPending}
                      onClick={() => cancelInvitation.mutate(invitation.id)}
                    >
                      <X className="size-4" aria-hidden="true" />
                    </Button>
                  </>
                )}
              </li>
            )
          })}
        </ul>
      )}

      <p className="text-xs text-muted-foreground">
        Los enlaces caducan a los 7 días y sólo sirven para el email invitado.
      </p>
    </div>
  )
}
