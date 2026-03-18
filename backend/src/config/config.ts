import dotenv from 'dotenv';
import path from 'path';

// Cargar variables de entorno
dotenv.config({
  path: path.resolve(__dirname, '../../.env')
});

// Configuración básica
export const config = {
  // Configuración del servidor
  NODE_ENV: process.env.NODE_ENV || 'development',
  PORT: parseInt(process.env.PORT || '3002', 10),

  // Base de datos
  // Default apunta a trazabilidad_dev para evitar conexiones accidentales a producción
  // sin un .env explícito.
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trazabilidad_dev?schema=public',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173'
};

// Validar configuraciones requeridas
if (!config.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida en las variables de entorno');
  process.exit(1);
}

// En producción: fallar rápido si JWT_SECRET es el valor inseguro por defecto
if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.error('FATAL: JWT_SECRET is using the insecure default value in production. Set a strong secret in .env');
  process.exit(1);
}

export default config;
