# Dockerfile para Railway
FROM node:18-alpine

# Instalar OpenSSL para Prisma
RUN apk add --no-cache openssl

WORKDIR /app

# Copiar package.json de backend
COPY backend/package*.json ./backend/
COPY backend/prisma ./backend/prisma/

# Instalar dependencias
WORKDIR /app/backend
RUN npm ci --only=production

# Generar Prisma Client
RUN npx prisma generate

# Copiar código fuente
COPY backend/src ./src
COPY backend/tsconfig.json ./

# Build TypeScript
RUN npm run build

# Exponer puerto
EXPOSE 3000

# Comando de inicio
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/index.js"]
