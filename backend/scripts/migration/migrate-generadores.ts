/**
 * Script de Migración Masiva de Generadores
 *
 * Migra generadores al sistema SITREP con:
 * - Migración por lotes para no colapsar el sistema
 * - Backup automático antes de cada lote
 * - Logging detallado
 * - Capacidad de reanudar desde un lote específico
 *
 * Uso:
 *   npx tsx scripts/migration/migrate-generadores.ts <archivo.json> [opciones]
 *
 * Opciones:
 *   --batch-size <n>     Tamaño del lote (default: 200)
 *   --start-batch <n>    Iniciar desde lote N (para reanudar)
 *   --delay <ms>         Pausa entre lotes en ms (default: 2000)
 *   --dry-run            Simular sin escribir en DB
 *   --no-backup          No crear backups (solo para pruebas)
 *
 * Ejemplo:
 *   npx tsx scripts/migration/migrate-generadores.ts generadores-transformados.json --batch-size 100
 */

import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import { spawnSync } from 'child_process';
import path from 'path';

// Configuración
const CONFIG = {
  BATCH_SIZE: 200,
  DELAY_BETWEEN_BATCHES: 2000,
  BACKUP_DIR: '/backups',
  LOG_DIR: './logs',
  DRY_RUN: false,
  CREATE_BACKUPS: true,
  START_BATCH: 0,
  // Docker container name para backups
  DB_CONTAINER: 'directus-admin-database-1',
  DB_USER: 'directus',
  DB_NAME: 'trazabilidad_demo'
};

// Interfaces
interface GeneradorData {
  razonSocial: string;
  cuit: string;
  cuitNormalizado: string;
  domicilio: string;
  telefono: string;
  email: string;
  emailOriginal: string;
  emailGenerado: boolean;
  numeroInscripcion: string;
  categoria: string;
  activo: boolean;
}

interface MigrationStats {
  totalToProcess: number;
  processed: number;
  created: number;
  skipped: number;
  errors: number;
  batches: number;
  startTime: Date;
  endTime?: Date;
}

interface MigrationError {
  cuit: string;
  email: string;
  error: string;
  timestamp: Date;
}

// Clase principal de migración
class GeneradoresMigrator {
  private prisma: PrismaClient;
  private stats: MigrationStats;
  private errors: MigrationError[];
  private logFile: string;

  constructor() {
    this.prisma = new PrismaClient();
    this.stats = {
      totalToProcess: 0,
      processed: 0,
      created: 0,
      skipped: 0,
      errors: 0,
      batches: 0,
      startTime: new Date()
    };
    this.errors = [];

    // Crear directorio de logs si no existe
    if (!fs.existsSync(CONFIG.LOG_DIR)) {
      fs.mkdirSync(CONFIG.LOG_DIR, { recursive: true });
    }

    // Archivo de log con timestamp
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    this.logFile = path.join(CONFIG.LOG_DIR, `migration-${timestamp}.log`);
  }

