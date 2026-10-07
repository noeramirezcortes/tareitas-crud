# Guía paso a paso — Crear proyecto Supabase y conectar Tareitas

> **Objetivo:** obtener `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` y dejar
> la app conectada. Tiempo estimado: 5 minutos.
> **Cuándo:** antes de comenzar la Fase 1.

---

## 1. Crear la cuenta y el proyecto

1. Entra a [supabase.com](https://supabase.com) e inicia sesión (puedes usar GitHub).
2. Click en **"New project"**.
3. Si no tienes organización, te pedirá crear una:
   - **Name:** la que prefieras (ej. `personal` o `tareitas`).
   - Plan: **Free** (suficiente para desarrollo).
4. Rellena el formulario del proyecto:
   - **Name:** `tareitas`
   - **Database Password:** genera una segura y **guárdala en tu gestor de contraseñas**
     (no la necesitarás para el frontend, pero sí para administración/CLI).
   - **Region:** la más cercana a ti (ej. `West EU` o `East US`).
5. Click en **"Create new project"** y espera ~1–2 minutos mientras se aprovisiona
   (verás una barra de progreso "Setting up project").

## 2. Obtener las claves

1. Con el proyecto ya activo, ve a **Project Settings** (icono de engranaje ⚙️ en la barra lateral izquierda, abajo).
2. Entra en la sección **"API Keys"** (o **"API"**).
3. Verás dos valores que necesitas:

   | Valor | Dónde aparece | Ejemplo |
   |-------|---------------|---------|
   | **Project URL** | Arriba de la página de API | `https://abcdefghijklm.supabase.co` |
   | **Publishable key** (o **anon public key**) | Lista de API keys | `sb_publishable_...` (o un JWT largo `eyJ...`) |

   > **Nota:** Supabase renovó sus claves. Los proyectos nuevos muestran una
   > **Publishable key** (`sb_publishable_...`). Si ves la **anon key** clásica
   > (JWT `eyJhbGci...`), también sirve — ambas funcionan con `@supabase/supabase-js`.

4. ⚠️ **NUNCA copies la `service_role` key ni las `sb_secret_...` keys.**
   Esas saltan las políticas RLS y jamás deben estar en el frontend.

## 3. Configurar `.env`

1. Abre el archivo `.env` en la raíz del proyecto (ya existe con placeholders).
2. Reemplaza los valores:

   ```bash
   VITE_SUPABASE_URL=https://TU-PROYECTO.supabase.co
   VITE_SUPABASE_ANON_KEY=sb_publishable_TU_CLAVE
   ```

3. Guarda el archivo. (`.env` está en `.gitignore` — nunca se subirá a GitHub.)

## 4. Verificar la conexión

```bash
pnpm dev
```

1. Abre `http://localhost:5173`.
2. Si la app carga la card de **Tareitas** sin errores rojos en la consola del
   navegador (F12), la configuración es válida (las variables pasaron la
   validación de `src/config/env.ts`).
3. La verificación definitiva será en la **Fase 1**, cuando el primer `api.ts`
   haga una llamada real a Supabase.

## 5. (Opcional, recomendado) Instalar Supabase CLI

Se usará en Fase 1 para crear migraciones y generar tipos TypeScript:

```bash
# Windows (scoop)
scoop bucket add supabase https://github.com/supabase/scoop-bucket.git
scoop install supabase

# Verificar
supabase --version
```

Después, vincular el proyecto (se hará cuando llegue la Fase 1):

```bash
supabase login
supabase link --project-ref TU-PROJECT-REF
```

> El `project-ref` es la parte antes de `.supabase.co` en tu Project URL
> (ej. `abcdefghijklm`).

---

## Checklist final

- [ ] Proyecto `tareitas` activo en supabase.com
- [ ] `.env` con `VITE_SUPABASE_URL` y `VITE_SUPABASE_ANON_KEY` reales
- [ ] `pnpm dev` arranca sin errores de validación
- [ ] Database password guardada en gestor de contraseñas
- [ ] (Opcional) Supabase CLI instalada

**Listo → avisa para arrancar la Fase 1.**
