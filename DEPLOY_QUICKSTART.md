# 🚀 Despliegue Rápido - Resumen Ejecutivo

## ⚡ Pasos Rápidos

### 1. Preparar Variables de Entorno

Crea un archivo `.env` en `ecomdrop-ia-connector/` con:

```bash
MYSQL_ROOT_PASSWORD=tu_password_seguro
MYSQL_PASSWORD=tu_password_seguro
SHOPIFY_API_KEY=tu_api_key
SHOPIFY_API_SECRET=tu_api_secret
SHOPIFY_APP_URL=https://connector.ecomdrop.io
```

Ver `ENV_TEMPLATE.md` para todas las variables.

### 2. Crear Red Docker

```bash
docker network create --driver overlay EcomdropNet
```

### 3. Construir Imagen

```bash
cd ecomdrop-ia-connector
docker build -t shopify-app_shopify_app:latest .
```

### 4. Desplegar en Portainer

1. **Portainer** > **Stacks** > **Add stack**
2. **Web editor** > Pega el contenido de `docker-compose.yml`
3. **Environment variables** > Carga tu archivo `.env`
4. **Deploy the stack**

### 5. Verificar

```bash
# Ver servicios
docker service ls

# Ver logs
docker service logs -f shopify-app_shopify_app
```

### 6. Actualizar Shopify Partners

- **App URL**: `https://connector.ecomdrop.io`
- **Redirect URL**: `https://connector.ecomdrop.io/api/auth`

## 📚 Documentación Completa

- **DEPLOY.md** - Guía completa paso a paso
- **CHECKLIST_DEPLOY.md** - Checklist de verificación
- **ENV_TEMPLATE.md** - Plantilla de variables de entorno

## ✅ Verificación Final

1. ✅ `https://connector.ecomdrop.io` responde
2. ✅ Certificado SSL válido
3. ✅ App se puede instalar en Shopify
4. ✅ Logs sin errores críticos

---

**Dominio configurado:** `connector.ecomdrop.io`  
**Puerto interno:** `3000`  
**Base de datos:** MySQL 8.0

