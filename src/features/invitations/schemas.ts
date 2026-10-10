import { z } from 'zod'

export const invitationFormSchema = z.object({
  email: z.email('Introduce un email válido').max(255),
  role: z.enum(['owner', 'admin', 'member']),
})

export type InvitationFormValues = z.infer<typeof invitationFormSchema>
