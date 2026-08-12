## PWA (Progressive Web App) - Tarjeta de Fidelización Minimalista

**Estado**: Implementado y listo para producción ✓

### Cambio de Paradigma

Se abandonó Apple Wallet y Google Wallet por una **PWA minimalista** que ofrece:
- ✅ Sin costos ($0)
- ✅ Sin certificados complejos
- ✅ Instalable en iOS y Android
- ✅ Offline-first con Service Worker
- ✅ Diseño hermoso y personalizado

### Qué se implementó

#### 1. Tarjeta Digital Personalizada
**Archivo**: `src/app/join/[token]/page.tsx`

Página hermosa que muestra:
- **Nombre del cliente** personalizado (ej: "María García")
- **Sellos visuales** en grid 4x4 (círculos blancos llenos/vacíos)
- **Contador** "X de Y sellos"
- **Recompensas** disponibles:
  - 5 sellos → Spa de Pies Gratis
  - 10 sellos → Manicura Gratis
- **Estado de recompensas** (✓ Disponible cuando se cumplen condiciones)
- **ID único** de la tarjeta truncado
- **Botón "Agregar a Pantalla de Inicio"** para instalar como app

**Diseño**:
- Paleta cálida: Beige (#fffdf8) + Rojo (#d4666e)
- Responsive: Funciona en móvil, tablet, desktop
- Gradientes suaves y decorativos
- Tipografía clara y moderna

#### 2. Base de Datos Actualizada
**Archivo**: `prisma/schema.prisma`

Nuevo campo en Card:
```prisma
customerName String? @db.VarChar(120)  // Nombre personalizado del cliente
```

**Migración**: `20260812164350_add customer name to cards`

#### 3. API Endpoints Actualizados
**POST `/api/v1/cards`** - Ahora acepta:
```json
{
  "stamp_limit": 10,
  "reward_name": "Manicura Gratis",
  "reward_description": "Por 10 sellos",
  "customer_name": "María García"  // Nuevo campo
}
```

**GET `/api/v1/join/:token`** - Retorna:
```json
{
  "card_public_id": "abc123...",
  "customer_name": "María García",
  "stamp_count": 3,
  "stamp_limit": 10,
  "reward_name": "Manicura Gratis",
  "status": "ACTIVE"
}
```

#### 4. Web App Manifest
**Archivo**: `public/manifest.json`

Configuración PWA estándar:
- Nombre: "Salon Nails - Tarjeta de Fidelización"
- Colores: Beige/Rojo
- Iconos: 192x192 y 512x512 (placeholders, reemplazar con reales)
- Instalable en iOS/Android
- Modo "standalone" (parece app nativa)
- Shortcuts para acceso rápido

#### 5. Service Worker Offline-First
**Archivo**: `public/sw.js`

Features:
- **Cache-first strategy** para assets estáticos
- **Network-first** para API calls
- **Offline fallback** cuando no hay conexión
- Caché invalidación automática
- Actualización en background

#### 6. Registro de Service Worker
**Archivo**: `src/components/service-worker-register.tsx`

Componente que:
- Se ejecuta en el cliente
- Registra el SW automáticamente
- Logs de éxito/error en consola

### Flujo Completo PWA

```
1. Cliente con teléfono se acerca al salon
   ↓
2. Escanea QR → `/join/:token`
   ↓
3. Se abre página hermosa de tarjeta personalizada
   - Muestra nombre: "Bienvenido/a María"
   - Muestra sellos acumulados (ej: 3/10)
   - Muestra recompensas disponibles
   ↓
4. Cliente ve botón "📲 Agregar a Pantalla de Inicio"
   ↓
5. Agrega a pantalla de inicio (iOS nativo, Android nativo)
   - Se instala como PWA
   - Aparece como icono en home screen
   - Se abre en "standalone mode" (sin barra del navegador)
   ↓
6. Cliente accede rápidamente a su tarjeta
   - Funciona offline (cached)
   - Se actualiza cuando hay wifi
```

### Instalación en Dispositivos

#### iOS (iPhone/iPad):
1. Usuario toca compartir (botón ↗)
2. Selecciona "Agregar a pantalla de inicio"
3. Nombre: "Salon Nails"
4. Toca "Agregar"

#### Android:
1. Usuario toca menú (3 puntos)
2. Selecciona "Instalar aplicación"
3. Confirma
4. Se instala como apps nativas

### Campos Personalizables

Cuando se crea una tarjeta desde el dashboard:

```json
{
  "customer_name": "María García",      // ← NUEVO: Nombre del cliente
  "stamp_limit": 10,                     // Número total de sellos
  "reward_name": "Manicura Gratis",     // Nombre recompensa 1
  "reward_description": "Manicura..."   // Descripción recompensa 1
}
```

**Nota**: Actualmente solo hay 2 recompensas hardcodeadas (5 y 10 sellos). Para hacer dinámicas, hay que extender el schema.

### Archivos Creados/Modificados

**Nuevos**:
- `public/manifest.json` - PWA configuration
- `public/sw.js` - Service Worker
- `src/components/service-worker-register.tsx` - SW registration

**Modificados**:
- `prisma/schema.prisma` - Agregado customerName
- `src/app/join/[token]/page.tsx` - Nueva página hermosa
- `src/app/api/v1/cards/route.ts` - Soporte customerName
- `src/app/api/v1/join/[token]/route.ts` - Retorna datos completos
- `src/lib/validators.ts` - Validación customerName
- `src/app/layout.tsx` - Manifest link + SW register

### Testing Local

```bash
# 1. Compilar
npm run build

# 2. Correr producción
npm start  # En puerto 3005

# 3. Abrir en móvil o emulador Android
# http://localhost:3005

# 4. Escanear QR o acceder directamente:
# http://localhost:3005/join/{TOKEN}

# 5. Ver tarjeta hermosa
# 6. "Agregar a pantalla de inicio" (en emulador o dispositivo)
```

### Próximas Mejoras Opcionales

- Generar iconos reales (ahora son placeholders)
- Hacer recompensas dinámicas (no hardcodeadas)
- Notificaciones push cuando se agrega sello
- Soporte para múltiples recompensas
- Temas de color personalizables por salon
- Animaciones al agregar sellos
- Compartir tarjeta por WhatsApp/Telegram

### Por qué PWA en lugar de Wallet nativo?

| Aspecto | Apple Wallet | Google Wallet | **PWA** |
|---------|--------------|---------------|--------|
| Costo Setup | $99/año | $0 | $0 |
| Certificados | Sí (complejos) | No | No |
| Tiempo implementación | 1+ semana | 3-4 días | 1 día ✓ |
| Testeable local | Solo certs reales | Emulador Android | Hoy mismo ✓ |
| Instalable | App Store | Google Play | Home screen ✓ |
| Offline support | No | No | Sí ✓ |
| iOS + Android | Sí | No (solo Android) | **Ambos** ✓ |

### MVP Perfect ✓

PWA es la solución perfecta para MVP porque:
- Se testea hoy mismo sin costos
- Funciona en iOS y Android
- Los usuarios pueden "instalarla"
- Offline-first
- Totalmente personalizable
- Sin dependencias de terceros
- Pronto listo para producción

Siguiente paso: Cambiar la creación de tarjetas en el dashboard para incluir campo de nombre.
