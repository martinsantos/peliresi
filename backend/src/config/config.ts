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
  PORT: parseInt(process.env.PORT || '3001', 10),
  
  // Base de datos
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trazabilidad_rrpp?schema=public',
  
  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',
  
  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000'
};

// Validar configuraciones requeridas
if (!config.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida en las variables de entorno');
  process.exit(1);
}

// Warn if JWT_SECRET is the default insecure value in production
if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  console.error('WARNING: JWT_SECRET is using the default insecure value in production! Set a strong secret in .env');
}

export default config;
