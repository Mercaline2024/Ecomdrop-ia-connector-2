#!/bin/sh
set -e

echo "=== Starting application ==="

# Validar variables de entorno críticas
if [ -z "$DATABASE_URL" ]; then
  echo "ERROR: DATABASE_URL is not set"
  exit 1
fi

if [ -z "$SHOPIFY_API_KEY" ]; then
  echo "ERROR: SHOPIFY_API_KEY is not set"
  exit 1
fi

if [ -z "$SHOPIFY_API_SECRET" ]; then
  echo "ERROR: SHOPIFY_API_SECRET is not set"
  exit 1
fi

if [ -z "$SHOPIFY_APP_URL" ]; then
  echo "ERROR: SHOPIFY_APP_URL is not set"
  exit 1
fi

echo "✅ Environment variables validated"

# Esperar a que MySQL esté disponible
echo "Waiting for MySQL to be ready..."
counter=0
until nc -z mysql 3306; do
  counter=$((counter+1))
  echo "MySQL is unavailable - sleeping (attempt $counter)..."
  sleep 2
  if [ $counter -gt 30 ]; then
    echo "ERROR: MySQL did not become available after 60 seconds"
    exit 1
  fi
done
echo "✅ MySQL is up and ready"

# Ejecutar setup (generar Prisma Client y migraciones)
echo "🔧 Running database setup..."
npm run setup || {
  echo "ERROR: Database setup failed"
  exit 1
}
echo "✅ Database setup completed"

# Iniciar aplicación
echo "🚀 Starting application on port 3000..."
exec npm run start
