/**
 * CronService - CU-S10: Reportes Automáticos y CU-S11: Backups
 * Servicio de tareas programadas
 */

import cron from 'node-cron';
import { PrismaClient } from '@prisma/client';
import { exec } from 'child_process';
import { promisify } from 'util';
import fs from 'fs';
import path from 'path';
import { pushService } from './push.service';

const execAsync = promisify(exec);
const prisma = new PrismaClient();

// Directorio para backups
const BACKUP_DIR = process.env.BACKUP_DIR || path.join(__dirname, '../../backups');

// Asegurar que el directorio de backups existe
function ensureBackupDir(): void {
  if (!fs.existsSync(BACKUP_DIR)) {
    fs.mkdirSync(BACKUP_DIR, { recursive: true });
    console.log(`[CronService] Created backup directory: ${BACKUP_DIR}`);
  }
}

// Tipo para las tareas
type ScheduledTask = ReturnType<typeof cron.schedule>;

/**
 * Tareas programadas del sistema
 */
export const cronService = {
  // Referencia a las tareas para poder detenerlas
  tasks: {} as Record<string, ScheduledTask>,

  /**
   * Inicializar todas las tareas CRON
   */
  initialize(): void {
    console.log('[CronService] Initializing scheduled tasks...');
    ensureBackupDir();

    // ═══ REPORTES AUTOMÁTICOS ═══

    // Reporte diario de manifiestos vencidos (8:00 AM)
    this.tasks['reporteVencimientos'] = cron.schedule('0 8 * * *', async () => {
      console.log('[CronService] Running daily expiration report...');
      await this.ejecutarReporteVencimientos();
    });

    // Evaluación de tiempos excesivos (cada 4 horas)
    this.tasks['evaluarTiempos'] = cron.schedule('0 */4 * * *', async () => {
      console.log('[CronService] Running time evaluation...');
      await this.evaluarTiemposExcesivos();
    });

    // Reporte semanal de estadísticas (Lunes 9:00 AM)
    this.tasks['reporteSemanal'] = cron.schedule('0 9 * * 1', async () => {
      console.log('[CronService] Running weekly stats report...');
      await this.ejecutarReporteSemanal();
    });

    // ═══ BACKUPS AUTOMÁTICOS ═══

    // Backup diario de base de datos (3:00 AM)
    this.tasks['backupDiario'] = cron.schedule('0 3 * * *', async () => {
      console.log('[CronService] Running daily backup...');
      await this.ejecutarBackup('daily');
    });

    // Backup semanal completo (Domingos 2:00 AM)
    this.tasks['backupSemanal'] = cron.schedule('0 2 * * 0', async () => {
      console.log('[CronService] Running weekly backup...');
      await this.ejecutarBackup('weekly');
    });

    // Limpieza de backups antiguos (Primer día de cada mes a las 4:00 AM)
    this.tasks['limpiezaBackups'] = cron.schedule('0 4 1 * *', async () => {
      console.log('[CronService] Running backup cleanup...');
      await this.limpiarBackupsAntiguos();
    });

    // ═══ ROTACIÓN DE LOGS (ESCALABILIDAD) ═══

    // Limpiar analytics_logs > 30 días (Diario a las 3:30 AM)
    this.tasks['rotacionLogs'] = cron.schedule('30 3 * * *', async () => {
      console.log('[CronService] Running log rotation...');
      await this.rotarLogs();
    });

    console.log('[CronService] All scheduled tasks initialized');
  },

  /**
   * Detener todas las tareas
   */
  stop(): void {
    console.log('[CronService] Stopping all tasks...');
    Object.values(this.tasks).forEach(task => task.stop());
    console.log('[CronService] All tasks stopped');
  },

  /**
   * Ejecutar tarea manualmente
   */
  async runTask(taskName: string): Promise<{ success: boolean; message: string }> {
    switch (taskName) {
      case 'reporteVencimientos':
        await this.ejecutarReporteVencimientos();
        return { success: true, message: 'Reporte de vencimientos ejecutado' };
      case 'evaluarTiempos':
        await this.evaluarTiemposExcesivos();
        return { success: true, message: 'Evaluación de tiempos ejecutada' };
      case 'reporteSemanal':
        await this.ejecutarReporteSemanal();
        return { success: true, message: 'Reporte semanal ejecutado' };
      case 'backupDiario':
        await this.ejecutarBackup('daily');
        return { success: true, message: 'Backup diario ejecutado' };
      case 'backupSemanal':
        await this.ejecutarBackup('weekly');
        return { success: true, message: 'Backup semanal ejecutado' };
      case 'rotacionLogs':
        await this.rotarLogs();
        return { success: true, message: 'Rotación de logs ejecutada' };
      default:
        return { success: false, message: `Tarea '${taskName}' no encontrada` };
    }
  },

  // ═══ IMPLEMENTACIÓN DE TAREAS ═══

  /**
   * Obtener usuarios admin para notificaciones del sistema
   */
  async getAdminUsers(): Promise<Array<{ id: string }>> {
    return prisma.usuario.findMany({
      where: { rol: 'ADMIN', activo: true },
      select: { id: true }
    });
  },

  /**
   * Crear notificación para todos los admins
   */
  async notificarAdmins(titulo: string, mensaje: string, manifiestoId?: string): Promise<void> {
    const admins = await this.getAdminUsers();
    for (const admin of admins) {
      await prisma.notificacion.create({
        data: {
          titulo,
          mensaje,
          tipo: 'ANOMALIA_DETECTADA',
          leida: false,
          usuarioId: admin.id,
          manifiestoId
        }
      });
    }
  },

  /**
   * CU-S09: Evaluar manifiestos próximos a vencer
   */
  async ejecutarReporteVencimientos(): Promise<void> {
    try {
      const diasAlerta = 7;
      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() - (30 - diasAlerta)); // Manifiestos creados hace más de 23 días

      const manifestosPorVencer = await prisma.manifiesto.findMany({
        where: {
          estado: { in: ['BORRADOR', 'APROBADO', 'EN_TRANSITO'] },
          createdAt: { lte: fechaLimite }
        },
        include: { generador: true }
      });

      if (manifestosPorVencer.length > 0) {
        console.log(`[CronService] Found ${manifestosPorVencer.length} manifests expiring soon`);

        // Notificar a administradores via push
        await pushService.sendToRole('ADMIN', {
          title: '⚠️ Manifiestos por Vencer',
          body: `${manifestosPorVencer.length} manifiesto(s) próximo(s) a vencer`,
          data: { url: '/alertas', tipo: 'vencimiento' }
        });

        // Crear notificaciones en la base de datos para cada admin
        for (const manifiesto of manifestosPorVencer) {
          await this.notificarAdmins(
            'Manifiesto por vencer',
            `El manifiesto ${manifiesto.numero} está próximo a vencer`,
            manifiesto.id
          );
        }
      }
    } catch (error) {
      console.error('[CronService] Error in vencimientos report:', error);
    }
  },

  /**
   * CU-S08: Evaluar tiempos excesivos en tránsito
   */
  async evaluarTiemposExcesivos(): Promise<void> {
    try {
      const horasMaxTransito = 48;
      const fechaLimite = new Date(Date.now() - horasMaxTransito * 60 * 60 * 1000);

      const manifestosExcedidos = await prisma.manifiesto.findMany({
        where: {
          estado: 'EN_TRANSITO',
          fechaRetiro: { lte: fechaLimite }
        },
        include: { transportista: true, generador: true }
      });

      if (manifestosExcedidos.length > 0) {
        console.log(`[CronService] Found ${manifestosExcedidos.length} manifests with excessive transit time`);

        for (const manifiesto of manifestosExcedidos) {
          // Crear notificación para admins
          await this.notificarAdmins(
            'Tiempo excesivo en tránsito',
            `El manifiesto ${manifiesto.numero} excede ${horasMaxTransito}h en tránsito`,
            manifiesto.id
          );

          // Notificar via push
          await pushService.sendToRole('ADMIN', {
            title: '🚨 Tiempo Excesivo',
            body: `${manifiesto.numero} lleva más de ${horasMaxTransito}h en tránsito`,
            data: { url: '/tracking', manifiestoId: manifiesto.id }
          });
        }
      }
    } catch (error) {
      console.error('[CronService] Error evaluating transit times:', error);
    }
  },

  /**
   * Reporte semanal de estadísticas
   */
  async ejecutarReporteSemanal(): Promise<void> {
    try {
      const hace7dias = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

      const [creados, completados, notificaciones] = await prisma.$transaction([
        prisma.manifiesto.count({ where: { createdAt: { gte: hace7dias } } }),
        prisma.manifiesto.count({ where: { estado: 'TRATADO', fechaCierre: { gte: hace7dias } } }),
        prisma.notificacion.count({ where: { createdAt: { gte: hace7dias } } })
      ]);

      console.log(`[CronService] Weekly report: Created=${creados}, Completed=${completados}, Notifications=${notificaciones}`);

      // Notificar a administradores
      await pushService.sendToRole('ADMIN', {
        title: '📊 Resumen Semanal SITREP',
        body: `Manifiestos: ${creados} nuevos, ${completados} completados. ${notificaciones} notificaciones.`,
        data: { url: '/reportes', tipo: 'semanal' }
      });

    } catch (error) {
      console.error('[CronService] Error in weekly report:', error);
    }
  },

  /**
   * CU-S11: Backup automático de base de datos
   */
  async ejecutarBackup(tipo: 'daily' | 'weekly'): Promise<void> {
    try {
      ensureBackupDir();

      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const filename = `sitrep_${tipo}_${timestamp}.sql`;
      const filepath = path.join(BACKUP_DIR, filename);

      const databaseUrl = process.env.DATABASE_URL || '';

      // Extraer credenciales de DATABASE_URL
      const match = databaseUrl.match(/postgresql:\/\/([^:]+):([^@]+)@([^:]+):(\d+)\/([^?]+)/);

      if (!match) {
        console.error('[CronService] Invalid DATABASE_URL format, using fallback backup');
        await this.backupFallback(filepath);
        return;
      }

      const [, user, password, host, port, database] = match;

      // Ejecutar pg_dump
      const command = `PGPASSWORD="${password}" pg_dump -h ${host} -p ${port} -U ${user} -d ${database} -f "${filepath}"`;

      try {
        await execAsync(command);
        console.log(`[CronService] Backup created: ${filepath}`);

        // Comprimir si es backup semanal
        if (tipo === 'weekly') {
          try {
            await execAsync(`gzip "${filepath}"`);
            console.log(`[CronService] Backup compressed: ${filepath}.gz`);
          } catch {
            console.log('[CronService] gzip not available, skipping compression');
          }
        }

      } catch (execError: any) {
        console.error('[CronService] Backup command failed:', execError.message);
        await this.backupFallback(filepath);
      }

    } catch (error) {
      console.error('[CronService] Error in backup:', error);
    }
  },

  /**
   * Backup de fallback exportando datos a JSON
   */
  async backupFallback(filepath: string): Promise<void> {
    try {
      const data = {
        timestamp: new Date().toISOString(),
        manifiestos: await prisma.manifiesto.findMany({
          take: 1000,
          orderBy: { createdAt: 'desc' }
        }),
        usuarios: await prisma.usuario.findMany({
          select: { id: true, email: true, rol: true, activo: true, createdAt: true }
        }),
        notificaciones: await prisma.notificacion.findMany({
          where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } },
          take: 500
        })
      };

      const jsonPath = filepath.replace('.sql', '.json');
      fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2));
      console.log(`[CronService] Fallback backup created: ${jsonPath}`);
    } catch (error) {
      console.error('[CronService] Fallback backup failed:', error);
    }
  },

  /**
   * Limpiar backups antiguos (mantener últimos 30 días)
   */
  async limpiarBackupsAntiguos(): Promise<void> {
    try {
      if (!fs.existsSync(BACKUP_DIR)) return;

      const files = fs.readdirSync(BACKUP_DIR);
      const now = Date.now();
      const diasRetener = 30;
      let deleted = 0;

      for (const file of files) {
        const filepath = path.join(BACKUP_DIR, file);
        const stats = fs.statSync(filepath);
        const ageInDays = (now - stats.mtime.getTime()) / (24 * 60 * 60 * 1000);

        if (ageInDays > diasRetener) {
          fs.unlinkSync(filepath);
          deleted++;
          console.log(`[CronService] Deleted old backup: ${file}`);
        }
      }

      console.log(`[CronService] Backup cleanup completed, deleted ${deleted} files`);
    } catch (error) {
      console.error('[CronService] Error cleaning backups:', error);
    }
  },

  /**
   * ESCALABILIDAD: Rotación de logs de analytics y actividad
   * Elimina registros con más de 30 días para mantener BD optimizada
   */
  async rotarLogs(): Promise<void> {
    try {
      const cutoffDate = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000); // 30 días

      // Eliminar AnalyticsLog antiguos
      const deletedAnalytics = await prisma.analyticsLog.deleteMany({
        where: { timestamp: { lt: cutoffDate } }
      });

      // Eliminar LogActividad antiguos (nivel DEBUG/INFO solamente)
      const deletedActivity = await prisma.logActividad.deleteMany({
        where: {
          timestamp: { lt: cutoffDate },
          severidad: { in: ['DEBUG', 'INFO'] }
        }
      });

      console.log(`[CronService] Log rotation completed: ${deletedAnalytics.count} analytics logs, ${deletedActivity.count} activity logs deleted`);

      // Si se eliminaron muchos registros, notificar a admins
      const totalDeleted = deletedAnalytics.count + deletedActivity.count;
      if (totalDeleted > 1000) {
        await this.notificarAdmins(
          'Rotación de Logs Completada',
          `Se eliminaron ${totalDeleted.toLocaleString()} registros antiguos para optimizar la base de datos.`
        );
      }

    } catch (error) {
      console.error('[CronService] Error in log rotation:', error);
    }
  },

  /**
   * Obtener estado de las tareas
   */
  getStatus(): Array<{ name: string; schedule: string; description: string }> {
    const taskInfo: Record<string, { schedule: string; description: string }> = {
      reporteVencimientos: { schedule: 'Diario 8:00 AM', description: 'Evalúa manifiestos próximos a vencer' },
      evaluarTiempos: { schedule: 'Cada 4 horas', description: 'Detecta tiempos excesivos en tránsito' },
      reporteSemanal: { schedule: 'Lunes 9:00 AM', description: 'Genera resumen semanal de actividad' },
      backupDiario: { schedule: 'Diario 3:00 AM', description: 'Backup incremental de base de datos' },
      backupSemanal: { schedule: 'Domingo 2:00 AM', description: 'Backup completo comprimido' },
      limpiezaBackups: { schedule: 'Mensual día 1 4:00 AM', description: 'Elimina backups con más de 30 días' },
      rotacionLogs: { schedule: 'Diario 3:30 AM', description: 'Elimina logs de analytics > 30 días (escalabilidad)' }
    };

    return Object.entries(this.tasks).map(([name]) => ({
      name,
      schedule: taskInfo[name]?.schedule || 'Unknown',
      description: taskInfo[name]?.description || ''
    }));
  }
};

export default cronService;
