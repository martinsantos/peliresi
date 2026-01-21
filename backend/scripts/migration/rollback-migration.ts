/**
 * Script de Rollback de Migración
 *
 * Permite revertir una migración masiva de generadores de dos formas:
 *
 * 1. ROLLBACK COMPLETO: Restaura un backup de la base de datos
 * 2. ROLLBACK PARCIAL: Elimina solo los generadores creados después de una fecha
 *
 * Uso:
 *   npx tsx scripts/migration/rollback-migration.ts <modo> [opciones]
 *
 * Modos:
 *   --full <backup.sql.gz>    Restaurar backup completo
 *   --partial                 Eliminar generadores por fecha
 *
 * Opciones (modo parcial):
 *   --after <fecha>           Eliminar generadores creados después de esta fecha (ISO 8601)
 *   --dry-run                 Simular sin hacer cambios
 *   --no-confirm              No pedir confirmación (peligroso)
 *
 * Ejemplos:
 *   npx tsx scripts/migration/rollback-migration.ts --full /backups/GOLDEN-pre-migracion.sql.gz
 *   npx tsx scripts/migration/rollback-migration.ts --partial --after "2026-01-21T00:00:00Z" --dry-run
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import { spawnSync } from 'child_process';
import readline from 'readline';

// Configuración
const CONFIG = {
  DB_CONTAINER: 'directus-admin-database-1',
  DB_USER: 'directus',
  DB_NAME: 'trazabilidad_demo',
  DRY_RUN: false,
  NO_CONFIRM: false,
  BACKUP_DIR: '/backups'
};

class MigrationRollback {
  private prisma: PrismaClient;

  constructor() {
    this.prisma = new PrismaClient();
  }

  // Pedir confirmación al usuario
  private async confirm(message: string): Promise<boolean> {
    if (CONFIG.NO_CONFIRM) return true;

    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout
    });

    return new Promise((resolve) => {
      rl.question(`${message} (escribe "SI" para confirmar): `, (answer) => {
        rl.close();
        resolve(answer.toUpperCase() === 'SI');
      });
    });
  }

  // Rollback completo: restaurar backup
  async fullRollback(backupFile: string): Promise<void> {
    console.log('🔄 Iniciando ROLLBACK COMPLETO...\n');
    console.log(`📂 Archivo de backup: ${backupFile}`);

    // Verificar que el archivo existe
    if (!fs.existsSync(backupFile)) {
      throw new Error(`Archivo de backup no encontrado: ${backupFile}`);
    }

    // Obtener estadísticas actuales
    const currentStats = await this.getCurrentStats();
    console.log('\n📊 Estado ACTUAL de la base de datos:');
    console.log(`   Generadores: ${currentStats.generadores}`);
    console.log(`   Usuarios GENERADOR: ${currentStats.usuarios}`);
    console.log(`   Total usuarios: ${currentStats.totalUsuarios}`);

    console.log('\n⚠️  ADVERTENCIA: Este proceso REEMPLAZARÁ toda la base de datos');
    console.log('   Todos los datos actuales serán perdidos y reemplazados por el backup.\n');

    if (CONFIG.DRY_RUN) {
      console.log('[DRY-RUN] Se restauraría el backup pero no se harán cambios.');
      return;
    }

    const confirmed = await this.confirm('¿Estás seguro de continuar?');
    if (!confirmed) {
      console.log('❌ Rollback cancelado por el usuario.');
      return;
    }

    try {
      console.log('\n🔄 Restaurando backup...');

      // Primero crear un backup de seguridad del estado actual
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const safetyBackup = `${CONFIG.BACKUP_DIR}/safety-before-rollback-${timestamp}.sql.gz`;

      console.log(`📦 Creando backup de seguridad: ${safetyBackup}`);

      // Backup actual usando spawnSync (seguro)
      const pgDumpResult = spawnSync('docker', [
        'exec',
        CONFIG.DB_CONTAINER,
        'pg_dump',
        '-U', CONFIG.DB_USER,
        CONFIG.DB_NAME
      ], { encoding: 'buffer', maxBuffer: 100 * 1024 * 1024 });

      if (pgDumpResult.error || pgDumpResult.status !== 0) {
        console.log('⚠️  No se pudo crear backup de seguridad, continuando...');
      } else {
        const gzipResult = spawnSync('gzip', [], {
          input: pgDumpResult.stdout,
          encoding: 'buffer'
        });
        fs.writeFileSync(safetyBackup, gzipResult.stdout);
        console.log(`✅ Backup de seguridad creado: ${safetyBackup}`);
      }

      // Leer y descomprimir el backup
      console.log('\n📂 Leyendo archivo de backup...');
      const gunzipResult = spawnSync('gunzip', ['-c', backupFile], {
        encoding: 'buffer',
        maxBuffer: 500 * 1024 * 1024 // 500MB
      });

      if (gunzipResult.error || gunzipResult.status !== 0) {
        throw new Error(`Error descomprimiendo backup: ${gunzipResult.stderr?.toString()}`);
      }

      // Restaurar en la base de datos
      console.log('🔄 Restaurando en base de datos...');

      // Primero, eliminar y recrear la base de datos para un restore limpio
      const dropResult = spawnSync('docker', [
        'exec', CONFIG.DB_CONTAINER,
        'psql', '-U', CONFIG.DB_USER, '-d', 'postgres',
        '-c', `DROP DATABASE IF EXISTS ${CONFIG.DB_NAME}`
      ], { encoding: 'utf-8' });

      const createResult = spawnSync('docker', [
        'exec', CONFIG.DB_CONTAINER,
        'psql', '-U', CONFIG.DB_USER, '-d', 'postgres',
        '-c', `CREATE DATABASE ${CONFIG.DB_NAME} OWNER ${CONFIG.DB_USER}`
      ], { encoding: 'utf-8' });

      // Restaurar backup
      const restoreResult = spawnSync('docker', [
        'exec', '-i', CONFIG.DB_CONTAINER,
        'psql', '-U', CONFIG.DB_USER, '-d', CONFIG.DB_NAME
      ], {
        input: gunzipResult.stdout,
        encoding: 'buffer',
        maxBuffer: 500 * 1024 * 1024
      });

      if (restoreResult.error) {
        throw new Error(`Error restaurando backup: ${restoreResult.error.message}`);
      }

      console.log('✅ Backup restaurado exitosamente');

      // Verificar estado después del rollback
      await this.prisma.$disconnect();
      this.prisma = new PrismaClient();

      const newStats = await this.getCurrentStats();
      console.log('\n📊 Estado DESPUÉS del rollback:');
      console.log(`   Generadores: ${newStats.generadores}`);
      console.log(`   Usuarios GENERADOR: ${newStats.usuarios}`);
      console.log(`   Total usuarios: ${newStats.totalUsuarios}`);

      console.log('\n✅ ROLLBACK COMPLETO EXITOSO');

    } catch (error: any) {
      console.error('\n❌ Error durante el rollback:', error.message);
      throw error;
    }
  }

  // Rollback parcial: eliminar por fecha
  async partialRollback(afterDate: Date): Promise<void> {
    console.log('🔄 Iniciando ROLLBACK PARCIAL...\n');
    console.log(`📅 Eliminando generadores creados después de: ${afterDate.toISOString()}`);

    // Obtener estadísticas actuales
    const currentStats = await this.getCurrentStats();
    console.log('\n📊 Estado ACTUAL de la base de datos:');
    console.log(`   Generadores: ${currentStats.generadores}`);
    console.log(`   Usuarios GENERADOR: ${currentStats.usuarios}`);

    // Contar registros a eliminar
    const generadoresToDelete = await this.prisma.generador.count({
      where: {
        createdAt: { gte: afterDate }
      }
    });

    const usuariosToDelete = await this.prisma.usuario.count({
      where: {
        rol: 'GENERADOR',
        createdAt: { gte: afterDate }
      }
    });

    console.log('\n📋 Registros a eliminar:');
    console.log(`   Generadores: ${generadoresToDelete}`);
    console.log(`   Usuarios: ${usuariosToDelete}`);

    if (generadoresToDelete === 0 && usuariosToDelete === 0) {
      console.log('\n⚠️  No hay registros para eliminar con los criterios especificados.');
      return;
    }

    // Verificar que no tienen manifiestos asociados
    const generadoresConManifiestos = await this.prisma.generador.findMany({
      where: {
        createdAt: { gte: afterDate },
        manifiestos: { some: {} }
      },
      select: { cuit: true, razonSocial: true }
    });

    if (generadoresConManifiestos.length > 0) {
      console.log('\n⚠️  ADVERTENCIA: Hay generadores con manifiestos asociados:');
      generadoresConManifiestos.forEach(g => {
        console.log(`   - ${g.razonSocial} (${g.cuit})`);
      });
      console.log('\n   Estos generadores NO serán eliminados para preservar la integridad.');
    }

    if (CONFIG.DRY_RUN) {
      console.log('\n[DRY-RUN] Se eliminarían los registros pero no se harán cambios.');

      // Mostrar muestra de lo que se eliminaría
      const sample = await this.prisma.generador.findMany({
        where: {
          createdAt: { gte: afterDate },
          manifiestos: { none: {} }
        },
        take: 5,
        select: { cuit: true, razonSocial: true, createdAt: true }
      });

      console.log('\n📋 Muestra de generadores a eliminar:');
      sample.forEach(g => {
        console.log(`   - ${g.razonSocial} (${g.cuit}) - Creado: ${g.createdAt.toISOString()}`);
      });

      return;
    }

    const confirmed = await this.confirm(`¿Eliminar ${generadoresToDelete} generadores y ${usuariosToDelete} usuarios?`);
    if (!confirmed) {
      console.log('❌ Rollback cancelado por el usuario.');
      return;
    }

    try {
      console.log('\n🔄 Ejecutando rollback parcial...');

      // Usar transacción para garantizar atomicidad
      const result = await this.prisma.$transaction(async (tx) => {
        // 1. Obtener IDs de generadores a eliminar (sin manifiestos)
        const generadoresAEliminar = await tx.generador.findMany({
          where: {
            createdAt: { gte: afterDate },
            manifiestos: { none: {} }
          },
          select: { id: true, usuarioId: true }
        });

        const generadorIds = generadoresAEliminar.map(g => g.id);
        const usuarioIds = generadoresAEliminar.map(g => g.usuarioId);

        // 2. Eliminar generadores
        const deletedGeneradores = await tx.generador.deleteMany({
          where: { id: { in: generadorIds } }
        });

        // 3. Eliminar usuarios asociados
        const deletedUsuarios = await tx.usuario.deleteMany({
          where: { id: { in: usuarioIds } }
        });

        return {
          generadores: deletedGeneradores.count,
          usuarios: deletedUsuarios.count
        };
      });

      console.log('\n✅ Rollback parcial completado:');
      console.log(`   Generadores eliminados: ${result.generadores}`);
      console.log(`   Usuarios eliminados: ${result.usuarios}`);

      // Estadísticas finales
      const newStats = await this.getCurrentStats();
      console.log('\n📊 Estado DESPUÉS del rollback:');
      console.log(`   Generadores: ${newStats.generadores}`);
      console.log(`   Usuarios GENERADOR: ${newStats.usuarios}`);

      console.log('\n✅ ROLLBACK PARCIAL EXITOSO');

    } catch (error: any) {
      console.error('\n❌ Error durante el rollback:', error.message);
      throw error;
    }
  }

  // Obtener estadísticas actuales
  private async getCurrentStats(): Promise<{
    generadores: number;
    usuarios: number;
    totalUsuarios: number;
  }> {
    const [generadores, usuarios, totalUsuarios] = await Promise.all([
      this.prisma.generador.count(),
      this.prisma.usuario.count({ where: { rol: 'GENERADOR' } }),
      this.prisma.usuario.count()
    ]);

    return { generadores, usuarios, totalUsuarios };
  }

  // Listar backups disponibles
  async listBackups(): Promise<void> {
    console.log('📂 Backups disponibles:\n');

    try {
      const lsResult = spawnSync('ls', ['-la', CONFIG.BACKUP_DIR], { encoding: 'utf-8' });

      if (lsResult.error || lsResult.status !== 0) {
        console.log('⚠️  No se pudo listar el directorio de backups');
        return;
      }

      // Filtrar solo archivos .sql.gz
      const lines = lsResult.stdout.split('\n');
      const backups = lines.filter(line => line.includes('.sql.gz'));

      if (backups.length === 0) {
        console.log('   No hay backups disponibles');
        return;
      }

      backups.forEach(line => {
        console.log(`   ${line}`);
      });

    } catch (error: any) {
      console.log(`⚠️  Error listando backups: ${error.message}`);
    }
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Parsear argumentos
function parseArgs(): { mode: 'full' | 'partial' | 'list'; backupFile?: string; afterDate?: Date } {
  const args = process.argv.slice(2);

  if (args.length === 0 || args.includes('--help') || args.includes('-h')) {
    console.log('Uso: npx tsx scripts/migration/rollback-migration.ts <modo> [opciones]\n');
    console.log('Modos:');
    console.log('  --full <backup.sql.gz>    Restaurar backup completo');
    console.log('  --partial                 Eliminar generadores por fecha');
    console.log('  --list                    Listar backups disponibles\n');
    console.log('Opciones (modo parcial):');
    console.log('  --after <fecha>           Fecha ISO 8601 (ej: 2026-01-21T00:00:00Z)');
    console.log('  --dry-run                 Simular sin hacer cambios');
    console.log('  --no-confirm              No pedir confirmación\n');
    console.log('Ejemplos:');
    console.log('  npx tsx scripts/migration/rollback-migration.ts --list');
    console.log('  npx tsx scripts/migration/rollback-migration.ts --full /backups/GOLDEN.sql.gz');
    console.log('  npx tsx scripts/migration/rollback-migration.ts --partial --after "2026-01-21" --dry-run');
    process.exit(0);
  }

  let mode: 'full' | 'partial' | 'list' = 'list';
  let backupFile: string | undefined;
  let afterDate: Date | undefined;

  for (let i = 0; i < args.length; i++) {
    switch (args[i]) {
      case '--full':
        mode = 'full';
        backupFile = args[++i];
        break;
      case '--partial':
        mode = 'partial';
        break;
      case '--list':
        mode = 'list';
        break;
      case '--after':
        afterDate = new Date(args[++i]);
        break;
      case '--dry-run':
        CONFIG.DRY_RUN = true;
        break;
      case '--no-confirm':
        CONFIG.NO_CONFIRM = true;
        break;
    }
  }

  // Validaciones
  if (mode === 'full' && !backupFile) {
    console.error('❌ Error: modo --full requiere especificar archivo de backup');
    process.exit(1);
  }

  if (mode === 'partial' && !afterDate) {
    console.error('❌ Error: modo --partial requiere especificar --after <fecha>');
    process.exit(1);
  }

  if (afterDate && isNaN(afterDate.getTime())) {
    console.error('❌ Error: fecha inválida. Use formato ISO 8601 (ej: 2026-01-21T00:00:00Z)');
    process.exit(1);
  }

  return { mode, backupFile, afterDate };
}

// Punto de entrada principal
async function main(): Promise<void> {
  const { mode, backupFile, afterDate } = parseArgs();

  const rollback = new MigrationRollback();

  try {
    switch (mode) {
      case 'list':
        await rollback.listBackups();
        break;
      case 'full':
        await rollback.fullRollback(backupFile!);
        break;
      case 'partial':
        await rollback.partialRollback(afterDate!);
        break;
    }

    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Error fatal:', error.message);
    process.exit(1);
  } finally {
    await rollback.disconnect();
  }
}

main();
