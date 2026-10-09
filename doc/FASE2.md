FASE 2 — PRODUCTIVITY FEATURES

Continúa sobre la aplicación existente sin romper las funcionalidades actuales.

Implementa:

PROJECTS

Cada usuario puede:
- crear proyectos
- editar proyectos
- eliminar proyectos
- asignar tareas a proyectos

Añade tabla projects y la relación correspondiente con tasks.

TASKS

Amplía las tareas con:

- priority: low | medium | high
- due_date
- project_id
- status cuando sea apropiado

TAGS

Implementa etiquetas reutilizables.

Un task puede tener múltiples tags.

Diseña correctamente la relación many-to-many.

SEARCH & FILTERS

Permite:

- buscar tareas por texto
- filtrar por proyecto
- filtrar por prioridad
- filtrar por estado
- filtrar por fecha
- filtrar por etiquetas

DASHBOARD

Crea un dashboard que muestre:

- tareas pendientes
- tareas completadas
- tareas vencidas
- tareas próximas
- distribución por prioridad
- proyectos activos

No agregues gráficos únicamente por decoración.

RLS

Actualiza todas las políticas necesarias.

Un usuario nunca debe poder acceder a:
- proyectos
- tareas
- tags

de otro usuario.

Utiliza TanStack Query para server state.

Mantén URLs útiles cuando tenga sentido para filtros y navegación.

Crea las migraciones necesarias.

Ejecuta typecheck, lint y build.

Incluye una checklist de pruebas manuales.

Después detente.