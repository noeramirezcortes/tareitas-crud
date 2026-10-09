import { z } from 'zod'

/** Espejo de los constraints de la tabla tags. */
export const tagNameSchema = z
  .string()
  .trim()
  .min(1, 'El nombre es obligatorio')
  .max(50, 'Máximo 50 caracteres')
