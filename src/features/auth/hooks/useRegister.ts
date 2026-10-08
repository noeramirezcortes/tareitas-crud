import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { signUp } from '../api'
import type { RegisterValues } from '../schemas'

export function useRegister() {
  return useMutation({
    mutationFn: (values: RegisterValues) => signUp(values.email, values.password),
    onError: () => {
      toast.error('No se pudo crear la cuenta. Inténtalo de nuevo.')
    },
  })
}
