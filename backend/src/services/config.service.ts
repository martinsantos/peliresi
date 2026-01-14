/**
 * ConfigService - CU-A12: Configuración del Sistema
 * Servicio para gestionar parámetros del sistema
 * Almacena en archivo JSON para persistencia sin BD
 */

import fs from 'fs';
import path from 'path';

// Valores por defecto del sistema
const DEFAULT_CONFIG = {
  vencimientoManifiestos: 30,      // días
  alertaDesvioGPS: 5,              // km
  tiempoMaxTransito: 48,           // horas
  emailNotificaciones: 'alertas@dgfa.mendoza.gov.ar',
  toleranciaPeso: 5,               // porcentaje
  tiempoSesion: 60,                // minutos
  // Configuración adicional
  notificacionesPush: true,
  notificacionesEmail: true,
  notificacionesSMS: false,
  backupAutomatico: true,
  frecuenciaBackup: 24,            // horas
  retencionLogs: 90,               // días
  // Límites del sistema
  maxArchivoCarga: 10,             // MB
  maxManifiestosPorPagina: 50,
  // Alertas automáticas
  alertaTiempoExcesivo: true,
  alertaVencimientoProximo: true,
  diasAlertaVencimiento: 7,
};

export type SystemConfig = typeof DEFAULT_CONFIG;

const CONFIG_FILE = path.join(__dirname, '../../config/system-config.json');

/**
 * Asegurar que el directorio de config existe
 */
function ensureConfigDir(): void {
  const dir = path.dirname(CONFIG_FILE);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

/**
 * Leer configuración del archivo
 */
function readConfigFile(): SystemConfig {
  try {
    ensureConfigDir();
    if (fs.existsSync(CONFIG_FILE)) {
      const data = fs.readFileSync(CONFIG_FILE, 'utf-8');
      return { ...DEFAULT_CONFIG, ...JSON.parse(data) };
    }
  } catch (error) {
    console.error('[ConfigService] Error reading config file:', error);
  }
  return { ...DEFAULT_CONFIG };
}

/**
 * Escribir configuración al archivo
 */
function writeConfigFile(config: SystemConfig): void {
  try {
    ensureConfigDir();
    fs.writeFileSync(CONFIG_FILE, JSON.stringify(config, null, 2));
    console.log('[ConfigService] Config saved to file');
  } catch (error) {
    console.error('[ConfigService] Error writing config file:', error);
    throw error;
  }
}

// Cache en memoria para evitar lecturas frecuentes
let configCache: SystemConfig | null = null;
let lastRead = 0;
const CACHE_TTL = 60000; // 1 minuto

export const configService = {
  /**
   * Obtener toda la configuración del sistema
   */
  getConfig(): SystemConfig {
    const now = Date.now();
    if (!configCache || now - lastRead > CACHE_TTL) {
      configCache = readConfigFile();
      lastRead = now;
    }
    return { ...configCache };
  },

  /**
   * Obtener un valor específico de configuración
   */
  getValue<K extends keyof SystemConfig>(key: K): SystemConfig[K] {
    const config = this.getConfig();
    return config[key];
  },

  /**
   * Actualizar configuración (parcial o completa)
   */
  updateConfig(updates: Partial<SystemConfig>): SystemConfig {
    const current = readConfigFile();
    const updated = { ...current, ...updates };
    writeConfigFile(updated);
    configCache = updated;
    lastRead = Date.now();
    return updated;
  },

  /**
   * Resetear configuración a valores por defecto
   */
  resetConfig(): SystemConfig {
    writeConfigFile(DEFAULT_CONFIG);
    configCache = { ...DEFAULT_CONFIG };
    lastRead = Date.now();
    return configCache;
  },

  /**
   * Obtener valores por defecto (para referencia)
   */
  getDefaults(): SystemConfig {
    return { ...DEFAULT_CONFIG };
  },

  /**
   * Validar valores de configuración
   */
  validateConfig(config: Partial<SystemConfig>): { valid: boolean; errors: string[] } {
    const errors: string[] = [];

    if (config.vencimientoManifiestos !== undefined) {
      if (config.vencimientoManifiestos < 1 || config.vencimientoManifiestos > 365) {
        errors.push('vencimientoManifiestos debe estar entre 1 y 365 días');
      }
    }

    if (config.alertaDesvioGPS !== undefined) {
      if (config.alertaDesvioGPS < 0.5 || config.alertaDesvioGPS > 50) {
        errors.push('alertaDesvioGPS debe estar entre 0.5 y 50 km');
      }
    }

    if (config.tiempoMaxTransito !== undefined) {
      if (config.tiempoMaxTransito < 1 || config.tiempoMaxTransito > 168) {
        errors.push('tiempoMaxTransito debe estar entre 1 y 168 horas (1 semana)');
      }
    }

    if (config.toleranciaPeso !== undefined) {
      if (config.toleranciaPeso < 0 || config.toleranciaPeso > 20) {
        errors.push('toleranciaPeso debe estar entre 0 y 20%');
      }
    }

    if (config.tiempoSesion !== undefined) {
      if (config.tiempoSesion < 5 || config.tiempoSesion > 480) {
        errors.push('tiempoSesion debe estar entre 5 y 480 minutos');
      }
    }

    if (config.emailNotificaciones !== undefined) {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(config.emailNotificaciones)) {
        errors.push('emailNotificaciones debe ser un email válido');
      }
    }

    return { valid: errors.length === 0, errors };
  }
};

export default configService;
