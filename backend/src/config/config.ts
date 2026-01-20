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

// ====================================================
// HELPERS DE ENTORNO
// ====================================================
export const isProduction = () => config.NODE_ENV === 'production';
export const isDevelopment = () => config.NODE_ENV === 'development';

/**
 * Ambiente DEMO: Permite cambio de perfiles y funciones de prueba
 * Se activa con:
 * - NODE_ENV=demo
 * - NODE_ENV=development
 * - DEMO_MODE=true (incluso en producción para demos controlados)
 */
export const isDemoEnvironment = () =>
  config.NODE_ENV === 'demo' ||
  config.NODE_ENV === 'development' ||
  process.env.DEMO_MODE === 'true';

// Variables requeridas SOLO en producción
const validateProductionEnv = () => {
  if (!isProduction()) return;

  const required = ['JWT_SECRET', 'DATABASE_URL', 'SIGNATURE_SECRET', 'CORS_ORIGIN'];
  const missing = required.filter(v => !process.env[v]);

  if (missing.length > 0) {
    console.error('[CONFIG] ERROR FATAL - Variables requeridas en producción no definidas:');
    missing.forEach(v => console.error(`  - ${v}`));
    process.exit(1);
  }

  // Validar que JWT_SECRET no sea el valor por defecto
  if (process.env.JWT_SECRET === 'your-super-secret-jwt-key-change-in-production') {
    console.error('[CONFIG] ERROR FATAL - JWT_SECRET debe cambiarse en producción');
    console.error('  Generar con: openssl rand -hex 32');
    process.exit(1);
  }

  console.log('[CONFIG] Modo PRODUCCIÓN - Variables validadas correctamente');
};

// Ejecutar validación al cargar config
validateProductionEnv();

export default config;
