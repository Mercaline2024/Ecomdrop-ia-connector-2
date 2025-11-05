# Configuración de MySQL para Desarrollo

Este proyecto está configurado para usar MySQL 8.0 en lugar de SQLite para mantener consistencia con el entorno de producción.

## 📋 Requisitos Previos

- MySQL 8.0 corriendo en el VPS (31.97.135.241:3306)
- Acceso a la base de datos desde tu computador local
- Credenciales de MySQL (root / Pepagar0812@)

## 🔧 Configuración

### 1. Crear archivo `.env`

Copia `.env.example` a `.env` y actualiza las variables:

```bash
cp .env.example .env
```

Luego edita `.env` con tus credenciales:

```env
DATABASE_URL="mysql://root:Pepagar0812%40@31.97.135.241:3306/ecomdrop_dev?connection_limit=1"
```

**Importante:** El símbolo `@` en la contraseña debe codificarse como `%40` en la URL.

### 2. Crear la Base de Datos

Conéctate a MySQL y crea la base de datos:

```bash
# Opción 1: Desde terminal local
mysql -h 31.97.135.241 -P 3306 -u root -p

# Opción 2: Desde Portainer (Console del contenedor)
mysql -u root -p
```

Luego ejecuta:

```sql
CREATE DATABASE IF NOT EXISTS ecomdrop_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
SHOW DATABASES;
EXIT;
```

### 3. Instalar Dependencias

```bash
npm install
```

Nota: `mysql2` ya está incluido en `package.json`.

### 4. Generar Cliente Prisma

```bash
npx prisma generate
```

### 5. Crear Migraciones

```bash
# Crear migración inicial para MySQL
npx prisma migrate dev --name init_mysql
```

Esto creará todas las tablas en MySQL.

## ✅ Verificar Conexión

### Opción 1: Prisma Studio

```bash
npx prisma studio
```

Abre http://localhost:5555 en tu navegador.

### Opción 2: Test de Conexión

```bash
npx prisma db pull
```

Si no hay errores, la conexión está funcionando.

### Opción 3: Test con MySQL Client

```bash
mysql -h 31.97.135.241 -P 3306 -u root -p
# Ingresa la contraseña: Pepagar0812@
```

## 🔒 Seguridad

### Recomendación: Usar SSH Tunnel

Para mayor seguridad, usa un túnel SSH en lugar de exponer MySQL directamente:

```bash
# Crear túnel SSH
ssh -L 3306:localhost:3306 root@31.97.135.241

# Luego en .env usar:
DATABASE_URL="mysql://root:Pepagar0812%40@localhost:3306/ecomdrop_dev?connection_limit=1"
```

### Crear Usuario Específico para Desarrollo

Es mejor crear un usuario específico en lugar de usar root:

```sql
CREATE USER 'dev_user'@'%' IDENTIFIED BY 'password_segura';
GRANT ALL PRIVILEGES ON ecomdrop_dev.* TO 'dev_user'@'%';
FLUSH PRIVILEGES;
```

Luego usar en `.env`:
```env
DATABASE_URL="mysql://dev_user:password_segura@31.97.135.241:3306/ecomdrop_dev?connection_limit=1"
```

## 🚨 Troubleshooting

### Error: "Can't connect to MySQL server"

1. Verifica que MySQL esté corriendo en el VPS
2. Verifica que el puerto 3306 esté abierto en el firewall
3. Verifica que el puerto esté expuesto en Portainer

### Error: "Access denied for user"

1. Verifica usuario y contraseña
2. Verifica que el usuario tenga permisos
3. Verifica que la IP esté permitida (si usas restricciones)

### Error: "Unknown database"

1. Asegúrate de crear la base de datos primero
2. Verifica el nombre de la base de datos en la URL

### Caracteres Especiales en Password

Si tu contraseña tiene caracteres especiales, codifícalos en la URL:
- `@` → `%40`
- `#` → `%23`
- `$` → `%24`
- `%` → `%25`
- `&` → `%26`
- `+` → `%2B`
- `=` → `%3D`
- `?` → `%3F`

## 📊 Estructura de la Base de Datos

Después de ejecutar las migraciones, tendrás estas tablas:

- `Session` - Sesiones de Shopify
- `ShopConfiguration` - Configuración de tiendas
- `ProductAssociation` - Asociaciones de productos
- `AIConfiguration` - Configuración de IA

## 🔄 Migración desde SQLite

Si tienes datos en SQLite que quieres migrar:

1. Exporta los datos de SQLite
2. Convierte el formato si es necesario
3. Importa a MySQL manualmente o usando scripts

## 📝 Notas

- El proyecto ahora usa MySQL en lugar de SQLite
- Las migraciones de SQLite no funcionan en MySQL
- Necesitas crear nuevas migraciones para MySQL
- El archivo `dev.sqlite` ya no se usa

