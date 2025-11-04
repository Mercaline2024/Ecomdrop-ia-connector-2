# Migración de SQLite a MySQL

Este documento explica cómo migrar desde SQLite a MySQL.

## Problema

Las migraciones existentes fueron creadas para SQLite y usan:
- Comillas dobles `"Table"` en lugar de backticks `` `Table` ``
- Tipos de datos SQLite (`TEXT` sin límite) en lugar de tipos MySQL (`VARCHAR(255)`)
- Sintaxis SQLite en lugar de sintaxis MySQL

## Solución

Se ha creado una nueva migración inicial `20250101000000_init_mysql` que contiene todas las tablas con sintaxis MySQL correcta.

## Pasos para aplicar en producción

### Opción 1: Resetear migraciones (recomendado para producción nueva)

1. Conecta a tu base de datos MySQL
2. Elimina todas las tablas existentes (si las hay):
   ```sql
   DROP TABLE IF EXISTS `AIConfiguration`;
   DROP TABLE IF EXISTS `ProductAssociation`;
   DROP TABLE IF EXISTS `ShopConfiguration`;
   DROP TABLE IF EXISTS `Session`;
   ```

3. Ejecuta la migración:
   ```bash
   npx prisma migrate deploy
   ```

### Opción 2: Marcar migraciones como aplicadas (si ya tienes datos)

Si ya tienes datos en MySQL, puedes marcar las migraciones antiguas como aplicadas:

```bash
# Marcar todas las migraciones antiguas como aplicadas
npx prisma migrate resolve --applied 20240530213853_create_session_table
npx prisma migrate resolve --applied 20251101233824_add_shop_configuration
npx prisma migrate resolve --applied 20251101234941_add_flow_selections
npx prisma migrate resolve --applied 20251102004946_add_dropi_configuration
npx prisma migrate resolve --applied 20251102183355_add_product_association
npx prisma migrate resolve --applied 20251104170604_add_ai_configuration

# Aplicar solo la nueva migración MySQL
npx prisma migrate deploy
```

## Verificación

Después de aplicar las migraciones, verifica que las tablas existan:

```sql
SHOW TABLES;
```

Deberías ver:
- `Session`
- `ShopConfiguration`
- `ProductAssociation`
- `AIConfiguration`

## Notas importantes

1. **Backup de datos**: Si ya tienes datos en producción, haz un backup antes de migrar
2. **Charset**: Las tablas usan `utf8mb4` y `utf8mb4_unicode_ci` para soportar emojis y caracteres especiales
3. **Timestamps**: MySQL usa `DATETIME(3)` para mayor precisión en milisegundos
4. **IDs**: Los IDs usan `VARCHAR(191)` que es el máximo para índices en MySQL con utf8mb4

