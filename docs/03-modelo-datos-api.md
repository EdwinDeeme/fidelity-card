# Modelo de datos y API MVP

## 1) Modelo PostgreSQL mínimo viable

## Tabla cards

Columnas:
- id UUID PK
- public_id VARCHAR(64) UNIQUE NOT NULL
- wallet_state JSONB NOT NULL DEFAULT '{}'
- stamp_count SMALLINT NOT NULL DEFAULT 0
- stamp_limit SMALLINT NOT NULL
- reward_name VARCHAR(80) NOT NULL
- reward_description VARCHAR(160) NULL
- status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints:
- CHECK stamp_count >= 0
- CHECK stamp_limit > 0
- CHECK status IN ('ACTIVE','REWARDED','REDEEMED','DISABLED')

Índices:
- UNIQUE(public_id)
- INDEX(status)
- INDEX(updated_at)

Notas:
- wallet_state guarda referencias técnicas mínimas por proveedor (ej: apple serial, google object id).

## Tabla onboarding_tokens

Columnas:
- id UUID PK
- token_hash CHAR(64) UNIQUE NOT NULL
- card_id UUID NOT NULL REFERENCES cards(id)
- expires_at TIMESTAMPTZ NOT NULL
- consumed_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints:
- CHECK expires_at > created_at

Índices:
- UNIQUE(token_hash)
- INDEX(card_id)
- INDEX(expires_at)
- INDEX(consumed_at)

Notas:
- Nunca almacenar token plano, solo hash SHA-256.
- Token single-use: consumido cuando se finaliza add-to-wallet.

## Tabla card_events (auditoría mínima)

Columnas:
- id BIGSERIAL PK
- card_id UUID NOT NULL REFERENCES cards(id)
- event_type VARCHAR(32) NOT NULL
- idempotency_key VARCHAR(80) NULL
- actor_type VARCHAR(24) NOT NULL
- actor_ref VARCHAR(80) NULL
- metadata JSONB NOT NULL DEFAULT '{}'
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints:
- CHECK event_type IN ('CARD_CREATED','STAMP_ADDED','STAMP_REMOVED','REWARD_REDEEMED','CARD_DISABLED','ONBOARDING_STARTED','ONBOARDING_COMPLETED')

Índices:
- INDEX(card_id, created_at DESC)
- UNIQUE(card_id, idempotency_key) WHERE idempotency_key IS NOT NULL

Notas:
- Esta tabla resuelve trazabilidad sin guardar PII.
- También resuelve idempotencia por tarjeta en operaciones de stamp.

## Tablas Apple update channel (requeridas para updates automáticos)

### apple_devices
- device_library_id VARCHAR(128) PK
- push_token VARCHAR(255) NOT NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- updated_at TIMESTAMPTZ NOT NULL DEFAULT now()

### apple_registrations
- id BIGSERIAL PK
- device_library_id VARCHAR(128) NOT NULL REFERENCES apple_devices(device_library_id) ON DELETE CASCADE
- card_id UUID NOT NULL REFERENCES cards(id) ON DELETE CASCADE
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()
- UNIQUE(device_library_id, card_id)

### cards update_tag
- Agregar columna update_tag BIGINT NOT NULL DEFAULT 0
- Incrementar en cada cambio de estado relevante para Wallet.

## Tabla salon_devices (auth MVP sin empleados)

Columnas:
- id UUID PK
- device_name VARCHAR(80) NOT NULL
- device_secret_hash CHAR(64) NOT NULL
- status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE'
- last_seen_at TIMESTAMPTZ NULL
- created_at TIMESTAMPTZ NOT NULL DEFAULT now()

Constraints:
- CHECK status IN ('ACTIVE','REVOKED')

Índices:
- INDEX(status)

Notas:
- Sesión web se emite tras activación + PIN del salón.

## 2) Estrategia de IDs

- Interno relacional: UUID v4.
- Externo: token aleatorio de al menos 128 bits de entropía codificado base32/base64url.
- Nunca exponer IDs secuenciales.
- Nunca exponer claves internas de proveedores.

## 3) Estrategia de migraciones

- Herramienta sugerida: Prisma Migrate.
- Convención: migraciones pequeñas por cambio de dominio.
- Nunca editar migración ya aplicada en entornos compartidos.
- Pipeline:
  1) migration en local
  2) test integración
  3) apply en staging
  4) apply en producción

