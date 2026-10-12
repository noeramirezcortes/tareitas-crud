FASE 4 — SaaS BILLING

Implementa monetización mediante Stripe.

Planes iniciales:

FREE
PRO

Diseña el sistema para permitir más planes posteriormente.

FREE debe tener límites configurables.

Ejemplos:
- número de proyectos
- miembros
- determinadas funciones premium

PRO elimina o incrementa esos límites.

Implementa:

- Stripe Checkout
- subscriptions
- Stripe Customer
- Stripe Customer Portal
- upgrade
- cancelación
- estado de suscripción

Crea las tablas necesarias en Supabase para mantener el estado de billing.

IMPORTANTE:

Stripe debe ser la fuente autoritativa para eventos de pago.

Implementa webhooks de manera segura.

Nunca confíes en el frontend para determinar si un usuario tiene plan PRO.

Nunca expongas Stripe Secret Key.

Valida firmas de webhooks.

Haz las operaciones sensibles exclusivamente en entorno servidor seguro.

La UI debe mostrar:

- plan actual
- límites
- consumo
- botón upgrade
- administración de suscripción

No implementes IA todavía.

Documenta todas las variables de entorno.

Incluye instrucciones para probar Stripe en test mode.

Ejecuta todas las validaciones y detente.