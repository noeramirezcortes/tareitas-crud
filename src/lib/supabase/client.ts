import { createClient } from '@supabase/supabase-js'

import { env } from '@/config/env'

/**
 * Singleton del cliente de Supabase.
 *
 * Usa la anon key (segura en frontend porque la seguridad real
 * la aplica Row Level Security en PostgreSQL).
 *
 * Regla de arquitectura: este módulo SOLO se importa desde
 * `lib/supabase/` y los `api.ts` de cada feature. Nunca desde
 * componentes ni páginas.
 */
export const supabase = createClient(env.VITE_SUPABASE_URL, env.VITE_SUPABASE_ANON_KEY)
