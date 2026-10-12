# Guía de despliegue — Cloudflare Pages + tareitas.online

Publica la app (frontend estático) en **Cloudflare Pages** con el dominio
`tareitas.online`. El backend sigue siendo Supabase; los pagos, Stripe
(`doc/guia-stripe.md`).

```
Usuario ──▶ tareitas.online (Cloudflare Pages: HTML/JS estáticos)
                │
                ├──▶ Supabase (Auth, base de datos, Edge Functions)
                └──▶ Stripe Checkout / Portal (redirecciones desde las funciones)
```

> El frontend es público: todo lo que pongas en `VITE_*` termina en el
> navegador. Solo la URL y la **anon key** de Supabase van ahí; nunca la
> `service_role` ni claves de Stripe.

## 1. Crear el proyecto en Cloudflare Pages

1. Entra a `dash.cloudflare.com` (cuenta gratuita) → **Workers & Pages** →
   **Create** → **Pages** → **Connect to Git**.
2. Autoriza GitHub y elige el repositorio `tareitas-crud`, rama `main`.
3. Configuración de build:

   | Campo | Valor |
   |---|---|
   | Framework preset | `Vite` (o ninguno) |
   | Build command | `pnpm build` |
   | Build output directory | `dist` |
   | Root directory | *(vacío)* |

4. **Environment variables** (agrégalas en *Production* y en *Preview*):

   | Variable | Valor |
   |---|---|
   | `VITE_SUPABASE_URL` | La URL de tu proyecto de **producción** (`https://<ref>.supabase.co`) |
   | `VITE_SUPABASE_ANON_KEY` | Su anon key (Supabase → Project Settings → API) |
   | `NODE_VERSION` | `22` |
   | `PNPM_VERSION` | `12.10.1` (la misma que usa el CI) |

5. **Save and Deploy**. En un par de minutos tendrás una URL
   `https://tareitas-crud.pages.dev`.

**Qué esperar:** Pages detecta que no hay `404.html` y trata el proyecto como
SPA: `/billing`, `/tasks` o `/invite/...` siguen funcionando al recargar. Si
tu panel te lleva al flujo nuevo de *Workers Static Assets* en lugar de
*Pages*, usa los mismos comandos y activa la opción
`not_found_handling = "single-page-application"` (SPA) para el mismo efecto.

Las cabeceras de seguridad y la caché de `/assets` salen de
`public/_headers` (ya incluido).

## 2. Conectar el dominio `tareitas.online`

Para un dominio raíz (sin `www`), Pages requiere que el DNS lo sirva
Cloudflare. Lo más simple es **mover los nameservers** (el dominio sigue
siendo tuyo y registrado en Namecheap).

1. Cloudflare → **Add a site** → `tareitas.online` → plan **Free**. Cloudflare
   te muestra **dos nameservers** (p. ej. `xxx.ns.cloudflare.com`).
2. Namecheap → **Domain List** → *Manage* en `tareitas.online` →
   **Nameservers** → **Custom DNS** → pega los dos de Cloudflare → ✔.
3. Espera a que Cloudflare marque el sitio como **Active** (minutos a unas
   horas; te avisa por correo).
4. Pages → tu proyecto → **Custom domains** → **Set up a custom domain** →
   `tareitas.online`. Cloudflare crea el registro y emite el certificado
   HTTPS solo.
5. (Opcional) `www`: añade también `www.tareitas.online` como dominio
   personalizado y crea una **Redirect Rule** (*Rules → Redirect Rules*):
   `www.tareitas.online/*` → `https://tareitas.online/${1}`, 301.

> Hasta que el DNS se propague puedes probar todo en `*.pages.dev`.

## 3. Autorizar el dominio en Supabase Auth

Supabase Dashboard → **Authentication → URL Configuration**:

| Campo | Valor |
|---|---|
| Site URL | `https://tareitas.online` |
| Redirect URLs | `https://tareitas.online/**` |
|  | `https://*.pages.dev/**` *(opcional: previsualizaciones)* |
|  | `http://localhost:5173/**` *(desarrollo)* |

Sin esto, los enlaces de correo (confirmación de cuenta, invitaciones)
aterrizan en una URL equivocada. Ver también `doc/guia-supabase-setup.md`.

## 4. Conectar Stripe con el dominio

Stripe no necesita el dominio: el webhook apunta a Supabase y las URLs de
retorno las arma la Edge Function con `SITE_URL`. Solo falta:

```bash
supabase secrets set SITE_URL=https://tareitas.online
```

Mientras pruebas en `*.pages.dev`, pon temporalmente esa URL en `SITE_URL`
(Stripe volverá a ella tras pagar) y cámbiala al dominio definitivo después.

## 5. Verificar

```bash
curl -sI https://tareitas.online | head -12
```

- [ ] Responde `200` por HTTPS y trae `x-content-type-options: nosniff`.
- [ ] Recargar `https://tareitas.online/billing` (sin sesión) muestra el
      login, no un 404.
- [ ] Registro y login funcionan; `/projects` carga datos.
- [ ] El recorrido de compra de `doc/guia-stripe.md` §4 funciona (modo test).
- [ ] La consola del navegador no muestra errores de CORS.

## 6. Notas

- **Cada push a `main` despliega solo.** El CI de GitHub (typecheck, lint,
  tests) corre en paralelo: revísalo antes de dar por buena una versión.
  Cada rama o PR obtiene una URL de previsualización.
- **Las previsualizaciones usan los mismos datos de producción** si
  comparten `VITE_SUPABASE_*`. Si no quieres eso, define otras variables para
  el entorno *Preview* (p. ej. un proyecto Supabase de pruebas).
- **Correo:** el SMTP por defecto de Supabase limita los envíos y usa un
  remitente genérico. Si activas confirmación de email en producción,
  configura un SMTP propio (Resend, Brevo…) con un remitente de
  `tareitas.online` (*Authentication → SMTP Settings*).
- **Revertir:** en Pages → *Deployments* puedes volver a una versión anterior
  con un clic.
