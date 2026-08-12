# Fase 1 - Arquitectura MVP

## Objetivo
MVP de tarjeta de fidelidad para salón de uñas con:
- Alta simplicidad para cliente final.
- Una sola app web para el salón.
- Backend pequeño y seguro.
- Apple Wallet + Google Wallet.
- Sin datos personales del cliente.

## Arquitectura propuesta

Diagrama lógico:

Salon Web App (PWA)
  -> API Backend (REST)
    -> PostgreSQL (source of truth)
    -> Wallet Adapter
      -> Apple Wallet integration
      -> Google Wallet integration

Cliente final:
- Agrega pase a Wallet desde URL de onboarding.
- Muestra pase en visitas futuras para escaneo.

## Decisiones clave

1. Source of truth
- Solo PostgreSQL mantiene estado oficial (stamps, status, tokens, eventos).
- Wallets son canal de presentación/distribución, no base de datos.

2. Identificadores
- ID interno: UUID para relaciones internas.
- public_id: token aleatorio criptográfico (no incremental) para exponer en QR/barcode.

3. Onboarding separado de identificación de tarjeta
- join_token aleatorio de un solo uso y expiración corta.
- card_public_id distinto al token de onboarding.

4. Autenticación del salón sin cuentas de empleados
- Modelo MVP: dispositivo activado + PIN del salón.
- Flujo:
  - Owner genera activation code de corta vida.
  - Dispositivo se activa y recibe sesión persistente httpOnly.
  - Operaciones de stamp requieren sesión activa y rol salon_device.

5. Seguridad de operación de stamp
- Endpoint protegido por sesión de salón.
- Idempotency-Key obligatoria por intento de stamp.
- Transacción SQL atómica con bloqueo de fila para evitar race conditions.
- Validación de reglas: card activa, no superó límite sin redeem, etc.

## Flujos principales

### A) Crear tarjeta + onboarding
1. Salón abre app y pulsa Nueva tarjeta.
2. Backend crea card con IDs seguros y estado ACTIVE.
3. Backend crea join_token (single-use, expira en minutos).
4. Frontend muestra QR de onboarding URL /join/{token}.
5. Cliente escanea y abre landing simple.
6. Landing detecta plataforma (best effort) y muestra:
   - Agregar a Apple Wallet
   - Agregar a Google Wallet
7. Al completar, token se marca consumido.

### B) Agregar stamp
1. Cliente muestra pase Wallet.
2. Salón abre escáner web.
3. Escáner lee barcode del pase (valor: card_public_id firmado o token de referencia seguro).
4. Backend valida sesión salón + tarjeta + reglas + idempotencia.
5. Backend incrementa stamp_count de forma atómica.
6. Backend registra evento STAMP_ADDED.
7. Backend dispara actualización Wallet:
   - Apple: update tag + push APNs para serial afectado.
   - Google: PATCH LoyaltyObject.

## Abstracción Wallet

Contrato sugerido:

- createPassArtifacts(card)
- getAddUrl(card, platform)
- syncCardState(card)
- revoke(card)

Implementaciones:
- AppleWalletProvider
- GoogleWalletProvider

Regla: dominio de negocio no llama APIs externas directo; solo a la interfaz.

## Manejo de errores UX (MVP)

- QR expirado: "Este código ya expiró. Pide al salón un código nuevo."
- Tarjeta inexistente: "No pudimos encontrar esta tarjeta."
- Tarjeta desactivada: "Esta tarjeta no está activa."
- Wallet no compatible: "Tu dispositivo no es compatible con esta tarjeta digital."
- Cámara denegada: "Permite acceso a cámara para escanear la tarjeta."
- Duplicado de request: "La operación ya fue procesada."
- Error wallet provider: "Se guardó tu progreso. La actualización visual puede tardar unos minutos."

## Política de privacidad (MVP)

Datos que sí se guardan:
- identificadores técnicos de tarjeta
- contador de stamps
- estado
- timestamps
- metadata técnica mínima de wallet

Datos que no se guardan:
- nombre
- email
- teléfono
- dirección
- fecha de nacimiento
- datos de pago

## Observabilidad mínima

- logs estructurados JSON
- request_id e idempotency_key en logs
- eventos críticos: card_created, stamp_added, reward_redeemed, wallet_sync_failed
- dashboard simple de errores (por proveedor wallet y endpoint)

## Consideraciones offline

- Priorizar consistencia sobre offline full.
- Si no hay internet en salón: no confirmar stamp de forma definitiva.
- UX: mostrar "Sin conexión, no se pudo registrar el sello".
- Reintento manual con misma idempotency key para evitar duplicado.

## Estrategia de despliegue recomendada (MVP)

Recomendación: Render (web service + managed PostgreSQL) o Railway.

Criterios:
- setup rápido para full-stack Node y Postgres
- secretos simples
- logs accesibles
- costos bajos para piloto
- sin complejidad operativa de nube grande

Comparativo breve:
- Vercel: excelente DX frontend, pero backend con wallet signing + tareas persistentes y DB suele requerir piezas extra.
- Cloudflare: muy bueno en edge, pero integración inicial de wallet signing/certs puede ser más compleja para MVP.
- Fly.io: flexible y potente, curva operativa media.
- AWS/GCP/Azure: máxima escalabilidad, mayor overhead de operación para una sola persona en MVP.

## Dominios

MVP simple:
- app.tudominio.com (frontend + API en mismo proyecto)

Opcional más adelante:
- api.tudominio.com separado si crece tráfico o seguridad perimetral.
