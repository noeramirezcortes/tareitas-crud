import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { signOut } from '../api'

export function useLogout() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      // Sin esto, los datos del usuario anterior quedan en caché para el siguiente.
      queryClient.clear()
      toast.success('Sesión cerrada')
      navigate('/login', { replace: true })
    },
    onError: () => {
      toast.error('No se pudo cerrar sesión')
    },
  })
}
