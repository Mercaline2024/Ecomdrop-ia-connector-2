# Documentación: Callback de Ecomdrop para Asignación de Tags

## 📋 Resumen

Este sistema permite que Ecomdrop notifique a nuestra aplicación cuando termine de procesar un pedido, asignando automáticamente tags al pedido en Shopify.

## 🔄 Flujo del Proceso

1. **Webhook de Shopify** recibe un nuevo pedido (`ORDERS_CREATE`)
2. **Nuestra app** dispara el flow de Ecomdrop con los datos del pedido
3. **Ecomdrop** procesa el pedido (puede tomar tiempo)
4. **Ecomdrop** llama al callback cuando termine
5. **Nuestra app** actualiza el pedido con los tags recibidos

## 🔗 Endpoint de Callback

**URL:** `POST /api/ecomdrop/callback`

**Base URL:** `https://tu-app.com/api/ecomdrop/callback`

## 📨 Payload Esperado

Ecomdrop debe enviar un POST request con el siguiente formato:

```json
{
  "orderId": "gid://shopify/Order/123",
  "orderName": "#1001",
  "shop": "tienda.myshopify.com",
  "tag": "procesado",
  "apiKey": "ecomdrop_api_key_here",
  "status": "success"
}
```

### Campos Requeridos

- **`apiKey`** (requerido): La API key de Ecomdrop para validación
- **`orderName`** (requerido): Nombre del pedido en formato "#1014" (este es el formato que Ecomdrop debe enviar)

### Campos Opcionales

- **`shop`**: Si no se proporciona, se busca por API key
- **`tag`**: Tag individual a asignar
- **`tags`**: Array de tags o string separado por comas
- **`status`**: Status del procesamiento (`success`, `error`, `pending`)

## 📝 Formatos de Tags

### Opción 1: Tag Individual
```json
{
  "tag": "procesado"
}
```

### Opción 2: Array de Tags
```json
{
  "tags": ["procesado", "importado"]
}
```

### Opción 3: Tags como String
```json
{
  "tags": "procesado, importado, listo"
}
```

### Opción 4: Mapeo por Status
```json
{
  "status": "success"
}
```

El sistema mapea automáticamente los status a tags:
- `success` → `ecomdrop-processed`
- `completed` → `ecomdrop-completed`
- `pending` → `ecomdrop-pending`
- `error` → `ecomdrop-error`
- `failed` → `ecomdrop-error`

## 🔐 Validación de Seguridad

El endpoint valida:
1. **API Key**: Debe coincidir con una API key registrada en la base de datos
2. **Shop**: Se verifica que la API key pertenezca a la tienda correcta

## 📦 Identificación del Pedido

El endpoint acepta identificadores en diferentes formatos:

### Por Nombre del Pedido (Recomendado - Formato de Ecomdrop)
```json
{
  "orderName": "#1014"
}
```

**IMPORTANTE:** Ecomdrop debe enviar el `orderName` en formato "#1014". El sistema buscará automáticamente el pedido por este nombre.

### Formato GraphQL (Alternativo)
```json
{
  "orderId": "gid://shopify/Order/1234567890"
}
```

Si se proporciona un GraphQL ID válido, se usará directamente.

## ✅ Respuesta del Endpoint

### Éxito (200)
```json
{
  "success": true,
  "message": "Tags added successfully: ecomdrop-processed",
  "orderId": "gid://shopify/Order/1234567890",
  "tags": ["ecomdrop-processed"]
}
```

### Error (400/401/404/500)
```json
{
  "success": false,
  "error": "Error description"
}
```

## 🔧 Configuración en Ecomdrop

### Paso 1: Configurar el Callback URL

En tu flow de Ecomdrop, configura el callback URL:

```
https://tu-app.com/api/ecomdrop/callback
```

### Paso 2: Enviar el Payload Correcto

Cuando el flow termine de procesar, Ecomdrop debe hacer un POST request con:

```javascript
{
  "orderName": orderData.orderName,   // Nombre del pedido (ej: "#1014") - REQUERIDO
  "shop": orderData.shop,              // Tienda (ej: "tienda.myshopify.com")
  "tag": "procesado",                  // Tag a asignar
  "apiKey": orderData.callbackApiKey,  // API key para validación
  "status": "success"                  // Status del procesamiento
}
```

### Paso 3: Variables Disponibles en el Payload

Nuestra app envía estos datos en el payload inicial:

```javascript
{
  orderId: "gid://shopify/Order/123",
  orderName: "#1014",  // Este es el campo que Ecomdrop debe usar
  shop: "tienda.myshopify.com",
  callbackUrl: "https://tu-app.com/api/ecomdrop/callback",
  callbackApiKey: "ecomdrop_api_key",
  // ... otros datos del pedido
}
```

## 🧪 Testing

### Test Manual con cURL

```bash
curl -X POST https://tu-app.com/api/ecomdrop/callback \
  -H "Content-Type: application/json" \
  -d '{
    "orderName": "#1014",
    "shop": "tienda.myshopify.com",
    "tag": "test-tag",
    "apiKey": "tu_ecomdrop_api_key",
    "status": "success"
  }'
```

### Test con Postman

1. Método: `POST`
2. URL: `https://tu-app.com/api/ecomdrop/callback`
3. Headers: `Content-Type: application/json`
4. Body (raw JSON):
```json
{
  "orderName": "#1014",
  "tag": "test-tag",
  "apiKey": "tu_api_key",
  "status": "success"
}
```

## ⚠️ Consideraciones

1. **Timeouts**: El procesamiento en Ecomdrop puede tardar. El callback evita timeouts en el webhook de Shopify.

2. **Múltiples Callbacks**: Si Ecomdrop llama múltiples veces, los tags se agregarán sin duplicados.

3. **Tags Existentes**: El sistema preserva los tags existentes del pedido y solo agrega los nuevos.

4. **Error Handling**: Si falla la asignación de tags, se registra el error pero no se interrumpe el proceso.

## 📊 Logs

El endpoint genera logs detallados:

- `📥 Received Ecomdrop callback`: Cuando se recibe una notificación
- `🔍 Processing callback for shop`: Procesando para una tienda
- `🏷️ Tags to add`: Tags que se van a agregar
- `✅ Successfully updated order`: Tags agregados exitosamente
- `❌ Error`: Cualquier error durante el proceso

## 🔄 Flujo Completo de Ejemplo

```
1. Cliente hace pedido en Shopify
   ↓
2. Shopify envía webhook ORDERS_CREATE
   ↓
3. Nuestra app dispara flow de Ecomdrop
   Payload incluye: callbackUrl, callbackApiKey
   ↓
4. Ecomdrop procesa el pedido (puede tardar minutos)
   ↓
5. Ecomdrop termina y llama al callback
   POST /api/ecomdrop/callback
   {
     "orderId": "...",
     "tag": "procesado",
     "apiKey": "..."
   }
   ↓
6. Nuestra app valida y actualiza el pedido
   ↓
7. Pedido en Shopify ahora tiene el tag "procesado"
```

## 📞 Soporte

Si tienes problemas con el callback:

1. Verifica que la API key sea correcta
2. Verifica que el orderId o orderName sean válidos
3. Revisa los logs del servidor para ver errores específicos
4. Asegúrate de que la app esté instalada en la tienda (para tener sesión activa)

