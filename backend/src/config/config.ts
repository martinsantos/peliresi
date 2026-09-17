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
  // Production is fronted by Nginx/LB; keep Node off the network interfaces.
  HOST: process.env.HOST || (process.env.NODE_ENV === 'production' ? '127.0.0.1' : '0.0.0.0'),

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
  FRONTEND_URL: process.env.FRONTEND_URL || process.env.CORS_ORIGIN?.split(',')[0] || 'http://localhost:5173',

  // Turnstile Captcha
  TURNSTILE_SECRET_KEY: process.env.TURNSTILE_SECRET_KEY || '',

  // Blockchain
  BLOCKCHAIN_ENABLED: process.env.BLOCKCHAIN_ENABLED === 'true',
  BLOCKCHAIN_RPC_URL: process.env.BLOCKCHAIN_RPC_URL || '',
  BLOCKCHAIN_CONTRACT_ADDRESS: process.env.BLOCKCHAIN_CONTRACT_ADDRESS || '',

  // Demo login controls. In production this may only be enabled with
  // an explicit IP allowlist and, by default, an expiration. A no-expiry
  // session is an intentional demo-only exception that must be opted into
  // explicitly (never the default).
  DEMO_LOGIN_ENABLED: process.env.DEMO_LOGIN_ENABLED === 'true',
  DEMO_LOGIN_ALLOWED_IPS: (process.env.DEMO_LOGIN_ALLOWED_IPS || '')
    .split(',')
    .map((ip) => ip.trim())
    .filter(Boolean),
  DEMO_LOGIN_EXPIRES_AT: process.env.DEMO_LOGIN_EXPIRES_AT || '',
  DEMO_LOGIN_ALLOW_NO_EXPIRY: process.env.DEMO_LOGIN_ALLOW_NO_EXPIRY === 'true',

  // Privileged demo/training accounts. Production is fail-closed when these
  // lists are absent; they are supplied only by the service environment.
  PRIVILEGED_ACCESS_EMAILS: (process.env.PRIVILEGED_ACCESS_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),
  IMPERSONATION_EMAILS: (process.env.IMPERSONATION_EMAILS || '')
    .split(',')
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean),

  // File scanning policy for uploads
  FILE_SCAN_MODE: process.env.FILE_SCAN_MODE || (process.env.NODE_ENV === 'production' ? 'required' : 'disabled'),
  CLAMAV_SCAN_CMD: process.env.CLAMAV_SCAN_CMD || 'clamscan --no-summary',

  // Document integrity and certificate signing. These secrets are never
  // returned by the API and are intentionally optional outside production so
  // the local test suite can generate an ephemeral Ed25519 key pair.
  DOCUMENT_HMAC_SECRET: process.env.DOCUMENT_HMAC_SECRET || process.env.JWT_SECRET || 'local-document-hmac-only',
  CERTIFICATE_ED25519_PRIVATE_KEY: process.env.CERTIFICATE_ED25519_PRIVATE_KEY || '',
  CERTIFICATE_ED25519_PUBLIC_KEY: process.env.CERTIFICATE_ED25519_PUBLIC_KEY || '',
  CERTIFICATE_POLICY_VERSION: process.env.CERTIFICATE_POLICY_VERSION || '1',
  OCR_LANG_PATH: process.env.OCR_LANG_PATH || '',
  OCR_WORKER_PATH: process.env.OCR_WORKER_PATH || '',
  OCR_CORE_PATH: process.env.OCR_CORE_PATH || '',
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
    const hasValidExpiry = Boolean(expiresAt && !Number.isNaN(expiresAt.getTime()) && expiresAt > new Date());
    const noExpiryAllowed = config.DEMO_LOGIN_ALLOW_NO_EXPIRY;
    if (config.DEMO_LOGIN_ALLOWED_IPS.length === 0 || (!hasValidExpiry && !noExpiryAllowed)) {
      logger.error('FATAL: DEMO_LOGIN_ENABLED requires DEMO_LOGIN_ALLOWED_IPS and either a future DEMO_LOGIN_EXPIRES_AT or DEMO_LOGIN_ALLOW_NO_EXPIRY=true in production.');
      process.exit(1);
    }
    if (noExpiryAllowed && !hasValidExpiry) {
      logger.warn('DEMO_LOGIN_ALLOW_NO_EXPIRY=true — demo login has no global expiration; restrict this environment to controlled training access.');
    }
  }
  if (config.FILE_SCAN_MODE === 'required' && !config.CLAMAV_SCAN_CMD) {
    logger.error('FATAL: FILE_SCAN_MODE=required requires CLAMAV_SCAN_CMD.');
    process.exit(1);
  }
  if (!config.CERTIFICATE_ED25519_PRIVATE_KEY || !config.CERTIFICATE_ED25519_PUBLIC_KEY) {
    logger.error('FATAL: certificate Ed25519 key pair is required in production.');
    process.exit(1);
  }
  if (config.DOCUMENT_HMAC_SECRET === 'local-document-hmac-only') {
    logger.error('FATAL: DOCUMENT_HMAC_SECRET must be configured in production.');
    process.exit(1);
  }
}

export default config;
