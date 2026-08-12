# Fase 0 - Investigación técnica oficial (Apple Wallet + Google Wallet)

Fecha: 2026-08-12
Alcance: validar requisitos oficiales para un MVP de tarjeta de fidelidad sin registro de cliente.

## 1) Hallazgos clave confirmados

### Apple Wallet
- Un pase Wallet se distribuye como archivo .pkpass firmado.
- El pase requiere passTypeIdentifier, serialNumber, teamIdentifier, organizationName, description, formatVersion y contenido visual/campos.
- El pase puede incluir barcodes (preferible usar barcodes array; QR/Aztec/PDF417).
- Para actualizaciones en segundo plano, Apple usa un Web Service API específico de Wallet.
- El flujo de actualización no es push de contenido completo: APNs solo notifica cambio y el dispositivo consulta el backend para descargar nueva versión del pase.
- El backend debe exponer endpoints de registro/desregistro de dispositivo, consulta de seriales actualizados y entrega del pase actualizado.
- Se usa authenticationToken del pase y deviceLibraryIdentifier/pushToken para seguridad del canal Wallet-backend.
- HTTPS es obligatorio para comunicación Wallet <-> backend (en producción).
- El mismo ecosistema de certificados se usa para firmar pases y enviar push updates.

Implicación para MVP:
- Apple sí exige estado servidor adicional de registros de dispositivos para updates automáticos.
- No se puede tratar Apple Wallet como solo “archivo estático” si queremos sincronización de stamps.

### Google Wallet (Loyalty)
- Modelo oficial: LoyaltyClass (plantilla) + LoyaltyObject (instancia por cliente/tarjeta).
- Se emite con botón/link Add to Google Wallet usando JWT firmado en backend.
- JWT para web/email/SMS debe firmarse con service account key de Google Cloud autorizada en Wallet Business Console.
- IDs siguen formato issuerId.identifier (alfanumérico + . _ -).
- Actualizaciones de estado de tarjeta se hacen vía REST sobre LoyaltyObject (PATCH/UPDATE).
- Las actualizaciones pueden activar notificaciones según notifyPreference en cada update.

Implicación para MVP:
- Google no usa un Web Service equivalente al de Apple para polling de seriales.
- La actualización se modela como cambios al LoyaltyObject desde backend.

## 2) Diferencias críticas (no asumir simetría)

1. Canal de actualización
- Apple: APNs + Web Service API de Wallet + descarga de nuevo pkpass.
- Google: PATCH/UPDATE del LoyaltyObject.

2. Estado auxiliar requerido
- Apple: requiere tablas para dispositivos y registros de pase-dispositivo.
- Google: no requiere ese mismo modelo para updates básicos.

3. Emisión
- Apple: distribución de archivo pkpass firmado.
- Google: URL con JWT firmado hacia Add to Google Wallet.

## 3) Limitaciones/prudencia para MVP

- NFC en ambos ecosistemas existe, pero para MVP la opción más confiable y simple es identificación por QR/barcode visible en el pase.
- No depender de lectura NFC desde web scanner en MVP (alta variabilidad de hardware/permisos).
- El identificador mostrado en barcode no debe permitir manipular stamps por sí mismo sin autorización del salón.

## 4) Requisitos de cuentas/certificados (checklist inicial)

### Apple Developer
- Membresía Apple Developer activa.
- Pass Type ID creado.
- Certificado de firma para Wallet pass asociado al Pass Type ID.
- Claves privadas y cadena de certificados gestionadas de forma segura.
- Configuración de APNs para actualizaciones de pass.

### Google Cloud + Wallet
- Proyecto GCP.
- API de Google Wallet habilitada.
- Issuer account en Google Wallet Business Console.
- Service account en GCP autorizada en Wallet Business Console.
- Gestión segura de JSON key (solo backend, nunca frontend).

## 5) Riesgos técnicos tempranos

- Apple Web Service API incompleto o mal implementado implica pases que no se actualizan automáticamente.
- Rotación/expiración de certificados puede impedir firmar nuevos pases o enviar updates.
- Si se diseña mal el barcode (ej: ID incremental), aumenta riesgo de abuso.
- Si no hay idempotencia y control transaccional, habrá stamps duplicados en mala conectividad.

## 6) Decisión para pasar a Fase 1

Continuar con arquitectura backend-first, source of truth en PostgreSQL, e integración Wallet mediante abstracción de proveedor:
- AppleWalletProvider
- GoogleWalletProvider

Sin CRM, sin cuentas de cliente, sin cuentas de empleados en MVP.
