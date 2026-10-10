FASE 3 — MULTI-TENANT SaaS

Esta fase introduce arquitectura multi-tenant.

Analiza primero cuidadosamente el modelo de datos existente antes de modificarlo.

Implementa:

ORGANIZATIONS

Los usuarios podrán crear organizaciones.

WORKSPACES

Cada organización podrá contener uno o más workspaces.

MEMBERS

Implementa membresías entre usuarios y organizaciones.

ROLES iniciales:

- owner
- admin
- member

INVITATIONS

Permite invitar usuarios por email.

Diseña el sistema de invitaciones de manera segura.

PROJECTS

Los proyectos podrán pertenecer a un workspace.

TASKS

Las tareas podrán formar parte de proyectos compartidos.

==================================================
AUTORIZACIÓN
==================================================

Rediseña las políticas RLS necesarias para soportar multi-tenancy.

No basta con comprobar user_id.

El acceso deberá considerar:

organization
→ membership
→ role
→ workspace
→ resource

Un usuario jamás debe acceder a recursos de una organización a la que
no pertenece.

==================================================
IMPORTANTE
==================================================

Antes de modificar el esquema:

1. muestra el modelo de datos propuesto;
2. explica cómo evolucionará el esquema actual;
3. identifica posibles migraciones destructivas;
4. intenta conservar los datos existentes.

Después implementa.

Crea tests o procedimientos reproducibles para verificar aislamiento entre
dos organizaciones diferentes.

No implementes todavía pagos.

Ejecuta todas las validaciones del proyecto y detente.