  // Logging
  private log(message: string, level: 'INFO' | 'WARN' | 'ERROR' = 'INFO'): void {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}`;
    console.log(logMessage);
    fs.appendFileSync(this.logFile, logMessage + '\n');
  }

  // Crear backup de la base de datos usando spawnSync (más seguro)
  private async createBackup(label: string): Promise<string | null> {
    if (!CONFIG.CREATE_BACKUPS) {
      this.log('Backups deshabilitados, saltando...', 'WARN');
      return null;
    }

    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const backupFile = `${CONFIG.BACKUP_DIR}/migration-${label}-${timestamp}.sql.gz`;

    try {
      this.log(`Creando backup: ${backupFile}`);

      if (!CONFIG.DRY_RUN) {
        // Ejecutar pg_dump via docker de forma segura usando spawnSync
        const pgDumpResult = spawnSync('docker', [
          'exec',
          CONFIG.DB_CONTAINER,
          'pg_dump',
          '-U', CONFIG.DB_USER,
          CONFIG.DB_NAME
        ], { encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 }); // 100MB buffer

        if (pgDumpResult.error) {
          throw pgDumpResult.error;
        }

        if (pgDumpResult.status !== 0) {
          throw new Error(`pg_dump failed with status ${pgDumpResult.status}: ${pgDumpResult.stderr?.toString()}`);
        }

        // Comprimir y guardar usando gzip via spawn
        const gzipResult = spawnSync('gzip', [], {
          input: pgDumpResult.stdout,
          encoding: 'buffer'
        });

        if (gzipResult.error) {
          throw gzipResult.error;
        }

        // Escribir archivo comprimido
        fs.writeFileSync(backupFile, gzipResult.stdout);

        this.log(`✅ Backup creado: ${backupFile}`);
      } else {
        this.log(`[DRY-RUN] Crearía backup: ${backupFile}`);
      }

      return backupFile;
    } catch (error: any) {
      this.log(`⚠️ Error creando backup: ${error.message}`, 'WARN');
      return null;
    }
  }

  // Verificar estado del sistema antes de migrar
  private async checkSystemHealth(): Promise<boolean> {
    try {
      // Verificar conexión a DB
      await this.prisma.$queryRaw`SELECT 1`;
      this.log('✅ Conexión a base de datos OK');

      // Contar registros actuales
      const currentGeneradores = await this.prisma.generador.count();
      const currentUsuarios = await this.prisma.usuario.count({
        where: { rol: 'GENERADOR' }
      });

      this.log(`📊 Estado actual: ${currentGeneradores} generadores, ${currentUsuarios} usuarios GENERADOR`);

      return true;
    } catch (error: any) {
      this.log(`❌ Error verificando sistema: ${error.message}`, 'ERROR');
      return false;
    }
  }

  // Verificar si un generador ya existe
  private async generadorExists(cuit: string, email: string): Promise<{ exists: boolean; reason?: string }> {
    // Verificar por CUIT en generador
    const existingByCuit = await this.prisma.generador.findUnique({
      where: { cuit }
    });
    if (existingByCuit) {
      return { exists: true, reason: `CUIT ${cuit} ya existe en generadores` };
    }

    // Verificar por CUIT en usuario
    const existingUserByCuit = await this.prisma.usuario.findUnique({
      where: { cuit }
    });
    if (existingUserByCuit) {
      return { exists: true, reason: `CUIT ${cuit} ya existe en usuarios` };
    }

    // Verificar email (solo si no es generado)
    if (!email.endsWith('@sitrep.local')) {
      const existingByEmail = await this.prisma.usuario.findUnique({
        where: { email }
      });
      if (existingByEmail) {
        return { exists: true, reason: `Email ${email} ya existe` };
      }
    }

    return { exists: false };
  }

  // Crear un generador individual
  private async createGenerador(data: GeneradorData): Promise<boolean> {
    try {
      // Verificar si ya existe
      const { exists, reason } = await this.generadorExists(data.cuit, data.email);
      if (exists) {
        this.log(`⏭️  Saltando ${data.cuit}: ${reason}`);
        this.stats.skipped++;
        return true;
      }

      if (CONFIG.DRY_RUN) {
        this.log(`[DRY-RUN] Crearía generador: ${data.razonSocial} (${data.cuit})`);
        this.stats.created++;
        return true;
      }

      // Generar password hasheado (CUIT como password inicial)
      const hashedPassword = await bcrypt.hash(data.cuit, 10);

      // Crear usuario con generador en una transacción
      await this.prisma.$transaction(async (tx) => {
        const usuario = await tx.usuario.create({
          data: {
            email: data.email,
            password: hashedPassword,
            nombre: data.razonSocial,
            rol: 'GENERADOR' as Rol,
            cuit: data.cuit,
            activo: true,
            aprobado: true,
            generador: {
              create: {
                razonSocial: data.razonSocial,
                cuit: data.cuit,
                domicilio: data.domicilio,
                telefono: data.telefono || '',
                email: data.email,
                numeroInscripcion: data.numeroInscripcion,
                categoria: data.categoria,
                activo: true
              }
            }
          }
        });

        return usuario;
      });

      this.stats.created++;
      return true;

    } catch (error: any) {
      this.log(`❌ Error creando ${data.cuit}: ${error.message}`, 'ERROR');
      this.errors.push({
        cuit: data.cuit,
        email: data.email,
        error: error.message,
        timestamp: new Date()
      });
      this.stats.errors++;
      return false;
    }
  }

  // Procesar un lote de generadores
  private async processBatch(batch: GeneradorData[], batchNumber: number): Promise<void> {
    this.log(`\n${'='.repeat(60)}`);
    this.log(`📦 PROCESANDO LOTE ${batchNumber + 1}/${this.stats.batches} (${batch.length} registros)`);
    this.log('='.repeat(60));

    // Crear backup antes del lote
    await this.createBackup(`lote-${batchNumber + 1}`);

    let batchCreated = 0;
    let batchSkipped = 0;
    let batchErrors = 0;

    for (const generador of batch) {
      const success = await this.createGenerador(generador);
      this.stats.processed++;

      if (success) {
        if (this.stats.created > batchCreated + batchSkipped) {
          batchCreated++;
        } else {
          batchSkipped++;
        }
      } else {
        batchErrors++;
      }

      // Progreso cada 50 registros
      if (this.stats.processed % 50 === 0) {
        const progress = ((this.stats.processed / this.stats.totalToProcess) * 100).toFixed(1);
        this.log(`📊 Progreso: ${this.stats.processed}/${this.stats.totalToProcess} (${progress}%)`);
      }
    }

    this.log(`\n📊 Resumen lote ${batchNumber + 1}:`);
    this.log(`   ✅ Creados: ${batchCreated}`);
    this.log(`   ⏭️  Saltados: ${batchSkipped}`);
    this.log(`   ❌ Errores: ${batchErrors}`);
  }

  // Función principal de migración
  async migrate(dataFile: string): Promise<void> {
    this.log('🚀 Iniciando migración masiva de generadores');
    this.log(`📂 Archivo de datos: ${dataFile}`);
    this.log(`📦 Tamaño de lote: ${CONFIG.BATCH_SIZE}`);
    this.log(`⏱️  Pausa entre lotes: ${CONFIG.DELAY_BETWEEN_BATCHES}ms`);
    this.log(`🔍 Modo: ${CONFIG.DRY_RUN ? 'DRY-RUN (simulación)' : 'PRODUCCIÓN'}`);
    this.log('');

    // Verificar que el archivo existe
    if (!fs.existsSync(dataFile)) {
      throw new Error(`Archivo no encontrado: ${dataFile}`);
    }

    // Cargar datos
    const data: GeneradorData[] = JSON.parse(fs.readFileSync(dataFile, 'utf-8'));
    this.stats.totalToProcess = data.length;
    this.log(`📄 Cargados ${data.length} generadores para procesar`);

    // Verificar salud del sistema
    const healthy = await this.checkSystemHealth();
    if (!healthy) {
      throw new Error('Sistema no saludable, abortando migración');
    }

    // Crear backup GOLDEN antes de empezar
    if (!CONFIG.DRY_RUN) {
      this.log('\n🏆 Creando backup GOLDEN antes de la migración...');
      await this.createBackup('GOLDEN-pre-migracion');
    }

    // Dividir en lotes
    const batches: GeneradorData[][] = [];
    for (let i = 0; i < data.length; i += CONFIG.BATCH_SIZE) {
      batches.push(data.slice(i, i + CONFIG.BATCH_SIZE));
    }
    this.stats.batches = batches.length;

    this.log(`\n📦 Dividido en ${batches.length} lotes de hasta ${CONFIG.BATCH_SIZE} registros`);

    // Procesar lotes
    for (let i = CONFIG.START_BATCH; i < batches.length; i++) {
      await this.processBatch(batches[i], i);

      // Pausa entre lotes (excepto el último)
      if (i < batches.length - 1) {
        this.log(`⏳ Pausa de ${CONFIG.DELAY_BETWEEN_BATCHES}ms antes del siguiente lote...`);
        await new Promise(resolve => setTimeout(resolve, CONFIG.DELAY_BETWEEN_BATCHES));
      }
    }

    // Finalizar
    this.stats.endTime = new Date();
    this.printFinalStats();
    this.saveReport();
  }

  // Imprimir estadísticas finales
  private printFinalStats(): void {
    const duration = this.stats.endTime!.getTime() - this.stats.startTime.getTime();
    const durationMinutes = (duration / 1000 / 60).toFixed(2);

    this.log('\n' + '='.repeat(60));
    this.log('🏁 MIGRACIÓN COMPLETADA');
    this.log('='.repeat(60));
    this.log(`📊 Total procesados:  ${this.stats.processed}`);
    this.log(`✅ Creados:           ${this.stats.created}`);
    this.log(`⏭️  Saltados:          ${this.stats.skipped}`);
    this.log(`❌ Errores:           ${this.stats.errors}`);
    this.log(`⏱️  Duración:          ${durationMinutes} minutos`);
    this.log(`📝 Log guardado en:   ${this.logFile}`);
    this.log('='.repeat(60));
  }

  // Guardar reporte de errores
  private saveReport(): void {
    if (this.errors.length > 0) {
      const errorFile = this.logFile.replace('.log', '-errors.json');
      fs.writeFileSync(errorFile, JSON.stringify(this.errors, null, 2));
      this.log(`⚠️  Errores guardados en: ${errorFile}`);
    }

    // Guardar estadísticas completas
    const statsFile = this.logFile.replace('.log', '-stats.json');
    fs.writeFileSync(statsFile, JSON.stringify({
      stats: this.stats,
      errors: this.errors.length,
      config: CONFIG
    }, null, 2));
    this.log(`📊 Estadísticas guardadas en: ${statsFile}`);
  }

  // Desconectar
  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Parsear argumentos de línea de comandos
function parseArgs(): { dataFile: string } {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Uso: npx tsx scripts/migration/migrate-generadores.ts <archivo.json> [opciones]');
    console.error('');
    console.error('Opciones:');
    console.error('  --batch-size <n>     Tamaño del lote (default: 200)');
    console.error('  --start-batch <n>    Iniciar desde lote N (para reanudar)');
    console.error('  --delay <ms>         Pausa entre lotes en ms (default: 2000)');
    console.error('  --dry-run            Simular sin escribir en DB');
    console.error('  --no-backup          No crear backups (solo para pruebas)');
    console.error('');
    console.error('Ejemplo:');
    console.error('  npx tsx scripts/migration/migrate-generadores.ts generadores-transformados.json --batch-size 100 --dry-run');
    process.exit(1);
  }

  const dataFile = args[0];

  // Parsear opciones
  for (let i = 1; i < args.length; i++) {
    switch (args[i]) {
      case '--batch-size':
        CONFIG.BATCH_SIZE = parseInt(args[++i], 10);
        break;
      case '--start-batch':
        CONFIG.START_BATCH = parseInt(args[++i], 10);
        break;
      case '--delay':
        CONFIG.DELAY_BETWEEN_BATCHES = parseInt(args[++i], 10);
        break;
      case '--dry-run':
        CONFIG.DRY_RUN = true;
        break;
      case '--no-backup':
        CONFIG.CREATE_BACKUPS = false;
        break;
    }
  }

  return { dataFile };
}

// Punto de entrada principal
async function main(): Promise<void> {
  const { dataFile } = parseArgs();

  const migrator = new GeneradoresMigrator();

  try {
    await migrator.migrate(dataFile);
    console.log('\n✅ Migración completada exitosamente');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error fatal durante la migración:', error.message);
    process.exit(1);
  } finally {
    await migrator.disconnect();
  }
}

main();
