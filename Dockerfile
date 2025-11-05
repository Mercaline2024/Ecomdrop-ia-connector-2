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

# Crear script de inicio que espera a MySQL
RUN echo '#!/bin/sh' > /app/docker-entrypoint.sh && \
    echo 'set -e' >> /app/docker-entrypoint.sh && \
    echo 'echo "=== Starting application ==="' >> /app/docker-entrypoint.sh && \
    echo 'echo "Waiting for MySQL to be ready..."' >> /app/docker-entrypoint.sh && \
    echo 'counter=0' >> /app/docker-entrypoint.sh && \
    echo 'until nc -z mysql 3306; do' >> /app/docker-entrypoint.sh && \
    echo '  counter=$((counter+1))' >> /app/docker-entrypoint.sh && \
    echo '  echo "MySQL is unavailable - sleeping (attempt $counter)..."' >> /app/docker-entrypoint.sh && \
    echo '  sleep 2' >> /app/docker-entrypoint.sh && \
    echo '  if [ $counter -gt 30 ]; then' >> /app/docker-entrypoint.sh && \
    echo '    echo "MySQL did not become available after 60 seconds"' >> /app/docker-entrypoint.sh && \
    echo '    exit 1' >> /app/docker-entrypoint.sh && \
    echo '  fi' >> /app/docker-entrypoint.sh && \
    echo 'done' >> /app/docker-entrypoint.sh && \
    echo 'echo "MySQL is up - executing application..."' >> /app/docker-entrypoint.sh && \
    echo 'echo "Running: npm run docker-start"' >> /app/docker-entrypoint.sh && \
    echo 'exec npm run docker-start' >> /app/docker-entrypoint.sh && \
    chmod +x /app/docker-entrypoint.sh

CMD ["/app/docker-entrypoint.sh"]
