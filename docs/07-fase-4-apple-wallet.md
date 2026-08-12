## Fase 4: Integración Real de Apple Wallet ✓

**Estado**: Implementado y compilado exitosamente.

### Qué se implementó

#### 1. Generar archivos .pkpass
**Archivo**: `src/lib/wallet/apple-pass.ts`

- Función `generateApplePass()` que crea archivos ZIP firmados (formato .pkpass)
- Genera `pass.json` con estructura Apple Wallet:
  - Campos primarios: contador de sellos
  - Campos auxiliares: nombre de recompensa y estado
  - Código de barras PDF417 para scans
  - Colores personalizados (beige/rojo según diseño del salon)
- Crea `manifest.json` con hashes SHA1 de todos los archivos
- Genera `signature` HMAC-SHA256 (MVP - producción requiere OpenSSL PKCS#7)
- Soporta logo e icono opcionales en `public/apple-wallet/`

#### 2. Provider Apple Wallet actualizado
**Archivo**: `src/lib/wallet/apple-provider.ts`

Implementa interfaz `WalletProvider`:

- **`createCardArtifacts()`**: Genera pass y almacena en BD
- **`getAddToWalletUrl()`**: Retorna URL para descargar pass desde onboarding
- **`updateCard()`**: Regenera pass con datos actualizados y notifica dispositivos
- **`revokeCard()`**: Marca pass como "VOIDED" y notifica dispositivos
- **Mock APNs Client**: Simula notificaciones push para MVP

#### 3. Esquema de Base de Datos actualizado
**Archivo**: `prisma/schema.prisma`

Nuevos modelos:

```prisma
model ApplePass {
  id                String   @id @default(uuid())
  cardPublicId      String   @unique  // FK a Card.publicId
  serialNumber      String   @unique
  passTypeId        String
  pkpassData        Bytes    // Archivo ZIP binario
  stampCount        Int      @default(0)
  status            String   // ACTIVE, VOIDED, REDEEMED
  registrations     AppleRegistration[]
}

model AppleDevice {
  deviceLibraryId   String   @id  // ID del dispositivo Apple
  pushToken         String        // Para APNs
  registrations     AppleRegistration[]
}

model AppleRegistration {
  device            AppleDevice   @relation
  card              Card          @relation
  applePass         ApplePass     @relation
  // Track: qué dispositivo tiene qué pass
}
```

Migración ejecutada: `20260812162630_add apple wallet support`

#### 4. Endpoints Web Service para Apple Wallet
**Rutas**:

a) **GET/POST `/api/v1/apple/webservice/passes/:passTypeIdentifier/:serialNumber`**
   - Implementa Web Service API de Apple
   - POST: Recibe logs de eventos desde Wallet app
   - GET: Retorna pass actualizado si cambió (o 304 Not Modified)
   - Autenticación via header `Authorization`

b) **POST/DELETE `/api/v1/apple/webservice/devices/:deviceLibraryIdentifier/registrations/:passTypeIdentifier/:serialNumber`**
   - POST: Registra dispositivo cuando usuario agrega pass
   - DELETE: Anula registro cuando usuario elimina pass
   - Almacena push token para notificaciones

c) **GET `/api/v1/join/:token/apple/pass`**
   - Endpoint público para descargar .pkpass en onboarding
   - Valida token de onboarding (single-use con expiración)
   - Retorna archivo con `Content-Type: application/vnd.apple.pkpass`

### Arquitectura de flujo

```
Usuario abre onboarding → /api/v1/join/:token → 
  genera qrcode con URL apple pass → 
  usuario clickea "Agregar a Wallet" → 
  descarga .pkpass desde GET /api/v1/join/:token/apple/pass → 
  Wallet app instala pass → 
  Apple llama POST /api/v1/apple/webservice/devices/:id/registrations/:sn → 
  Registramos dispositivo con push token
```

Cuando se actualiza el pass (ej: nuevo sello):
```
POST /api/v1/cards/:publicId/stamps → 
  updateStamp() → 
  AppleWalletProvider.updateCard() → 
  genera nuevo .pkpass → 
  pushUpdateNotification() → 
  envía APNs a dispositivos registrados →
  Wallet app descarga pass actualizado vía GET .../passes/:sn
```

### Dependencias agregadas

- `archiver`: Para crear ZIP de pass files
- `jose`: Para firmas JWT (preparado para Fase 5 Google)
- `apn`: Para APNs (starter - MVP usa mock)

```bash
npm install archiver jose apn
npm install --save-dev @types/archiver
```

### Variables de entorno necesarias (Fase 4)

```env
# Para generar pass
APPLE_PASS_TYPE_ID=pass.com.salonnails.loyalty
APPLE_TEAM_ID=<tu_apple_team_id>
APPLE_CERT_PEM=<certificado_en_pem>
APPLE_KEY_PEM=<clave_privada_en_pem>
APPLE_WALLET_WEB_SERVICE_URL=https://api.tudominio.com/api/v1/apple/webservice
APPLE_WALLET_AUTH_TOKEN=<token_secreto_desde_apple_config>

# Para APNs (opcional en MVP)
APPLE_BUNDLE_ID=com.salonnails.loyalty
APPLE_KEY_ID=<apns_key_id>
APPLE_KEY_CONTENT=<apns_key_content>
```

### Notas importantes

**Para producción:**
- Implementar firma PKCS#7 real con OpenSSL (actualmente stub HMAC)
- Integrar real APNs client en lugar de mock
- Obtener certificados de Apple Developer
- Configurar dominio verificado en Apple Wallet settings
- Validar HTTPS para todos los endpoints

**Para MVP local:**
- Pass descargará pero será inválido sin certificados Apple
- Las notificaciones se loguean en consola
- Web Service endpoints funcionan estructuralmente

### Testing

Para MVP, puedes apuntar el `webServiceURL` en pass.json a localhost:3005 cuando testeen localmente. Los endpoints están listos pero requieren certificados reales de Apple para que la Wallet app los acepte.

### Próximas fases

- **Fase 5**: Google Wallet integration (LoyaltyClass/Object + JWT)
- **Nivel 2**: APNs real, PKCS#7 real, redemption flow
- **Nivel 3**: Webhook updates, analytics, dashboard mejorado

Base sólida establecida ✓
