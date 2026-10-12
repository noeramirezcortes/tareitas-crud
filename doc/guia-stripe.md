# Guía de Stripe (Fase 4 — Billing)

Cómo funciona el billing de Tareitas, qué variables necesita, cómo probarlo en
**modo test** y cómo desplegarlo. Todo el dinero se maneja con claves de test
hasta que decidas pasar a *live* (sección 7).

## 1. Cómo funciona

```
Navegador ──(JWT del usuario)──▶ billing-checkout ──▶ Stripe Checkout
   ▲                              billing-portal  ──▶ Stripe Customer Portal
   │                                                      │
   │                       eventos firmados               ▼
   └── lee plan/consumo ◀── Postgres ◀── stripe-webhook ◀── Stripe
       (get_billing_status)   (RLS)      (valida firma)
```

| Regla | Cómo se cumple |
|---|---|
| Stripe es la fuente de verdad | El plan solo cambia por eventos `customer.subscription.*` validados. La redirección `?checkout=success` solo muestra "Confirmando…" |
| El frontend nunca decide el plan | `subscriptions` y `plans` no son escribibles por la app (RLS + `revoke`); `billing_apply_subscription` solo la ejecuta `service_role` |
| Nunca se expone la clave secreta | Solo vive en los secretos de las Edge Functions; ningún `VITE_*` la contiene |
| Webhooks seguros | Firma validada sobre el cuerpo **crudo**, tolerancia de 5 min, idempotencia por `event.id`, tolerante a eventos fuera de orden |
| Operaciones sensibles en servidor | Checkout y portal son Edge Functions; exigen sesión y rol **owner** |
| El precio no viene del cliente | El cliente solo envía un `plan_code`; el `price_id` sale de la tabla `plans` |

**Billing por organización.** Cada organización tiene su propio plan
(`free` por defecto). Sin fila en `subscriptions` o con un estado que no da
acceso, es FREE.

### Planes y límites

Viven en la tabla `plans` (`null` = ilimitado). Agregar un plan es un `INSERT`.

| Plan | Workspaces | Proyectos (sin contar General) | Miembros (+ invitaciones pendientes) | Etiquetas |
|---|---|---|---|---|
| `free` | 2 | 5 | 3 | No (se conservan las existentes) |
| `pro` | ∞ | ∞ | ∞ | Sí |

- Los límites se aplican con **triggers en la base de datos**; la UI solo los
  anticipa. Superarlos responde HTTP **402** con SQLSTATE `PT402` y el recurso
  en `hint` (`projects`, `workspaces`, `members`, `feature:tags`).
- Al bajar de plan **no se borra nada**: se conserva lo creado, pero no se
  puede crear más por encima del límite.
- Pago fallido (`past_due`): se conserva el plan **7 días** de gracia; pasada
  la gracia vuelve a FREE. La gracia no se reinicia con nuevos reintentos.
- No se puede eliminar una organización con suscripción vigente (para que
  Stripe no siga cobrando sin organización).

### Tablas

| Tabla | Qué guarda | Quién escribe |
|---|---|---|
| `plans` | Catálogo, límites, funciones, `stripe_price_id` | Migraciones / SQL Editor |
| `subscriptions` | Estado de Stripe por organización | Solo el webhook (`service_role`) |
| `billing_customers` | Organización ↔ Stripe Customer | Solo servidor |
| `stripe_events` | Eventos ya procesados (idempotencia) | Solo servidor |

## 2. Variables de entorno

### Frontend (`.env`, públicas en el bundle)

Billing **no agrega variables al frontend**. Siguen siendo solo:

| Variable | Descripción |
|---|---|
| `VITE_SUPABASE_URL` | URL del proyecto Supabase |
| `VITE_SUPABASE_ANON_KEY` | Clave anónima (pública) |

> Nunca pongas claves de Stripe en un `VITE_*`: todo `VITE_*` termina en el bundle.

### Edge Functions (secretos del servidor)

| Variable | Obligatoria | Descripción |
|---|---|---|
| `STRIPE_SECRET_KEY` | Sí (checkout y portal) | Clave del servidor. **Recomendado:** restringida `rk_test_…` con *Write* en Customers, Checkout Sessions y Customer portal. `sk_test_…` también sirve |
| `STRIPE_WEBHOOK_SECRET` | Sí (webhook) | `whsec_…` del endpoint. En local lo imprime `stripe listen`; en producción, el Dashboard |
| `SITE_URL` | Sí | URL pública de la app (sin barra final): destino de las redirecciones de Stripe y origen CORS |
| `SUPABASE_URL` | Automática | La inyecta Supabase |
| `SUPABASE_SERVICE_ROLE_KEY` | Automática | La inyecta Supabase. Solo existe en el servidor |

