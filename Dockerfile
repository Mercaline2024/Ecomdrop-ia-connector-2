FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

# Instalar netcat para verificar MySQL
RUN apk add --no-cache netcat-openbsd

# Crear script de inicio que espera a MySQL y valida variables
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'echo "=== Starting application ==="' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Validar variables de entorno críticas' >> /app/docker-entrypoint.sh && \
    echo 'if [ -z "$DATABASE_URL" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "ERROR: DATABASE_URL is not set"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'if [ -z "$SHOPIFY_API_KEY" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "ERROR: SHOPIFY_API_KEY is not set"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'if [ -z "$SHOPIFY_API_SECRET" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "ERROR: SHOPIFY_API_SECRET is not set"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'if [ -z "$SHOPIFY_APP_URL" ]; then' >> /app/docker-entrypoint.sh && \
    echo '  echo "ERROR: SHOPIFY_APP_URL is not set"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo 'fi' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ Environment variables validated"' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Esperar a que MySQL esté disponible' >> /app/docker-entrypoint.sh && \
    echo 'echo "Waiting for MySQL to be ready..."' >> /app/docker-entrypoint.sh && \
    echo 'counter=0' >> /app/docker-entrypoint.sh && \
    echo 'until nc -z mysql 3306; do' >> /app/docker-entrypoint.sh && \
    echo '  counter=$((counter+1))' >> /app/docker-entrypoint.sh && \
    echo '  echo "MySQL is unavailable - sleeping (attempt $counter)..."' >> /app/docker-entrypoint.sh && \
    echo '  sleep 2' >> /app/docker-entrypoint.sh && \
    echo '  if [ $counter -gt 30 ]; then' >> /app/docker-entrypoint.sh && \
    echo '    echo "ERROR: MySQL did not become available after 60 seconds"' >> /app/docker-entrypoint.sh && \
    echo '    exit 1' >> /app/docker-entrypoint.sh && \
    echo '  fi' >> /app/docker-entrypoint.sh && \
    echo 'done' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ MySQL is up and ready"' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Ejecutar setup (generar Prisma Client y migraciones)' >> /app/docker-entrypoint.sh && \
    echo 'echo "🔧 Running database setup..."' >> /app/docker-entrypoint.sh && \
    echo 'npm run setup || {' >> /app/docker-entrypoint.sh && \
    echo '  echo "ERROR: Database setup failed"' >> /app/docker-entrypoint.sh && \
    echo '  exit 1' >> /app/docker-entrypoint.sh && \
    echo '}' >> /app/docker-entrypoint.sh && \
    echo 'echo "✅ Database setup completed"' >> /app/docker-entrypoint.sh && \
    echo '' >> /app/docker-entrypoint.sh && \
    echo '# Iniciar aplicación' >> /app/docker-entrypoint.sh && \
    echo 'echo "🚀 Starting application on port 3000..."' >> /app/docker-entrypoint.sh && \
    echo 'exec npm run start' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
