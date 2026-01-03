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
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:3000',

  // SMTP
  SMTP: {
    HOST: process.env.SMTP_HOST || 'localhost',
    PORT: parseInt(process.env.SMTP_PORT || '587', 10),
    USER: process.env.SMTP_USER,
    PASS: process.env.SMTP_PASS,
    FROM: process.env.SMTP_FROM || '"SITREP" <no-reply@ultimamilla.com.ar>'
  }
};

// Validar configuraciones requeridas
if (!config.DATABASE_URL) {
  console.error('ERROR: DATABASE_URL no está definida en las variables de entorno');
  process.exit(1);
}

export default config;
