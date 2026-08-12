# Fase 2 - Backend inicial implementado

Estado: base funcional de dominio y API (sin integrar aún Apple/Google reales).

## Implementado

- Proyecto Next.js TypeScript (single app full-stack).
- Prisma schema con tablas núcleo:
  - Card
  - OnboardingToken
  - CardEvent
  - SalonDevice
  - AppleDevice
  - AppleRegistration
- Configuración Prisma moderna con prisma.config.ts.
- Utilidades de seguridad:
  - IDs/token aleatorios criptográficos
  - hash SHA-256
  - sesión firmada para dispositivo del salón
- Endpoints MVP:
  - POST /api/v1/salon/devices/activate
  - POST /api/v1/cards
  - GET /api/v1/join/:token
  - POST /api/v1/cards/:publicId/stamps
  - GET /api/v1/health
- Idempotencia en stamps por header Idempotency-Key + evento persistido.
- Concurrencia: transacción serializable para operación de stamp.
- Abstracción wallet definida:
  - WalletProvider
  - AppleWalletProvider (stub)
  - GoogleWalletProvider (stub)
- Pruebas unitarias iniciales:
  - crypto helpers
  - session helpers

## Pendiente de esta fase

- Ejecutar npm install correctamente (la terminal actual interrumpe comandos con salida 130).
- Generar Prisma Client.
- Crear primera migración y aplicarla a PostgreSQL.
- Correr tests y lint.

## Comandos a ejecutar cuando la terminal esté estable

npm install
npm run prisma:generate
npm run prisma:migrate -- --name init
npm run test
npm run lint
npm run dev

## Nota importante

El endpoint de stamps ya protege contra duplicados por idempotencia y contra errores de concurrencia, pero aún falta conectar el disparo de sincronización real hacia Apple/Google (Fase 4 y Fase 5).
