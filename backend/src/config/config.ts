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

  // Turnstile Captcha
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',

  // Blockchain
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true',
  BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || '',
  BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '',

  // Demo login controls. In production this may only be enabled with
  // explicit IP allowlist and expiration.
  DEMO_LOGIN_ENABLED: process.env.DEMO_LOGIN_ENABLED === 'true',
  DEMO_LOGIN_ALLOWED_IPS: (process.env.DEMO_LOGIN_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
  DEMO_LOGIN_EXPIRES_AT: process.env.DEMO_LOGIN_EXPIRES_AT || '',

  // File scanning policy for uploads
  FILE_SCAN_MODE: process.env.FILE_SCAN_MODE || (process.env.NODE_ENV === 'production' ? 'required' : 'disabled'),
  CLAMAV_SCAN_CMD: process.env.CLAMAV_SCAN_CMD || 'clamscan --no-summary'
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
  if (config.DEMO_LOGIN_ENABLED) {
    const expiresAt = config.DEMO_LOGIN_EXPIRES_AT ? new Date(config.DEMO_LOGIN_EXPIRES_AT) : null;
    if (config.DEMO_LOGIN_ALLOWED_IPS.length === 0 || !expiresAt || Number.isNaN(expiresAt.getTime()) || expiresAt <= new Date()) {
      logger.error('FATAL: DEMO_LOGIN_ENABLED requires DEMO_LOGIN_ALLOWED_IPS and a future DEMO_LOGIN_EXPIRES_AT in production.');
      process.exit(1);
    }
  }
  if (config.FILE_SCAN_MODE === 'required' && !config.CLAMAV_SCAN_CMD) {
    logger.error('FATAL: FILE_SCAN_MODE=required requires CLAMAV_SCAN_CMD.');
    process.exit(1);
  }
}

export default config;
