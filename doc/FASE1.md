FASE 1 — AUTHENTICATION + TASK CRUD

Continúa sobre el proyecto existente.

NO recrees el proyecto.

Objetivo:
convertir Tareitas en una aplicación multiusuario funcional.

Implementa autenticación utilizando Supabase Auth.

Debe incluir:

- registro
- login
- logout
- persistencia de sesión
- recuperación correcta de sesión al recargar
- rutas públicas
- rutas protegidas

Crea:

/login
/register
/dashboard
/tasks

Una persona no autenticada que intente acceder a una ruta protegida debe ser
redirigida al login.

==================================================
TASKS
==================================================

Diseña una tabla PostgreSQL llamada tasks.

Campos iniciales:

id UUID primary key
user_id UUID not null
title text not null
description text
completed boolean default false
created_at timestamptz
updated_at timestamptz

Relaciona user_id con auth.users.

Implementa CRUD completo:

- crear tarea
- listar tareas
- consultar tarea
- editar tarea
- marcar como completada
- eliminar tarea

Utiliza:

- TanStack Query para server state
- React Hook Form para formularios
- Zod para validación

NO almacenes la lista principal de tareas en React Context.

==================================================
SEGURIDAD
==================================================

Habilita Row Level Security en tasks.

Crea políticas para que:

- SELECT: un usuario solamente vea sus tareas
- INSERT: solamente pueda crear tareas para sí mismo
- UPDATE: solamente pueda modificar sus tareas
- DELETE: solamente pueda eliminar sus tareas

La seguridad debe funcionar incluso si alguien intenta consultar Supabase
fuera de la interfaz React.

==================================================
UX
==================================================

Implementa:

- loading states
- empty state
- error handling
- feedback después de crear/editar/eliminar
- confirmación antes de eliminar
- diseño responsive

No implementes todavía proyectos, equipos, pagos o IA.

Genera la migración SQL correspondiente.

Ejecuta typecheck, lint y build.

Explica cómo puedo probar manualmente que el RLS realmente impide que
Usuario A consulte las tareas de Usuario B.

Después detente.