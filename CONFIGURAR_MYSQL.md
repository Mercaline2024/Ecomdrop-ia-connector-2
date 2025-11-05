# ⚙️ Configuración de MySQL - Pasos Finales

El proyecto ya está configurado para usar MySQL. Solo necesitas completar estos pasos:

## ✅ Paso 1: Actualizar archivo `.env`

Edita tu archivo `.env` y actualiza la variable `DATABASE_URL`:

```env
# MySQL en VPS (31.97.135.241:3306)
# IMPORTANTE: El @ en la contraseña debe codificarse como %40
DATABASE_URL="mysql://root:Pepagar0812%40@31.97.135.241:3306/ecomdrop_dev?connection_limit=1"
```

**Nota:** Si tu contraseña tiene otros caracteres especiales, codifícalos:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `&` → `%26`

## ✅ Paso 2: Crear la Base de Datos

Conéctate a MySQL y crea la base de datos:

### Opción A: Desde terminal local
```bash
mysql -h 31.97.135.241 -P 3306 -u root -p
# Ingresa la contraseña: Pepagar0812@
```

### Opción B: Desde Portainer
1. Ve al servicio `mysql_dev_mysql`
2. Click en "Console"
3. Ejecuta: `mysql -u root -p`

Luego ejecuta en MySQL:
```sql
CREATE DATABASE IF NOT EXISTS ecomdrop_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

## ✅ Paso 3: Crear Migraciones

Una vez que tengas la base de datos creada, ejecuta:

```bash
# Crear migración inicial para MySQL
npx prisma migrate dev --name init_mysql
```

Esto creará todas las tablas en MySQL.

## ✅ Paso 4: Verificar que Funciona

```bash
# Opción 1: Prisma Studio (interfaz visual)
npx prisma studio

# Opción 2: Test de conexión
npx prisma db pull

# Opción 3: Iniciar la app
npm run dev
```

## 🔍 Verificar Conexión

Si todo está bien, deberías ver:
- ✅ Prisma Studio se conecta y muestra las tablas
- ✅ `npx prisma db pull` no muestra errores
- ✅ La app inicia sin errores de base de datos

## 🚨 Si hay Problemas

### Error: "Can't connect to MySQL server"
- Verifica que MySQL esté corriendo en el VPS
- Verifica que el puerto 3306 esté abierto en el firewall
- Verifica que el puerto esté expuesto en Portainer (debe ser `3306:3306`)

### Error: "Access denied"
- Verifica usuario y contraseña en `.env`
- Verifica que la contraseña esté codificada correctamente (`@` → `%40`)

### Error: "Unknown database"
- Asegúrate de crear la base de datos primero (Paso 2)

## 📝 Resumen Rápido

1. ✅ Schema actualizado a MySQL (ya hecho)
2. ⏳ Actualizar `.env` con DATABASE_URL
3. ⏳ Crear base de datos `ecomdrop_dev`
4. ⏳ Ejecutar `npx prisma migrate dev --name init_mysql`
5. ⏳ Verificar con `npx prisma studio`

## 🎯 DATABASE_URL Final

```env
DATABASE_URL="mysql://root:Pepagar0812%40@31.97.135.241:3306/ecomdrop_dev?connection_limit=1"
```

¡Listo! Tu proyecto está configurado para MySQL. 🚀

