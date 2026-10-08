import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { signIn } from '../api'
import type { LoginValues } from '../schemas'

export function useLogin() {
  return useMutation({
    mutationFn: (values: LoginValues) => signIn(values.email, values.password),
    onError: () => {
      toast.error('No se pudo iniciar sesión. Revisa tus credenciales.')
    },
  })
}
