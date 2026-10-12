import { useMutation } from '@tanstack/react-query'
import { toast } from 'sonner'

import { signUp } from '../api'
import type { RegisterValues } from '../schemas'

export function useRegister() {
  return useMutation({
    mutationFn: ({ redirectTo, ...values }: RegisterValues & { redirectTo?: string }) =>
      signUp(values.email, values.password, redirectTo),
    onError: () => {
      toast.error('No se pudo crear la cuenta. Inténtalo de nuevo.')
    },
  })
}
