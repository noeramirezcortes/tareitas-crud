# Fase 4 — Cierre (billing con Stripe)

> Estado al **2026-10-12**: Fase 4 **cerrada** en producción, en modo
> sandbox/test de Stripe. Especificación original: `doc/FASE4.md`.

## Qué se entregó

| Área | Resultado | Referencia |
|---|---|---|
| Modelo de datos | `plans`, `subscriptions`, `billing_customers`, `stripe_events`; RLS deny-by-default; solo `service_role` escribe | `supabase/migrations/20261013000000_fase4_billing.sql` |
| Límites en servidor | Triggers `BEFORE INSERT` (workspaces, proyectos, miembros + invitaciones, tags) con error `PT402` → HTTP 402 | misma migración |
| Fuente de verdad | Plan solo cambia por eventos `customer.subscription.*` con firma validada, idempotentes y a prueba de eventos viejos | `supabase/functions/stripe-webhook`, `billing_apply_subscription` |
| Pagos | Checkout, Customer Portal y cancelación desde Edge Functions; solo el owner puede pagar o administrar | `supabase/functions/billing-*` |
| UI | `/billing` (plan, límites, consumo, upgrade, administrar), avisos de límite con enlace a planes, botones deshabilitados al tope | `src/pages/BillingPage.tsx`, `src/features/billing` |
| Despliegue | Cloudflare Workers Static Assets + dominio `tareitas.online` | `wrangler.jsonc`, `doc/guia-despliegue.md` |
| Documentación | Variables de entorno, pruebas en test mode, producción, troubleshooting, paso a live | `doc/guia-stripe.md`, `doc/arquitectura.md` §7 |

Reglas de producto aceptadas: facturación por organización; Free = 2
workspaces, 5 proyectos (General no cuenta), 3 miembros (+ invitaciones
pendientes) y tags solo en Pro; Pro sin límites; `past_due` conserva el plan 7
días; al bajar de plan se conservan los datos pero no se puede crear más.

## Validaciones (todas en verde)

| Prueba | Resultado |
|---|---|
| `pnpm typecheck` / `pnpm build` | ✅ |
| `pnpm lint` | ✅ (2 warnings de shadcn aceptados) |
| `pnpm test:rls` | ✅ 177 |
| `pnpm test:functions` (firma real con el SDK de Stripe) | ✅ 34 |
| `pnpm test:billing-local` (runtime Deno real + clave de test) | ✅ 20 |
| `pnpm test:e2e` (Playwright) | ✅ 32 |
| CI de GitHub (`verify` + `e2e`) | ✅ |
| Producción (sandbox): compra con `4242`, webhook aplicado, Pro, portal, cancelación al fin del periodo | ✅ manual, 2026-10-12 |

## Estado de producción

- Migraciones `…00` a `20261013000000_fase4_billing` aplicadas (11/11 en
  `scripts/verify-migrations.sql`); `plans.stripe_price_id` de Pro configurado.
- Funciones desplegadas: `billing-checkout`, `billing-portal`,
  `stripe-webhook` (esta última con `verify_jwt = false` y firma obligatoria).
- Secretos en Supabase: `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`,
  `SITE_URL`.
- Destino de eventos en Stripe (sandbox): 4 eventos, payload *snapshot*.
- Las organizaciones previas quedaron en Free (no pueden crear tags nuevas
  hasta pasar a Pro); decisión aceptada.

## Pendientes opcionales (no bloquean el cierre)

1. **Live mode:** seguir `doc/guia-stripe.md` §7 (nuevo producto/precio live,
   clave `rk_live_`, nuevo destino de eventos, `plans.stripe_price_id` live,
   revisar impuestos y datos fiscales) y repetir una compra real mínima.
2. **`wrangler.jsonc`:** fijar `workers_dev` y `preview_urls` de forma
   explícita (hoy se habilitan por defecto) cuando el dominio sea la entrada
   principal.
3. **Correo:** SMTP propio con remitente `@tareitas.online` antes de activar
   confirmación de email en producción.
4. **Cobertura e2e extra:** edición de tags, vista móvil, modo oscuro.
5. **CI:** actualizar las acciones que avisan de la deprecación de Node 20.
6. **Observabilidad:** alerta cuando el destino de eventos acumule entregas
   fallidas (Stripe Workbench → Event deliveries).
