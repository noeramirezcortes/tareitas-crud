import { z } from 'zod'

/** Espejo de los constraints de la tabla projects. */
export const projectFormSchema = z.object({
  name: z.string().trim().min(1, 'El nombre es obligatorio').max(100, 'Máximo 100 caracteres'),
  description: z.string().trim().max(500, 'Máximo 500 caracteres').optional(),
})

export type ProjectFormValues = z.infer<typeof projectFormSchema>
