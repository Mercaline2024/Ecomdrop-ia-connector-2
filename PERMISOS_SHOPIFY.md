# Análisis de Permisos de Shopify App

## 📋 Permisos Actuales Configurados

En `shopify.app.toml`:
```toml
scopes = "read_products,write_products,read_orders,read_themes,write_themes"
```

## 🔍 Acciones Realizadas por la App

### 1. **Productos** ✅

#### Lectura de Productos:
- **Query**: `getProducts` - Lista productos con variantes
- **Query**: `getProduct` - Obtiene un producto específico
- **Query**: `getProductVariants` - Obtiene variantes de un producto
- **Permiso requerido**: `read_products` ✅

#### Escritura de Productos:
- **Mutation**: `productUpdate` - Actualiza nombre y descripción de productos
- **Mutation**: `productAppendMedia` - Agrega imágenes a productos
- **Permiso requerido**: `write_products` ✅

### 2. **Temas** ✅

#### Lectura de Temas:
- **Query**: `getThemes` - Lista temas instalados en la tienda
- **Permiso requerido**: `read_themes` ✅

#### Escritura de Temas:
- **REST API**: `POST /admin/api/themes.json` - Instala Theme 2.5 desde URL
- **Permiso requerido**: `write_themes` ✅

### 3. **Órdenes** ⚠️

#### Lectura de Órdenes:
- **Query**: `GetRecentOrders` - Obtiene órdenes recientes con:
  - Información básica de la orden
  - Items de línea (productos)
  - Dirección de envío
  - **Datos de cliente** (email, firstName, lastName, phone) ⚠️
- **Permiso requerido**: `read_orders` ✅

#### Escritura de Órdenes:
- **Ninguna acción detectada** - No se está escribiendo/modificando órdenes
- **Permiso actual**: `write_orders` ❌ **NO NECESARIO**

### 4. **Datos Protegidos de Clientes** ⚠️

La app está accediendo a datos protegidos de clientes:
- `customer.email`
- `customer.firstName`
- `customer.lastName`
- `customer.phone`

**Estos datos requieren permisos adicionales para "Protected Customer Data"**

## ✅ Recomendaciones

### Permisos Necesarios Actualizados:

```toml
scopes = "read_products,write_products,read_orders,read_themes,write_themes"
```

**Eliminar**: `write_orders` (no se está usando)

**Agregados**:
- `read_themes` - Para leer temas existentes y mostrar preview
- `write_themes` - Para instalar Theme 2.5 premium

**Considerar agregar** (si se necesita acceso a datos protegidos de clientes):
- Para desarrollo: Los permisos de datos protegidos requieren aprobación especial de Shopify
- Si solo se necesita para órdenes, `read_orders` puede ser suficiente dependiendo de la versión de API

### Nota sobre Datos Protegidos de Clientes:

Si necesitas acceder a `customer.email`, `customer.phone`, etc. en las órdenes, Shopify puede requerir:
1. Solicitud de permisos adicionales en el Partner Dashboard
2. Aprobación de Shopify para acceder a datos protegidos
3. O usar campos alternativos que no requieren permisos especiales

## 🔧 Acciones Recomendadas

1. **Actualizar `shopify.app.toml`** ✅:
   - Eliminar `write_orders` si no se necesita
   - Mantener `read_products,write_products,read_orders`
   - Agregar `read_themes,write_themes` para Theme 2.5

2. **Validar acceso a datos de clientes**:
   - Probar si la query de órdenes funciona con los permisos actuales
   - Si falla, considerar usar solo `displayFinancialStatus` y `displayFulfillmentStatus`
   - O solicitar permisos adicionales si es necesario

3. **Revisar en Partner Dashboard**:
   - Verificar qué permisos están realmente activos
   - Revisar si hay restricciones en datos protegidos

## 📝 Checklist de Validación

- [x] `read_products` - ✅ Necesario y usado
- [x] `write_products` - ✅ Necesario y usado
- [x] `read_orders` - ✅ Necesario y usado
- [x] `read_themes` - ✅ Necesario para leer temas y mostrar preview
- [x] `write_themes` - ✅ Necesario para instalar Theme 2.5
- [ ] `write_orders` - ❌ No se usa, puede eliminarse
- [ ] Datos protegidos de clientes - ⚠️ Requiere validación

