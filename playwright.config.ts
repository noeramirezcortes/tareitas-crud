import { defineConfig, devices } from '@playwright/test'

/**
 * Pruebas de UI contra el stack LOCAL de Supabase (`supabase start`), nunca
 * contra producción. La URL y la clave se inyectan al servidor de Vite por
 * variables de entorno (que tienen prioridad sobre `.env`), y se aborta si
 * la URL no es local.
 *
 * La clave anónima es la de demo que trae todo `supabase start`; se puede
 * sobrescribir con E2E_SUPABASE_ANON_KEY.
 */
const SUPABASE_URL = process.env.E2E_SUPABASE_URL ?? 'http://127.0.0.1:54321'
const SUPABASE_ANON_KEY =
  process.env.E2E_SUPABASE_ANON_KEY ??
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZS1kZW1vIiwicm9sZSI6ImFub24iLCJleHAiOjE5ODM4MTI5OTZ9.CRXP1A7WOeoJeXxjNni43kdQwgnWNReilDMblYTn_I0'

const { hostname } = new URL(SUPABASE_URL)
if (hostname !== '127.0.0.1' && hostname !== 'localhost') {
  throw new Error(
    `E2E_SUPABASE_URL debe ser local (recibido: ${hostname}). Las pruebas de UI crean y borran datos.`,
  )
}

// Coincide con site_url de supabase/config.toml.
const PORT = 3000
const BASE_URL = `http://127.0.0.1:${PORT}`

export default defineConfig({
  testDir: './e2e',
  // Los specs comparten la base local; cada uno usa usuarios únicos, pero
  // los flujos dentro de un archivo son secuenciales.
  fullyParallel: false,
  workers: 1,
  retries: process.env.CI ? 1 : 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [['list'], ['html', { open: 'never', outputFolder: 'playwright-report' }]],
  outputDir: 'test-results',
  use: {
    baseURL: BASE_URL,
    locale: 'es-ES',
    trace: 'retain-on-failure',
    screenshot: 'only-on-failure',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: `pnpm exec vite --host 127.0.0.1 --port ${PORT} --strictPort`,
    url: BASE_URL,
    // Nunca reutilizar: un `pnpm dev` abierto podría apuntar a producción.
    reuseExistingServer: false,
    timeout: 60_000,
    env: {
      VITE_SUPABASE_URL: SUPABASE_URL,
      VITE_SUPABASE_ANON_KEY: SUPABASE_ANON_KEY,
    },
  },
})
