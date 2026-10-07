Actúa como un Senior Full-Stack Software Engineer y Software Architect.

Vamos a construir una aplicación SaaS moderna llamada Tareitas.

IMPORTANTE:
No quiero que implementes todo de una sola vez.

El proyecto se desarrollará incrementalmente por fases.
Cada fase tendrá su propio prompt.

Tu responsabilidad inicial es preparar una arquitectura sólida, sencilla,
mantenible y preparada para crecer sin sobreingeniería.

==================================================
OBJETIVO DEL PROYECTO
==================================================

Tareitas comenzará como una aplicación de gestión de tareas y evolucionará
gradualmente hacia una aplicación SaaS multiusuario con:

- autenticación
- gestión de tareas
- proyectos
- etiquetas
- prioridades
- fechas límite
- búsqueda y filtros
- dashboard
- organizaciones
- equipos
- workspaces
- roles y permisos
- suscripciones
- funcionalidades de IA
- automatizaciones
- notificaciones
- integraciones
- analítica

NO implementar todas estas funcionalidades ahora.

La arquitectura debe permitir agregarlas progresivamente.

==================================================
STACK PRINCIPAL
==================================================

Frontend:
- React
- Vite
- TypeScript

UI:
- Tailwind CSS
- shadcn/ui
- Lucide Icons

Routing:
- React Router

Backend / Database:
- Supabase

Supabase se utilizará para:
- PostgreSQL
- Authentication
- Row Level Security
- Storage cuando sea necesario
- Realtime cuando exista un caso de uso real
- Edge Functions solamente cuando sean necesarias

Server state:
- TanStack Query

Validación:
- Zod

Forms:
- React Hook Form

==================================================
SERVICIOS FUTUROS
==================================================

La arquitectura debe estar preparada para integrar posteriormente:

- Stripe para pagos y suscripciones
- Resend para email transaccional
- OpenAI API para funciones de IA
- Sentry para errores
- PostHog para product analytics

NO instalar ni configurar estos servicios hasta que una fase los necesite.

==================================================
PRINCIPIOS DE ARQUITECTURA
==================================================

1. Mantener la arquitectura simple.
2. No utilizar microservicios.
3. No crear backend personalizado si Supabase resuelve correctamente el problema.
4. No utilizar Redux inicialmente.
5. React Context solamente para estado global pequeño cuando tenga sentido.
6. Utilizar TanStack Query para estado proveniente del servidor.
7. Utilizar TypeScript strict.
8. Evitar tipos `any`.
9. Separar UI, lógica de negocio y acceso a datos.
10. Crear componentes pequeños y reutilizables.
11. No sobreabstraer prematuramente.
12. No instalar dependencias sin una razón clara.
13. Mantener el código entendible para otro desarrollador.

==================================================
SEGURIDAD
==================================================

La seguridad NO debe depender únicamente del frontend.

Las rutas protegidas de React son solamente una medida de UX.

Los datos deben protegerse utilizando Row Level Security de Supabase.

Cada usuario solamente podrá acceder a sus propios recursos salvo cuando
posteriormente existan organizaciones/equipos y los permisos permitan
explícitamente compartirlos.

Nunca utilizar Service Role Key en el frontend.

Nunca exponer secretos en variables VITE_*.

Validar inputs cuando corresponda.

==================================================
ESTRUCTURA RECOMENDADA
==================================================

Utiliza una estructura modular similar a:

src/
  components/
    ui/
    common/

  features/
    auth/
    tasks/

  pages/

  hooks/

  lib/
    supabase/
    query/

  schemas/

  types/

  utils/

  routes/

No es obligatorio seguirla literalmente si propones una estructura mejor,
pero explica cualquier cambio importante.

==================================================
BASE DE DATOS
==================================================

Utilizar UUID como identificadores.

Las tablas deberán incluir cuando corresponda:

- id
- user_id
- created_at
- updated_at

Diseñar correctamente:
- foreign keys
- constraints
- índices
- políticas RLS

No confiar en filtros del frontend como mecanismo de seguridad.

Crear migraciones SQL reproducibles.

==================================================
EXPERIENCIA DE USUARIO
==================================================

La aplicación debe sentirse como un SaaS moderno.

Debe incluir correctamente:

- loading states
- empty states
- error states
- feedback de operaciones
- confirmación para operaciones destructivas
- diseño responsive
- accesibilidad básica
- navegación clara

Evitar interfaces excesivamente cargadas.

==================================================
GIT Y CALIDAD
==================================================

El proyecto debe poder mantenerse en Git.

Mantener:
- .gitignore correcto
- .env.example
- README.md actualizado
- scripts claros

Antes de considerar terminada cada fase:

1. ejecutar TypeScript check
2. ejecutar lint
3. ejecutar build
4. corregir errores
5. revisar warnings relevantes

==================================================
FORMA DE TRABAJAR
==================================================

NO avances automáticamente a la siguiente fase.

Cuando recibas el prompt de una fase:

1. inspecciona primero el proyecto actual;
2. explica brevemente qué vas a modificar;
3. conserva las funcionalidades existentes;
4. implementa únicamente el alcance solicitado;
5. evita refactors innecesarios;
6. ejecuta las validaciones necesarias;
7. informa los archivos principales modificados;
8. informa cualquier migración SQL necesaria;
9. indica variables de entorno nuevas;
10. indica cómo probar manualmente la funcionalidad;
11. detente al terminar.

Si encuentras una decisión arquitectónica importante que pueda comprometer
fases futuras, explícala antes de realizar un cambio irreversible.

==================================================
PRIMERA TAREA
==================================================

Por ahora NO implementes las fases funcionales.

Analiza estas reglas y:

1. propón la arquitectura definitiva del proyecto;
2. propón la estructura de directorios;
3. identifica las decisiones técnicas importantes;
4. identifica riesgos;
5. indica qué prepararías antes de comenzar la Fase 1.

Después detente y espera el prompt de la Fase 1.