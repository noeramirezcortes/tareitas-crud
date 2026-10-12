# Informe de pruebas de UI (3.6)

**Fecha:** 2026-10-12 · **Resultado:** 23 de 23 pruebas en verde (~47 s)
**Herramienta:** Playwright 1.64 (Chromium) · **Entorno:** Supabase **local** en Docker
(Auth + PostgREST + Postgres 17), con las 11 migraciones aplicadas. No se toca producción.

## Cómo ejecutarlas

```bash
supabase start -x realtime,storage-api,imgproxy,mailpit,postgres-meta,studio,edge-runtime,logflare,vector,supavisor
pnpm test:e2e                        # corre las 23 pruebas
pnpm exec playwright show-report     # informe HTML con trazas y capturas de los fallos
```

- `playwright.config.ts` levanta Vite en `127.0.0.1:3000` apuntando al Supabase local y
  **aborta si la URL no es local** (las pruebas crean y borran datos).
- Cada prueba usa emails únicos (`…@e2e.test`): se pueden repetir sin limpiar la base.
- El registro funciona sin correo porque `enable_confirmations = false` en `supabase/config.toml`.
- Límite de Auth local: 30 altas por 5 minutos (`auth.rate_limit.sign_in_sign_ups`); una corrida usa ~10.
- En CI corre como job `e2e` (`.github/workflows/ci.yml`) y sube el informe como artefacto.

## Qué cubren

### Autenticación y onboarding (`e2e/auth.spec.ts`) — 6/6

| Prueba | Resultado |
|---|---|
| Registro: crea la organización "Personal de …", el workspace "Personal" y su proyecto General | ✅ |
| Cerrar sesión y volver a entrar | ✅ |
| Rutas protegidas redirigen a `/login` | ✅ |
| Credenciales incorrectas: error visible, sin acceso | ✅ |
| Registro valida que las contraseñas coincidan | ✅ |
| Email duplicado no da sesión | ✅ |

### Proyecto General por defecto (`e2e/projects-tasks.spec.ts`) — 6/6

| Prueba | Resultado |
|---|---|
| General existe, lleva "Por defecto" y no tiene botón de eliminar | ✅ |
| Tarea nueva cae en General sin elegir proyecto (y no hay "Sin proyecto") | ✅ |
| El filtro de proyecto no ofrece "Sin proyecto" | ✅ |
| Crear proyecto y una tarea dentro de él (contador "1 tarea") | ✅ |
| Borrar el proyecto mueve la tarea a General y sale el aviso "1 tarea se movió a General." | ✅ |
| Filtrar por General lista las tareas movidas | ✅ |

### Organizaciones, invitaciones y roles (`e2e/organization.spec.ts`) — 11/11

| Prueba | Resultado |
|---|---|
| Crear organización: queda como Owner y se selecciona | ✅ |
| Invitar por email y obtener el enlace (portapapeles) | ✅ |
| Invitado abre el enlace sin sesión → login → registro → vuelve al enlace → acepta | ✅ |
| Miembro: sin Invitaciones, sin Zona de peligro, sin Nuevo/Expulsar | ✅ |
| Invitación pasa a "Aceptada"; el owner promueve a Admin; el admin gana Invitaciones | ✅ |
| Admin no puede cambiar el rol del owner ni expulsarlo | ✅ |
| El enlace solo sirve para el email invitado (error "enviada a otro email") | ✅ |
| El último owner no puede salir ("debe tener al menos un owner") | ✅ |
| Tras promover a otro owner, el primero sale y pierde acceso | ✅ (tras corregir el bug de abajo) |
| Nuevo owner crea un workspace con una tarea, lo elimina (el diálogo cuenta "1 tarea") y el último workspace no se puede borrar | ✅ |
| Owner elimina la organización completa y cae en su organización personal | ✅ |

## Hallazgo: bug real en la RLS (corregido)

**Síntoma.** El creador de una organización que la abandonaba (tras transferir el ownership)
seguía viéndola en el selector, con "Sin workspace", y no podía quitársela.

**Causa.** La policy `organizations_select` aún autorizaba por `owner_id = auth.uid()`.
La migración `…01` ya había decidido que `owner_id` es "creador histórico" y no autoriza,
pero esta policy se quedó sin actualizar.

**Corrección.** Migración `20261012000007_organizations_select_members.sql`: la policy solo
acepta miembros actuales. La app crea organizaciones con `create_organization` (SECURITY
DEFINER), así que no depende de la cláusula retirada.

**Cobertura.** Caso nuevo en `scripts/test-rls.mjs` (sección 10a): reproducido el fallo sin
la migración y en verde con ella (120/120).

> ⚠️ Esta migración **no está aplicada en producción**. `scripts/verify-migrations.sql` ya
> la incluye y marcará `false` hasta que se aplique en el SQL Editor.

## Qué NO cubren (deuda conocida)

- Etiquetas, edición y detalle de tareas, búsqueda y orden (cubiertos solo por pruebas manuales).
- Responsive/móvil y tema oscuro.
- Confirmación de email y redirects reales: dependen del SMTP y de las *Redirect URLs* del
  proyecto remoto (ver `doc/guia-supabase-setup.md`); solo se pueden verificar a mano en producción.
- Rendimiento y accesibilidad más allá de los roles ARIA que usan los selectores.
