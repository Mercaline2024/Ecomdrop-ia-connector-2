# ✅ Checklist de Despliegue

Usa este checklist para asegurarte de que todo esté listo antes de desplegar.

## 🔧 Pre-Despliegue

### Infraestructura
- [ ] VPS con Docker y Docker Swarm habilitado
- [ ] Portainer instalado y accesible
- [ ] Traefik configurado y corriendo
- [ ] Red `EcomdropNet` creada: `docker network create --driver overlay EcomdropNet`
- [ ] Dominio `connector.ecomdrop.io` apuntando al VPS (registro DNS A o CNAME)

### Traefik
- [ ] Entrypoint `websecure` configurado en puerto 443
- [ ] CertResolver `letsencryptresolver` configurado
- [ ] Traefik tiene acceso a la red `EcomdropNet`
- [ ] Certificados SSL funcionando (puedes probar con otro servicio)

### Variables de Entorno
- [ ] Archivo `.env` creado con todas las variables
- [ ] `MYSQL_ROOT_PASSWORD` configurado (contraseña segura)
- [ ] `MYSQL_PASSWORD` configurado (contraseña segura, diferente a root)
- [ ] `SHOPIFY_API_KEY` configurado (desde Shopify Partners)
- [ ] `SHOPIFY_API_SECRET` configurado (desde Shopify Partners)
- [ ] `SHOPIFY_APP_URL` configurado como `https://connector.ecomdrop.io`
- [ ] Variables opcionales configuradas si es necesario

### Shopify Partners
- [ ] App creada en Shopify Partners
- [ ] API Key y Secret obtenidos
- [ ] App URL configurada como `https://connector.ecomdrop.io`
- [ ] Redirect URL configurada como `https://connector.ecomdrop.io/api/auth`
- [ ] Scopes configurados correctamente

## 🏗️ Construcción

### Dockerfile
- [ ] Dockerfile existe y está en `ecomdrop-ia-connector/Dockerfile`
- [ ] Dockerfile usa Node 20 (verificado)
- [ ] Dockerfile incluye espera de MySQL (verificado)

### Docker Compose
- [ ] `docker-compose.yml` actualizado con dominio `connector.ecomdrop.io`
- [ ] Labels de Traefik configurados correctamente
- [ ] Variables de entorno referenciadas correctamente
- [ ] Dependencias configuradas (shopify_app depende de mysql)

## 📦 Despliegue

### Imagen Docker
- [ ] Imagen construida: `shopify-app_shopify_app:latest`
- [ ] Imagen probada localmente (opcional pero recomendado)

### Stack
- [ ] Stack desplegado en Portainer o Docker Swarm
- [ ] Variables de entorno cargadas correctamente
- [ ] Servicios iniciados: `docker service ls`

## ✅ Post-Despliegue

### Verificación de Servicios
- [ ] MySQL corriendo: `docker service ps shopify-app_mysql`
- [ ] Aplicación corriendo: `docker service ps shopify-app_shopify_app`
- [ ] Ambos servicios muestran estado "Running"

### Verificación de Logs
- [ ] MySQL inició correctamente (sin errores en logs)
- [ ] Aplicación inició correctamente (sin errores en logs)
- [ ] Migraciones de Prisma ejecutadas exitosamente
- [ ] Aplicación escuchando en puerto 3000

### Verificación de Red
- [ ] Aplicación puede conectarse a MySQL
- [ ] Traefik puede alcanzar la aplicación
- [ ] Red `EcomdropNet` contiene ambos servicios

### Verificación Web
- [ ] `https://connector.ecomdrop.io` responde
- [ ] Certificado SSL válido (candado verde)
- [ ] Redirección HTTP a HTTPS funciona
- [ ] Página de inicio de la app se muestra correctamente

### Verificación de Shopify
- [ ] App URL actualizada en Shopify Partners
- [ ] Redirect URL actualizada en Shopify Partners
- [ ] App puede instalarse en una tienda de prueba
- [ ] OAuth funciona correctamente

## 🔄 Pruebas Funcionales

### Funcionalidades Básicas
- [ ] Login/autenticación funciona
- [ ] Dashboard se carga correctamente
- [ ] Configuración se puede acceder
- [ ] Productos se pueden listar

### Base de Datos
- [ ] Tablas creadas correctamente
- [ ] Sesiones se guardan en MySQL
- [ ] Configuraciones se guardan correctamente

### Webhooks
- [ ] Webhooks configurados en Shopify
- [ ] Webhooks llegan correctamente (verificar logs)

## 📊 Monitoreo

### Recursos
- [ ] CPU y memoria dentro de límites razonables
- [ ] No hay memory leaks aparentes
- [ ] Logs no muestran errores críticos

### Backups
- [ ] Estrategia de backup configurada
- [ ] Backup inicial realizado
- [ ] Proceso de backup automatizado (si aplica)

## 🔒 Seguridad

- [ ] Contraseñas seguras configuradas
- [ ] Archivo `.env` NO está en el repositorio
- [ ] Firewall configurado correctamente
- [ ] Solo puertos necesarios expuestos
- [ ] Certificados SSL válidos

## 📝 Documentación

- [ ] Documentación de despliegue revisada
- [ ] Credenciales guardadas de forma segura
- [ ] Proceso de despliegue documentado para el equipo

---

## 🚨 Si algo falla

1. **Revisa los logs:**
   ```bash
   docker service logs -f shopify-app_shopify_app
   docker service logs -f shopify-app_mysql
   ```

2. **Verifica el estado de servicios:**
   ```bash
   docker service ls
   docker service ps shopify-app_shopify_app
   ```

3. **Verifica la configuración:**
   ```bash
   docker service inspect shopify-app_shopify_app --pretty
   ```

4. **Consulta la documentación:**
   - `DEPLOY.md` - Guía completa de despliegue
   - `TROUBLESHOOTING.md` - Solución de problemas comunes

---

**Fecha de despliegue:** _______________
**Desplegado por:** _______________
**Notas:** _______________

