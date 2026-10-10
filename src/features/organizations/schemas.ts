import { z } from 'zod'

export const organizationFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
})

export type OrganizationFormValues = z.infer<typeof organizationFormSchema>