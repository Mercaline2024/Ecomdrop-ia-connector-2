#!/bin/sh
set -e

echo "==================================="
echo "🚀 Starting Shopify App Container"
echo "==================================="
echo ""

# Esperar a que MySQL esté disponible
if [ -n "$DATABASE_URL" ]; then
  echo "⏳ Waiting for MySQL to be ready..."
  counter=0
  max_attempts=60
  
  # Extraer host y puerto de DATABASE_URL
  # Formato: mysql://user:pass@host:port/db
  DB_HOST=$(echo "$DATABASE_URL" | sed -n 's/.*@\([^:]*\):.*/\1/p')
  DB_PORT=$(echo "$DATABASE_URL" | sed -n 's/.*:\([0-9]*\)\/.*/\1/p')
  
  # Valores por defecto si no se pueden extraer
  DB_HOST=${DB_HOST:-mysql}
  DB_PORT=${DB_PORT:-3306}
  
  echo "  📍 Connecting to MySQL at $DB_HOST:$DB_PORT"
  
  until nc -z "$DB_HOST" "$DB_PORT"; do
    counter=$((counter+1))
    if [ $counter -gt $max_attempts ]; then
      echo "❌ MySQL did not become available after $((max_attempts * 2)) seconds"
      echo "   Host: $DB_HOST, Port: $DB_PORT"
      exit 1
    fi
    echo "  ⏱️  Attempt $counter/$max_attempts - MySQL is unavailable, waiting..."
    sleep 2
  done
  echo "✅ MySQL is ready!"
fi

# Generar Prisma Client
echo "🔧 Generating Prisma Client..."
if ! npx prisma generate; then
  echo "❌ Failed to generate Prisma Client"
  exit 1
fi
echo "✅ Prisma Client generated"

# Ejecutar migraciones
echo "📊 Running database migrations..."
if ! npx prisma migrate deploy; then
  echo "⚠️  Migration failed or already applied, continuing..."
  # No salir aquí porque puede ser que las migraciones ya estén aplicadas
fi
echo "✅ Migrations check completed"

# Iniciar aplicación
echo "🎯 Starting application on port ${PORT:-3000}..."
exec npm run start
