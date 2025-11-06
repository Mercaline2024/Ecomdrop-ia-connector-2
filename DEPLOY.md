# 🚀 Guía de Despliegue - Ecomdrop IA Connector

Esta guía te ayudará a desplegar la aplicación Shopify en producción usando Docker, Portainer y Traefik.

## 📋 Prerrequisitos

- ✅ VPS con Docker y Docker Swarm habilitado
- ✅ Portainer instalado y configurado
- ✅ Traefik configurado con:
  - Entrypoint `websecure` en puerto 443
  - CertResolver `letsencryptresolver` para SSL
  - Red `EcomdropNet` creada
- ✅ Dominio `connector.ecomdrop.io` apuntando al VPS

## 🔧 Paso 1: Preparar el Entorno

### 1.1 Crear la Red Docker (si no existe)

```bash
docker network create --driver overlay EcomdropNet
```

### 1.2 Configurar Variables de Entorno

1. Copia el archivo `.env.example` a `.env`:
   ```bash
   cp .env.example .env
   ```

2. Edita `.env` con tus valores reales:
   ```bash
   nano .env
   ```

   **Variables obligatorias:**
   - `MYSQL_ROOT_PASSWORD`: Contraseña segura para el usuario root de MySQL
   - `MYSQL_PASSWORD`: Contraseña para el usuario `shopify_user`
   - `SHOPIFY_API_KEY`: Tu API Key de Shopify Partners
   - `SHOPIFY_API_SECRET`: Tu API Secret de Shopify Partners
   - `SHOPIFY_APP_URL`: `https://connector.ecomdrop.io`

## 🏗️ Paso 2: Construir la Imagen Docker

### Opción A: Desde Portainer (Recomendado)

1. Ve a **Portainer** > **Images** > **Build a new image**
2. Configura:
   - **Name**: `shopify-app_shopify_app:latest`
   - **Build method**: **Upload** o **Repository**
   - Si usas Repository:
     - **Repository URL**: Tu repositorio Git
     - **Dockerfile path**: `ecomdrop-ia-connector/Dockerfile`
   - Si usas Upload:
     - Sube el contenido de `ecomdrop-ia-connector/`
3. Haz clic en **Build the image**

### Opción B: Desde Terminal

```bash
cd ecomdrop-ia-connector
docker build -t shopify-app_shopify_app:latest .
```

## 📦 Paso 3: Desplegar el Stack

### Opción A: Desde Portainer (Recomendado)

1. Ve a **Portainer** > **Stacks** > **Add stack**
2. Selecciona **Web editor**
3. Copia y pega el contenido de `docker-compose.yml`
4. En **Environment variables**, carga tu archivo `.env` o configura manualmente:
   - Haz clic en **Environment variables**
   - Carga el archivo `.env` o agrega cada variable manualmente
5. Haz clic en **Deploy the stack**

### Opción B: Desde Terminal

```bash
# Asegúrate de estar en el directorio correcto
cd ecomdrop-ia-connector

# Despliega el stack
docker stack deploy -c docker-compose.yml shopify-app
```

## ✅ Paso 4: Verificar el Despliegue

### 4.1 Verificar Servicios

```bash
# Ver estado de servicios
docker service ls

# Deberías ver:
# - shopify-app_mysql
# - shopify-app_shopify_app
```

### 4.2 Ver Logs

```bash
# Logs de la aplicación
docker service logs -f shopify-app_shopify_app

# Logs de MySQL
docker service logs -f shopify-app_mysql
```

### 4.3 Verificar Salud

```bash
# Verificar que MySQL esté saludable
docker service ps shopify-app_mysql

# Verificar que la app esté corriendo
docker service ps shopify-app_shopify_app
```

### 4.4 Probar la Aplicación

1. Abre tu navegador en: `https://connector.ecomdrop.io`
2. Deberías ver la página de inicio de la aplicación Shopify
3. Verifica que el certificado SSL esté funcionando (candado verde)

## 🔄 Paso 5: Actualizar la Configuración en Shopify Partners