## 4) API mínima propuesta

Base path: /api/v1

Autenticación:
- Endpoints del salón: sesión device-bound (cookie httpOnly secure + rotation).
- Endpoints públicos de onboarding: token URL de un solo uso.
- Endpoints Wallet Apple Web Service: auth token de pass + reglas de Apple.

### 4.1 Salón

POST /salon/devices/activate
- Auth: activation code + PIN inicial
- Request: { activation_code, pin, device_name }
- Response: { device_id, status }
- Errores: 400 invalid code, 401 invalid pin, 429 too many attempts

POST /cards
- Auth: sesión salón
- Request: { stamp_limit, reward_name, reward_description? }
- Response: { card_public_id, join_url, join_qr_svg }
- Validación: stamp_limit 1..20, textos saneados
- Rate limit: 30/min por dispositivo

GET /cards/:publicId
- Auth: sesión salón
- Response: estado resumido de tarjeta

POST /cards/:publicId/stamps
- Auth: sesión salón
- Headers: Idempotency-Key obligatorio
- Request: { action: 'ADD' }
- Response: { stamp_count, stamp_limit, status }
- Validación:
  - tarjeta existe y ACTIVE
  - no excede límite según regla de negocio
  - idempotency key no repetida para mismo card
- Rate limit: 60/min por dispositivo

POST /cards/:publicId/redeem
- Auth: sesión salón
- Headers: Idempotency-Key obligatorio
- Request: { note? }
- Response: { status: 'REDEEMED' }

### 4.2 Onboarding público

GET /join/:token
- Auth: ninguna
- Resultado:
  - token válido: landing con botones Wallet
  - inválido/expirado/consumido: mensaje claro

POST /join/:token/apple
- Auth: ninguna
- Acción: genera o retorna pass pkpass para esa tarjeta
- Response: archivo pkpass

POST /join/:token/google
- Auth: ninguna
- Acción: genera URL Add to Google Wallet con JWT firmado
- Response: { add_to_google_wallet_url }

Reglas:
- token con expiración corta (ej: 10 minutos)
- invalidar token al completar primera emisión

### 4.3 Apple Wallet Web Service (específico)

Implementar endpoints oficiales esperados por Wallet para:
- registrar dispositivo para actualizaciones
- desregistrar
- listar seriales actualizados desde update tag
- descargar pass actualizado
- logging opcional

Notas:
- estos endpoints tienen autenticación y formato definidos por Apple
- deben vivir bajo HTTPS

### 4.4 Health

GET /health
- público o protegido por IP según entorno

## 5) Idempotencia

- Cliente salón debe enviar Idempotency-Key UUID por operación de stamp/redeem.
- Persistir key en card_events.
- Si llega repetida, devolver mismo resultado lógico sin duplicar side effects.

## 6) Concurrencia

Patrón recomendado para ADD stamp:

1. BEGIN
2. SELECT card FOR UPDATE
3. Validar reglas
4. UPDATE cards SET stamp_count = stamp_count + 1, ...
5. INSERT event con idempotency_key
6. COMMIT
7. Disparar sync wallet (retry controlado)

Alternativa avanzada:
- usar un único UPDATE condicional + verificación de filas afectadas.

## 7) Seguridad mínima

- HTTPS obligatorio.
- Validación de input con Zod.
- SQL injection mitigado por ORM/query builder parametrizado.
- Rate limits por IP + device.
- CORS estricto al dominio del panel.
- CSRF para endpoints con cookie de sesión.
- Secrets solo en backend.
- Logs sin secretos ni tokens completos.

## 8) Estrategia de pruebas

Unit:
- generación de IDs/tokens
- reglas de stamp limit
- consumo de onboarding token
- idempotencia

Integración:
- transacciones de stamp en PostgreSQL
- endpoints salón
- expiración y consumo de token
- wallet adapters mockeados

E2E MVP:
- crear tarjeta -> obtener QR join
- resolver join token
- emitir pass Apple/Google (modo sandbox)
- escanear barcode y agregar stamp
- verificar persistencia + evento + invocación de sync provider

Manual obligatorio:
- pruebas en dispositivo iOS real para actualización de Apple pass
- pruebas en Android real para Add to Google Wallet y actualización de LoyaltyObject
