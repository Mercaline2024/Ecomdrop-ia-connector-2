# Documentación de Progreso - Ecomdrop IA Connector

## 📋 Índice

1. [Configuración](#configuración)
   - [Configuración de Ecomdrop](#configuración-de-ecomdrop)
   - [Configuración de Dropi](#configuración-de-dropi)
2. [Gestión de Productos](#gestión-de-productos)
   - [Página de Productos](#página-de-productos)
   - [Funcionalidades Implementadas](#funcionalidades-implementadas)
3. [APIs y Endpoints](#apis-y-endpoints)
4. [Estructura de Datos](#estructura-de-datos)
5. [Flujos de Trabajo](#flujos-de-trabajo)

---

## 🔧 Configuración

### Configuración de Ecomdrop

**Ubicación:** `/app/configuration` - Pestaña "Ecomdrop"

#### Funcionalidades Implementadas

1. **Conexión a Ecomdrop IA**
   - Campo de entrada para la API Key de Ecomdrop
   - Botón unificado: "Conectar Ecomdrop IA y refrescar flujos"
   - Valida y almacena la API Key en la base de datos
   - Muestra notificaciones de éxito/error

2. **Gestión de Flujos**
   - Carga automática de flujos desde la API de Ecomdrop al configurar la API Key
   - Sistema de caché en memoria (1 minuto) para evitar límites de tasa
   - Selección de flujos para eventos:
     - **Nuevo Pedido** (`nuevoPedidoFlowId`)
     - **Carrito Abandonado** (`carritoAbandonadoFlowId`)
   - Dropdowns nativos HTML para selección de flujos

3. **Características Técnicas**
   - Caché inteligente con expiración automática
   - Sincronización manual de flujos disponible
   - Validación de API Key antes de guardar
   - Mensajes de estado claros en la UI

#### Endpoints Utilizados

- **Ecomdrop API:** `GET https://panel.ecomdrop.app/api/accounts/flows`
- **Headers:** `X-ACCESS-TOKEN: {apiKey}`

#### Datos Almacenados

```typescript
{
  shop: string;                    // ID único de la tienda Shopify
  ecomdropApiKey: string;          // API Key de Ecomdrop
  nuevoPedidoFlowId: string?;      // ID del flujo para nuevos pedidos
  carritoAbandonadoFlowId: string?; // ID del flujo para carritos abandonados
}
```

---

### Configuración de Dropi

**Ubicación:** `/app/configuration` - Pestaña "Dropi"

#### Funcionalidades Implementadas

1. **Formulario de Configuración**
   - **Nombre de Tienda** (`store_name`): Campo de texto requerido
   - **País de Operación** (`country`): Select con opciones:
     - Colombia (CO)
     - Ecuador (EC)
     - Chile (CL)
     - Guatemala (GT)
     - México (MX)
     - Panamá (PA)
     - Perú (PE)
     - Paraguay (PY)
   - **Token de Dropi** (`dropi_token`): Campo password requerido

2. **Gestión de Token Seguro**
   - Cuando el token ya está configurado:
     - Se muestra enmascarado (••••••••••••••••)
     - Botón "Editar Token" para actualizar
     - Botón "Cancelar" disponible durante la edición
   - El token se almacena de forma segura en la base de datos
   - Validación del token con la API de Ecomdrop antes de guardar

3. **Integración con Ecomdrop**
   - Mapeo automático de país a `fieldId` del bot de Ecomdrop:
     - CO → 640597
     - EC → 805359
     - CL → 665134
     - GT → 747995
     - MX → 641097
     - PA → 742965
     - PE → 142979
     - PY → 240677
   - POST automático a Ecomdrop para asignar el token al campo del bot correspondiente

4. **Validaciones**
   - Requiere que la API Key de Ecomdrop esté configurada primero
   - Valida todos los campos antes de enviar
   - Muestra mensajes de estado: "Guardando...", "Asignado correctamente ✅", "Error ❌"

#### Endpoints Utilizados

- **Endpoint de Guardado:** `POST /api/integrations/dropi/save`
- **Ecomdrop API:** `POST https://panel.ecomdrop.app/api/accounts/bot_fields/{fieldId}`
  - Headers:
    - `accept: application/json`
    - `X-ACCESS-TOKEN: {ecomdropApiKey}`
    - `Content-Type: application/x-www-form-urlencoded`
  - Body: `value={dropiToken}` (URL encoded)

#### Datos Almacenados

```typescript
{
  shop: string;
  dropiStoreName: string;    // Nombre de la tienda
  dropiCountry: string;      // Código del país (CO, EC, etc.)
  dropiToken: string;        // Token de integración de Dropi
}
```

---

## 📦 Gestión de Productos

### Página de Productos

**Ubicación:** `/app` (página principal)

#### Vista General

La página de productos permite:
- Visualizar productos de Dropi
- Visualizar productos de Shopify
- Asociar productos entre ambas plataformas
- Buscar y filtrar productos de Dropi

---

### Funcionalidades Implementadas

#### 1. Productos de Dropi

**Búsqueda y Filtros:**

- **Campo de Búsqueda:**
  - Búsqueda por palabras clave (`keywords`)
  - Búsqueda en tiempo real con botón "Buscar"
  - Soporte para presionar Enter para buscar
  - Botón "Limpiar" visible cuando hay texto en búsqueda
  - Al limpiar la búsqueda, vuelve automáticamente a mostrar favoritos

- **Filtros:**
  - **Productos Privados** (🔒): Checkbox visible solo cuando NO hay búsqueda activa
  - **Productos Favoritos**: Por defecto activado (no configurable desde UI)

**Lógica de Filtros:**

- **Por defecto (sin búsqueda):**
  - Si "Productos Privados" está activado: `privated_product: true`
  - Si "Productos Privados" está desactivado: `favorite: true` (por defecto)
  - **NUNCA se envían ambos parámetros juntos**

- **Con búsqueda activa:**
  - Solo se envía `keywords` al API
  - NO se envían `favorite` ni `privated_product`
  - Búsqueda en todos los productos sin filtros

**Visualización de Productos:**

- Tabla moderna con las siguientes columnas:
  - **ID/SKU**: Imagen del producto (si disponible), ID y SKU
  - **NOMBRE**: Nombre del producto y categorías
  - **PRECIO**: Precio de venta y precio sugerido (si disponible)
  - **STOCK**: Stock total (inventario privado o warehouse)
  - **BODEGA**: Nombre de la bodega/almacén
  - **ACCIONES**: Botón de vista (👁️) y checkbox para selección

**Paginación:**

- 10 productos por página por defecto
- Controles de navegación:
  - Botón "← Anterior"
  - Indicador de página actual y total (Página X de Y)
  - Botón "Siguiente →"
- **Indicadores de Carga:**
  - Overlay semitransparente sobre la tabla durante la carga
  - Spinner animado con texto "Cargando productos..."
  - Indicador "Cargando..." en el paginador reemplazando la información de página
  - Botones deshabilitados durante la carga

**Estados de la UI:**

- Muestra "Mostrando X - Y de Z productos" al final de la tabla
- Contador de productos totales encontrados/cargados
- Mensajes informativos cuando no hay productos

#### 2. Productos de Shopify

**Funcionalidades:**

- Carga de hasta 50 productos de Shopify
- Lista visual con información:
  - Título del producto
  - Status (activo/inactivo)
  - Número de variantes
- Selección visual con checkbox
- Indicador de selección cuando un producto está seleccionado

#### 3. Asociación de Productos

**Estado Actual:**
- ✅ UI implementada para selección de productos
- ⚠️ Funcionalidad de asociación en desarrollo
- Botón "Asociar Productos" presente pero muestra mensaje "Funcionalidad de asociación en desarrollo"

---

## 🔌 APIs y Endpoints

### Endpoints Internos

#### 1. Productos de Dropi
- **Ruta:** `GET /api/dropi/products`
- **Parámetros Query:**
  - `pageSize`: Número de productos por página (default: 10)
  - `startData`: Offset para paginación
  - `keywords`: Palabras clave para búsqueda (opcional)
  - `hasSearch`: Flag que indica si hay búsqueda activa
  - `privated_product`: true/false (solo cuando no hay búsqueda)
  - `favorite`: true (solo cuando no hay búsqueda y privated_product está desactivado)

**Respuesta:**
```json
{
  "products": [...],
  "total": 100,
  "pageSize": 10,
  "startData": 0
}
```

#### 2. Guardar Configuración Dropi
- **Ruta:** `POST /api/integrations/dropi/save`
- **Body (FormData):**
  - `store_name`: string (requerido)
  - `country`: string (requerido)
  - `dropi_token`: string (requerido solo para nuevas configuraciones)

**Respuesta:**
```json
{
  "success": true,
  "configuration": {...}
}
```

### APIs Externas

#### 1. Dropi API
- **Endpoint:** `POST https://api.dropi.co/integrations/products/index`
- **Headers:**
  - `Content-Type: application/json`
  - `Origin: https://n8n.ecomdropsolutions.com`
  - `Referer: https://n8n.ecomdropsolutions.com`
  - `dropi-integration-key: {dropiToken}`

**Body (sin búsqueda):**
```json
{
  "pageSize": 10,
  "startData": 0,
  "keywords": "",
  "userVerified": false,
  "order_by": "created_at",
  "order_type": "desc",
  "favorite": true,           // O privated_product: true
  "with_collection": true,
  "get_stock": true,
  "no_count": true
}
```

**Body (con búsqueda):**
```json
{
  "pageSize": 10,
  "startData": 0,
  "keywords": "búsqueda",
  "userVerified": false,
  "order_by": "created_at",
  "order_type": "desc",
  "with_collection": true,
  "get_stock": true,
  "no_count": true
}
// Sin favorite ni privated_product
```

#### 2. Ecomdrop API
- **Flujos:** `GET https://panel.ecomdrop.app/api/accounts/flows`
- **Bot Fields:** `POST https://panel.ecomdrop.app/api/accounts/bot_fields/{fieldId}`

---

## 💾 Estructura de Datos

### Modelo ShopConfiguration (Prisma)

```prisma
model ShopConfiguration {
  id                      String   @id @default(uuid())
  shop                    String   @unique
  ecomdropApiKey          String?
  nuevoPedidoFlowId       String?
  carritoAbandonadoFlowId String?
  dropiStoreName          String?
  dropiCountry            String?
  dropiToken              String?
  createdAt               DateTime @default(now())
  updatedAt               DateTime @updatedAt
}
```

### Cache de Flujos

- **Tipo:** In-memory Map
- **Duración:** 60 segundos (1 minuto)
- **Clave:** API Key de Ecomdrop
- **Valor:** Array de flujos con timestamp

---

## 🔄 Flujos de Trabajo

### Configuración Inicial

1. **Configurar Ecomdrop:**
   - Usuario ingresa API Key
   - Sistema valida y guarda
   - Sistema carga flujos disponibles
   - Usuario selecciona flujos para eventos

2. **Configurar Dropi:**
   - Requiere que Ecomdrop esté configurado primero
   - Usuario ingresa:
     - Nombre de tienda
     - País de operación
     - Token de Dropi
   - Sistema valida token con Ecomdrop
   - Sistema asigna token al campo del bot correspondiente

### Visualización de Productos

1. **Carga Inicial:**
   - Si hay token de Dropi configurado, carga automáticamente productos favoritos
   - Muestra 10 productos por página

2. **Navegación:**
   - Usuario puede cambiar de página
   - Sistema muestra indicador de carga durante la petición
   - Al finalizar, muestra nuevos productos

3. **Búsqueda:**
   - Usuario ingresa palabras clave
   - Sistema busca en todos los productos (sin filtros)
   - Al limpiar búsqueda, vuelve a favoritos

4. **Filtros:**
   - Usuario puede activar/desactivar "Productos Privados"
   - Sistema carga productos según filtro seleccionado
   - Filtros solo disponibles cuando NO hay búsqueda activa

---

## 📝 Notas Técnicas

### Optimizaciones Implementadas

1. **Caché de Flujos:**
   - Evita llamadas repetidas a la API de Ecomdrop
   - Reduce límites de tasa
   - Duración de 1 minuto con invalidación manual disponible

2. **Paginación:**
   - Carga eficiente de productos (10 por página)
   - Reduce carga en servidor y cliente

3. **Estados de Carga:**
   - Feedback visual claro durante operaciones asíncronas
   - Prevención de clicks múltiples en botones

### Consideraciones de Seguridad

1. **Tokens:**
   - Tokens almacenados en base de datos
   - Campo password en formularios
   - Tokens enmascarados en UI cuando están configurados

2. **Validaciones:**
   - Validación de API Key antes de hacer llamadas
   - Validación de campos requeridos
   - Manejo de errores con mensajes claros

---

## 🚀 Próximos Pasos (Pendientes)

- [ ] Implementar funcionalidad completa de asociación de productos
- [ ] Sincronización automática de productos asociados
- [ ] Asignación de campos personalizados del bot de Ecomdrop
- [ ] Ejecución de flujos cuando ocurran eventos en Shopify (nuevos pedidos, carritos abandonados)

---

## 📅 Historial de Cambios

### Funcionalidades Principales Implementadas

1. ✅ Configuración de API Key de Ecomdrop
2. ✅ Selección de flujos para eventos (Nuevo Pedido, Carrito Abandonado)
3. ✅ Configuración de integración Dropi
4. ✅ Visualización de productos de Dropi con paginación
5. ✅ Búsqueda de productos de Dropi
6. ✅ Filtros de productos (Favoritos, Privados)
7. ✅ Visualización de productos de Shopify
8. ✅ UI para asociación de productos
9. ✅ Indicadores de carga en paginación
10. ✅ Gestión segura de tokens

---

**Última actualización:** Diciembre 2024
**Versión del documento:** 1.0

