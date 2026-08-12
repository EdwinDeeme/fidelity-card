# Fase 3 - Frontend del salon

Estado: implementado a nivel de UI/flujo, pendiente validacion final en runtime cuando npm vuelva a responder correctamente.

## Incluye

- Dashboard principal del salon en espanol.
- Activacion de dispositivo desde la UI.
- Flujo Nueva tarjeta:
  - formulario de programa inicial
  - creacion de tarjeta
  - link de onboarding
  - QR temporal de onboarding
- Flujo Escanear tarjeta:
  - apertura de camara
  - lectura nativa con BarcodeDetector cuando exista
  - fallback manual por codigo
  - alta de stamp con mensaje claro
- Lista de tarjetas activas con progreso actual.
- Landing publica /join/:token con deteccion best-effort de plataforma y botones Wallet.

## Límite actual

Los endpoints de Apple Wallet y Google Wallet siguen como stubs controlados:
- Apple: Fase 4
- Google: Fase 5

Esto significa que el flujo visual del onboarding existe, pero la emision real al Wallet aun no esta conectada.

## Decisiones UX

- Diseno calido blanco/beige con acentos rojos.
- Textos cortos y operativos para personal no tecnico.
- Sin pasos extra en pantalla principal.
- Mensajes de error directos.

## Proximo paso

- Validar runtime real.
- Implementar Wallet real por proveedor.
- Reemplazar stubs con:
  - pkpass firmado + Web Service API de Apple
  - LoyaltyClass/Object + JWT firmado de Google
