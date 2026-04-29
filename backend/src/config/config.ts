import dotenv from 'dotenv';
import path from 'path';
import logger from '../utils/logger';

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
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '15m',
  JWT_REFRESH_SECRET: process.env.JWT_REFRESH_SECRET || 'your-refresh-secret-key-change-in-production',
  JWT_REFRESH_EXPIRES_IN: process.env.JWT_REFRESH_EXPIRES_IN || '7d',

  // CORS
  CORS_ORIGIN: process.env.CORS_ORIGIN || 'http://localhost:5173',

  // Blockchain
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true',
  BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || '',
  BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || ''
};

// Validar configuraciones requeridas
if (!config.DATABASE_URL) {
  logger.error('DATABASE_URL no esta definida en las variables de entorno');
  process.exit(1);
}

// En producción: fallar rápido si JWT_SECRET es el valor inseguro por defecto
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    logger.error('FATAL: JWT_SECRET is using the insecure default value in production. Set a strong secret in .env');
    process.exit(1);
  }
  if (config.JWT_REFRESH_SECRET === 'your-refresh-secret-key-change-in-production') {
    logger.error('FATAL: JWT_REFRESH_SECRET is using the insecure default value in production. Set a strong secret in .env');
    process.exit(1);
  }
  if (config.JWT_SECRET === config.JWT_REFRESH_SECRET) {
    logger.error('FATAL: JWT_SECRET and JWT_REFRESH_SECRET must be different in production.');
    process.exit(1);
  }
}

export default config;
