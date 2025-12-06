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

# Copiar solo lo necesario desde builder
COPY --from=builder /app/backend/node_modules ./node_modules
COPY --from=builder /app/backend/dist ./dist
COPY --from=builder /app/backend/prisma ./prisma
COPY backend/package*.json ./

# Exponer puerto
EXPOSE 3000

# Variables de entorno por defecto
ENV NODE_ENV=production
ENV PORT=3000

# Comando de inicio
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
