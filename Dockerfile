# Multi-stage build para optimizar tamaño y velocidad
FROM node:18-alpine AS builder

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl

WORKDIR /app/backend

# Copiar solo archivos de dependencias primero (para cache)
COPY backend/package*.json ./
COPY backend/prisma ./prisma/

# Instalar SOLO dependencias de producción
RUN npm ci --only=production --ignore-scripts

# Generar Prisma Client
RUN npx prisma generate

# Copiar código fuente
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Instalar TypeScript solo para build
RUN npm install --save-dev typescript @types/node

# Build
RUN npm run build

# Etapa final - imagen mínima
FROM node:18-alpine

RUN apk add --no-cache openssl

WORKDIR /app

# Usar usuario no-root por seguridad
RUN chown -R node:node /app
USER node

# Copiar solo lo necesario desde builder
COPY --from=builder --chown=node:node /app/backend/node_modules ./node_modules
COPY --from=builder --chown=node:node /app/backend/dist ./dist
COPY --from=builder --chown=node:node /app/backend/prisma ./prisma
COPY --chown=node:node backend/package*.json ./

# Puerto real de la aplicación
EXPOSE 3002

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3002

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=15s --retries=3 \
  CMD wget -qO- http://localhost:3002/api/health || exit 1

# Migración separada del CMD — ejecutar manualmente antes del deploy si hay schema changes:
# docker run --rm <image> node -e "require('./node_modules/.bin/prisma').migrate.deploy()"
CMD ["node", "dist/index.js"]
