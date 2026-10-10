import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { useAcceptInvitation } from '@/features/invitations/hooks/useInvitationMutations'
import { useWorkspace } from '@/features/workspaces/WorkspaceContext'

export function AcceptInvitationPage() {
  const { token = '' } = useParams()
  const navigate = useNavigate()
  const { refresh, selectOrganization } = useWorkspace()
  const acceptInvitation = useAcceptInvitation()
  const [error, setError] = useState<string | null>(null)

  const handleAccept = () => {
    setError(null)
    acceptInvitation.mutate(token, {
      onSuccess: async (organizationId) => {
        // Primero se actualizan las organizaciones, luego se selecciona la nueva.
        await refresh()
        selectOrganization(organizationId)
        navigate('/dashboard', { replace: true })
      },
      onError: (e) => setError(e.message || 'No se pudo aceptar la invitación'),
    })
  }

  return (
    <div className="mx-auto max-w-md">
      <Card>
        <CardHeader>
          <CardTitle>Invitación a una organización</CardTitle>
          <CardDescription>
            Acepta para unirte con tu rol. Debes haber iniciado sesión con el email al que se envió la invitación.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
          <Button className="w-full" onClick={handleAccept} disabled={acceptInvitation.isPending}>
            {acceptInvitation.isPending ? 'Aceptando…' : 'Aceptar invitación'}
          </Button>
          <Button variant="ghost" className="w-full" onClick={() => navigate('/dashboard')}>
            Ahora no
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}