1. Ve a [Shopify Partners](https://partners.shopify.com/)
2. Selecciona tu app
3. Ve a **App setup** > **App URL**
4. Actualiza:
   - **App URL**: `https://connector.ecomdrop.io`
   - **Allowed redirection URL(s)**: `https://connector.ecomdrop.io/api/auth`
5. Guarda los cambios

## 🛠️ Mantenimiento

### Actualizar la Aplicación

```bash
# 1. Construir nueva imagen
cd ecomdrop-ia-connector
docker build -t shopify-app_shopify_app:latest .

# 2. Actualizar el servicio
docker service update --image shopify-app_shopify_app:latest shopify-app_shopify_app
```

### Ver Logs en Tiempo Real

```bash
# Logs de la aplicación
docker service logs -f shopify-app_shopify_app

# Últimas 100 líneas
docker service logs --tail 100 shopify-app_shopify_app
```

### Reiniciar Servicios

```bash
# Reiniciar aplicación
docker service update --force shopify-app_shopify_app

# Reiniciar MySQL (¡cuidado! puede causar pérdida de datos si no hay backups)
docker service update --force shopify-app_mysql
```

### Backup de Base de Datos

```bash
# Crear backup
docker exec $(docker ps -q -f name=shopify-app_mysql) \
  mysqldump -u shopify_user -p${MYSQL_PASSWORD} shopify_app > backup_$(date +%Y%m%d_%H%M%S).sql

# Restaurar backup
docker exec -i $(docker ps -q -f name=shopify-app_mysql) \
  mysql -u shopify_user -p${MYSQL_PASSWORD} shopify_app < backup.sql
```

## 🐛 Troubleshooting

### La aplicación no inicia

1. **Verificar logs:**
   ```bash
   docker service logs shopify-app_shopify_app
   ```

2. **Verificar variables de entorno:**
   ```bash
   docker service inspect shopify-app_shopify_app --pretty
   ```

3. **Verificar conexión a MySQL:**
   ```bash
   docker service logs shopify-app_mysql
   ```

### Error de conexión a MySQL

1. **Verificar que MySQL esté corriendo:**
   ```bash
   docker service ps shopify-app_mysql
   ```

2. **Verificar que la red esté correcta:**
   ```bash
   docker network inspect EcomdropNet
   ```

3. **Probar conexión manual:**
   ```bash
   docker exec -it $(docker ps -q -f name=shopify-app_mysql) \
     mysql -u shopify_user -p${MYSQL_PASSWORD} shopify_app
   ```

### Error de SSL/Traefik

1. **Verificar que Traefik esté corriendo:**
   ```bash
   docker service ls | grep traefik
   ```

2. **Verificar configuración de Traefik:**
   - Entrypoint `websecure` debe estar en puerto 443
   - CertResolver `letsencryptresolver` debe estar configurado
   - La red `EcomdropNet` debe estar disponible para Traefik

3. **Verificar logs de Traefik:**
   ```bash
   docker service logs -f traefik
   ```

### La aplicación no responde

1. **Verificar que el puerto 3000 esté expuesto:**
   ```bash
   docker service inspect shopify-app_shopify_app --pretty | grep -A 5 "Ports"
   ```

2. **Verificar que Traefik esté enrutando correctamente:**
   - Verifica los labels de Traefik en `docker-compose.yml`
   - Verifica que el dominio esté correcto: `connector.ecomdrop.io`

## 📊 Monitoreo

### Recursos del Sistema

```bash
# Ver uso de recursos
docker stats

# Ver uso específico de servicios
docker service ps shopify-app_shopify_app --no-trunc
docker service ps shopify-app_mysql --no-trunc
```

### Health Checks

Los servicios tienen health checks configurados. Puedes verificar su estado:

```bash
# Estado de health checks
docker service inspect shopify-app_mysql --pretty | grep -A 10 "Healthcheck"
```

## 🔒 Seguridad

1. **Cambiar contraseñas por defecto:**
   - Usa contraseñas seguras y únicas
   - No uses las mismas contraseñas en diferentes entornos

2. **Variables de entorno:**
   - Nunca subas el archivo `.env` al repositorio
   - Usa Portainer secrets para información sensible

3. **Firewall:**
   - Solo expón los puertos necesarios (443 para Traefik)
   - Bloquea acceso directo al puerto 3000

4. **Backups regulares:**
   - Configura backups automáticos de la base de datos
   - Guarda backups en un lugar seguro

## 📞 Soporte

Si encuentras problemas:

1. Revisa los logs: `docker service logs -f shopify-app_shopify_app`
2. Verifica la configuración de variables de entorno
3. Consulta la documentación de Shopify App Development
4. Revisa los issues en el repositorio

---

**Última actualización:** Enero 2025
**Versión:** 2.5

