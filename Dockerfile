# Multi-stage build para optimizar tamaño de imagen
FROM node:20-alpine AS base
RUN apk add --no-cache openssl libc6-compat

# Stage 1: Dependencies
FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci --only=production && npm cache clean --force

# Stage 2: Build
FROM base AS builder
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 3: Production
FROM base AS runner
WORKDIR /app

ENV NODE_ENV=production
ENV PORT=3000

# Instalar herramientas necesarias
RUN apk add --no-cache netcat-openbsd curl

# Copiar dependencias de producción
COPY --from=deps /app/node_modules ./node_modules

# Copiar archivos de build
COPY --from=builder /app/build ./build
COPY --from=builder /app/public ./public

# Copiar archivos necesarios para Prisma
COPY package.json package-lock.json* ./
COPY prisma ./prisma

# Copiar script de entrypoint
COPY docker-entrypoint.sh /app/docker-entrypoint.sh
RUN chmod +x /app/docker-entrypoint.sh

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
  CMD curl -f http://localhost:3000/ || exit 1

CMD ["/app/docker-entrypoint.sh"]