- **Local:** `supabase/functions/.env` (copia de `supabase/functions/.env.example`; ignorado por git).
- **Producción:** `supabase secrets set STRIPE_SECRET_KEY=… STRIPE_WEBHOOK_SECRET=… SITE_URL=…`.

### Solo para pruebas (siempre contra el stack LOCAL)

| Variable | Por defecto |
|---|---|
| `E2E_SUPABASE_URL` | `http://127.0.0.1:54321` (se aborta si no es local) |
| `E2E_SUPABASE_ANON_KEY` / `E2E_SUPABASE_SERVICE_ROLE_KEY` | Claves de demo del stack local |

El price de Stripe **no es una variable de entorno**: está en
`plans.stripe_price_id` (distinto en test y en live).

## 3. Preparar Stripe (modo test)

1. Crea la cuenta en `stripe.com` y usa el entorno de **pruebas** (Test mode /
   Sandbox). No necesitas activar la cuenta ni datos bancarios.
2. **Producto:** *Product catalog* → *Add product* → `Tareitas Pro`, precio
   *Recurring* mensual. Copia el **Price ID** (`price_…`).
3. **Customer Portal:** *Settings → Billing → Customer portal* → actívalo en
   modo test y habilita *cancelar suscripción*, *actualizar método de pago* y
   *ver facturas*. Sin esto, abrir el portal falla.
4. **Clave de API:** *Developers → API keys → Create restricted key* con
   **Write** en: *Customers*, *Checkout Sessions* y *Customer portal*.
   - Si falta uno, la función falla con *"does not have the required
     permissions … `checkout_session_write`"* (se ve en el log de la función).
5. **CLI de Stripe:** instálala (`scoop install stripe`) y `stripe login`.

## 4. Probar en local (modo test)

Cuatro procesos, cada uno en su terminal:

```bash
# 1. Supabase (API + Auth + base); aplica las migraciones al arrancar
supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,logflare,vector,supavisor

# 2. Edge Functions (leen supabase/functions/.env)
supabase functions serve --env-file supabase/functions/.env

# 3. Reenvío de webhooks de Stripe → imprime el whsec_… para el .env
stripe listen --events customer.subscription.created,customer.subscription.updated,customer.subscription.deleted,checkout.session.completed --forward-to http://127.0.0.1:54321/functions/v1/stripe-webhook

# 4. La app contra el Supabase LOCAL (el .env del repo apunta a producción)
VITE_SUPABASE_URL=http://127.0.0.1:54321 VITE_SUPABASE_ANON_KEY=<anon key local> pnpm exec vite --host 127.0.0.1 --port 3000
```

(`supabase status -o env` muestra la anon key local.) Una sola vez, asigna tu
price al plan Pro de la base local:

```sql
update public.plans set stripe_price_id = 'price_xxx' where code = 'pro';
```

### Recorrido manual

1. Regístrate (en local no hay confirmación de email) → *Plan y facturación*.
2. **Actualizar a Pro** → Checkout de Stripe → tarjeta `4242 4242 4242 4242`,
   cualquier fecha futura y CVC.
3. Al volver, "Confirmando tu pago…" y pasa a **Plan Pro · Activa**.
4. **Administrar suscripción** → cancela. Verás "Tu suscripción termina el …":
   conserva Pro hasta el fin del periodo pagado (es lo correcto).

| Tarjeta | Resultado |
|---|---|
| `4242 4242 4242 4242` | Pago exitoso |
| `4000 0000 0000 0341` | Se adjunta, pero los cobros posteriores fallan (prueba de `past_due`) |
| `4000 0000 0000 0002` | Pago rechazado |
| `4000 0025 0000 3155` | Requiere autenticación 3D Secure |

### Pruebas automáticas

| Comando | Qué cubre | Requiere |
|---|---|---|
| `pnpm test:rls` | Planes, límites, suscripciones y eventos en SQL (PGlite) | Nada |
| `pnpm test:functions` | Firma del webhook (SDK real de Stripe) y acciones de checkout/portal | Nada |
| `pnpm test:billing-local` | Las 3 funciones en el runtime Deno real + base local | Pasos 1 y 2 de arriba |
| `pnpm test:e2e` | UI de billing (plan, límites, Pro, cancelación, vista de miembro) | Paso 1 |

## 5. Desplegar a producción

Orden recomendado (aplicar la migración **antes** de publicar la UI, y los
límites FREE empiezan a regir en cuanto se aplica):

**a) Base de datos.** En el *SQL Editor* de Supabase:

1. Pega y ejecuta `supabase/migrations/20261013000000_fase4_billing.sql`
   (va en una transacción).
2. Asigna el price (el de **test** mientras pruebes):
   ```sql
   update public.plans
   set stripe_price_id = 'price_xxx'
   where code = 'pro';
   ```
