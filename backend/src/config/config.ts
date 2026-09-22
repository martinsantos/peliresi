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
  PORT: parseInt(process.env.PORT || '3010', 10),

  // Base de datos
  // Default apunta a trazabilidad_dev para evitar conexiones accidentales a producción
  // sin un .env explícito.
  DATABASE_URL: process.env.DATABASE_URL || 'postgresql://postgres:postgres@localhost:5432/trazabilidad_dev?schema=public',

  // JWT
  JWT_SECRET: process.env.JWT_SECRET || 'your-super-secret-jwt-key-change-in-production',
  JWT_EXPIRES_IN: process.env.JWT_EXPIRES_IN || '24h',

  // Public inspection QR links. Keep this secret independent from JWT_SECRET
  // so a leaked QR cannot be used to forge authentication tokens.
  INSPECTION_TRACE_SECRET: process.env.INSPECTION_TRACE_SECRET || 'development-inspection-trace-secret',
  FRONTEND_URL: (process.env.FRONTEND_URL || 'http://localhost:5173').replace(/\/$/, ''),

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
if (config.NODE_ENV === 'production' && config.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
  logger.error('FATAL: JWT_SECRET is using the insecure default value in production. Set a strong secret in .env');
  process.exit(1);
}

if (config.NODE_ENV === 'production') {
  const secretIsWeak = config.INSPECTION_TRACE_SECRET.length < 32
    || config.INSPECTION_TRACE_SECRET === config.JWT_SECRET
    || config.INSPECTION_TRACE_SECRET.includes('CHANGE_ME')
    || config.INSPECTION_TRACE_SECRET === 'development-inspection-trace-secret';
  let frontendUrl: URL;
  try { frontendUrl = new URL(config.FRONTEND_URL); } catch { frontendUrl = new URL('http://invalid.local'); }
  const frontendUrlIsUnsafe = frontendUrl.protocol !== 'https:' || ['localhost', '127.0.0.1', '::1', '[::1]'].includes(frontendUrl.hostname);
  if (!process.env.INSPECTION_TRACE_SECRET || secretIsWeak) {
    logger.error('FATAL: INSPECTION_TRACE_SECRET must be a strong value (at least 32 chars) in production');
    process.exit(1);
  }
  if (frontendUrlIsUnsafe) {
    logger.error('FATAL: FRONTEND_URL must use HTTPS and a non-localhost host in production');
    process.exit(1);
  }
}

export default config;
