FROM node:20-alpine
RUN apk add --no-cache openssl

EXPOSE 3000

WORKDIR /app

ENV NODE_ENV=production

COPY package.json package-lock.json* ./

RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN npm run build

# Crear script de inicio que espera a MySQL
RUN echo '#!/bin/sh' > /app/wait-for-mysql.sh && \
    echo 'set -e' >> /app/wait-for-mysql.sh && \
    echo 'host="$1"' >> /app/wait-for-mysql.sh && \
    echo 'shift' >> /app/wait-for-mysql.sh && \
    echo 'cmd="$@"' >> /app/wait-for-mysql.sh && \
    echo 'until nc -z "$host" 3306; do' >> /app/wait-for-mysql.sh && \
    echo '  >&2 echo "MySQL is unavailable - sleeping"' >> /app/wait-for-mysql.sh && \
    echo '  sleep 2' >> /app/wait-for-mysql.sh && \
    echo 'done' >> /app/wait-for-mysql.sh && \
    echo '>&2 echo "MySQL is up - executing command"' >> /app/wait-for-mysql.sh && \
    echo 'exec $cmd' >> /app/wait-for-mysql.sh && \
    chmod +x /app/wait-for-mysql.sh

RUN apk add --no-cache netcat-openbsd

CMD ["/app/wait-for-mysql.sh", "mysql", "npm", "run", "docker-start"]