3. Verifica con `scripts/verify-migrations.sql` (11 filas en `true`) y:
   ```sql
   select code, max_workspaces, max_projects, max_members, stripe_price_id
   from public.plans order by sort_order;
   ```

**b) Funciones y secretos** (una terminal con la CLI):

```bash
supabase login
supabase link --project-ref <ref-de-tu-proyecto>
supabase secrets set STRIPE_SECRET_KEY=rk_test_… SITE_URL=https://tu-dominio
supabase functions deploy billing-checkout billing-portal stripe-webhook
```

`stripe-webhook` toma `verify_jwt = false` de `supabase/config.toml`; si lo
despliegas desde otro sitio, añade `--no-verify-jwt` a **esa** función.

**c) Endpoint de webhook en Stripe.** *Developers → Webhooks → Add endpoint*:

- URL: `https://<ref>.supabase.co/functions/v1/stripe-webhook`
- Eventos: `customer.subscription.created`, `customer.subscription.updated`,
  `customer.subscription.deleted`, `checkout.session.completed`.
- Copia el *Signing secret* (`whsec_…`) y guárdalo:
  `supabase secrets set STRIPE_WEBHOOK_SECRET=whsec_…`

**d) Publicar la app** en Cloudflare Pages (`doc/guia-despliegue.md`, con la ruta `/billing`) y repetir el recorrido manual.
En *Developers → Webhooks → tu endpoint* puedes ver cada entrega y reenviarla.

> El `SITE_URL` de producción debe ser el dominio donde sirves la app: a él
> vuelve Stripe tras pagar y es el único origen CORS permitido.

## 6. Problemas frecuentes

| Síntoma | Causa | Solución |
|---|---|---|
| "Error interno del servicio de pagos" al actualizar | Falla la llamada a Stripe | Mira el log de `billing-checkout` (`supabase functions serve` en local; *Functions → Logs* en producción) |
| Log: *does not have the required permissions … `checkout_session_write`* | Falta un permiso en la clave restringida | Dashboard → editar la clave → *Write* en Customers, Checkout Sessions y Customer portal |
| Portal responde 404 | La organización aún no tiene Customer (nunca inició un pago) | Es lo esperado; primero se actualiza a Pro |
| Portal falla pidiendo configuración | El Customer Portal no está guardado en ese modo (test/live) | *Settings → Billing → Customer portal → Save* |
| Webhook responde 400 | Firma inválida: `whsec` equivocado (cada endpoint y `stripe listen` tienen el suyo) | Actualiza `STRIPE_WEBHOOK_SECRET` y reinicia `functions serve` |
| Webhook responde 500 "Precio de Stripe desconocido" | `plans.stripe_price_id` no coincide con el price de la suscripción (típico al mezclar test y live) | Corrige el `UPDATE plans …`; Stripe reintenta solo |
| Pagué pero la app sigue en Free | Webhook no llega (¿`stripe listen` apagado?) | Revisa las entregas en Stripe; la app consulta 30 s y avisa que recargues |
| Tras cancelar sigue en Pro | Correcto: la cancelación aplica al final del periodo pagado | — |
| El portal no regresa solo a la app | Es el comportamiento de Stripe | El usuario pulsa "Volver a Tareitas" en el portal |
| `supabase start` + `functions serve`: aviso de *wall clock duration* | Aislamientos inactivos del runtime local | Inofensivo |

## 7. Pasar a modo *live*

1. Activa tu cuenta de Stripe (datos del negocio y bancarios).
2. Crea el producto y el precio **también en live** (los de test no existen allí).
3. Crea una clave restringida **live** y un endpoint de webhook **live**
   (distinto `whsec_`).
4. `supabase secrets set STRIPE_SECRET_KEY=rk_live_… STRIPE_WEBHOOK_SECRET=whsec_…`
5. `update public.plans set stripe_price_id = 'price_live_…' where code = 'pro';`
6. Configura el Customer Portal en live.
7. Prueba con una compra real pequeña y cancélala.

No mezcles claves de un modo con el price o el webhook del otro: es la causa
más común de "precio desconocido" y de firmas inválidas.

## 8. Lista de seguridad

- [x] La clave secreta solo existe como secreto de Edge Function.
- [x] `supabase/functions/.env` está en `.gitignore`.
- [x] El webhook valida la firma sobre el cuerpo crudo y rechaza repeticiones fuera de tolerancia.
- [x] Eventos idempotentes y tolerantes a desorden.
- [x] Checkout y portal exigen sesión + rol owner; el precio sale de la base.
- [x] Las tablas de billing no son escribibles desde el cliente (RLS + `revoke`).
- [x] Los límites los aplica la base de datos, no la UI.
- [ ] Antes de *live*: rotar a claves live restringidas y revisar el log de entregas del webhook.
