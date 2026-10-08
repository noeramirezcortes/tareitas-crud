import { useMutation } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { toast } from 'sonner'

import { signOut } from '../api'

export function useLogout() {
  const navigate = useNavigate()

  return useMutation({
    mutationFn: signOut,
    onSuccess: () => {
      toast.success('Sesión cerrada')
      navigate('/login', { replace: true })
    },
    onError: () => {
      toast.error('No se pudo cerrar sesión')
    },
  })
}
