/**
 * SITREP - Recordatorio de retiros programados
 *
 * Cron: cada 6 horas (0:00, 6:00, 12:00, 18:00)
 * Solo instancia PM2 0 para evitar duplicados.
 *
 * Busca manifiestos APROBADOS con fechaEstimadaRetiro en las proximas 24h
 * y notifica al transportista (con link a mapa) y al generador.
 * Deduplicacion via busqueda en notificaciones existentes.
 */

import cron from 'node-cron';
import prisma from '../lib/prisma';
import { notificationService } from '../controllers/notification.controller';

export function iniciarRecordatorioJob(): void {
  const instanceId = process.env.NODE_APP_INSTANCE || process.env.pm_id || '0';
  if (instanceId !== '0') {
    console.log(`[RecordatorioJob] PM2 instancia ${instanceId}, skipping cron`);
    return;
  }

  // Cada 6 horas: 0:00, 6:00, 12:00, 18:00
  cron.schedule('0 */6 * * *', async () => {
    try {
      await ejecutarRecordatorios();
    } catch (err) {
      console.error('[RecordatorioJob] Error:', err);
    }
  });

  console.log('[RecordatorioJob] Cron iniciado (cada 6h, solo instancia 0)');
}

export async function ejecutarRecordatorios(): Promise<number> {
  const ahora = new Date();
  const en24h = new Date(ahora.getTime() + 24 * 60 * 60 * 1000);

  const manifiestos = await prisma.manifiesto.findMany({
    where: {
      estado: 'APROBADO',
      fechaEstimadaRetiro: { gte: ahora, lte: en24h },
    },
    include: {
      generador: { include: { usuario: true } },
      transportista: { include: { usuario: true } },
      operador: { include: { usuario: true } },
    },
  });

  let enviados = 0;

  for (const m of manifiestos) {
    // Deduplicar: no enviar si ya existe recordatorio para este manifiesto
    const yaNotificado = await prisma.notificacion.count({
      where: {
        manifiestoId: m.id,
        datos: { contains: 'recordatorio_retiro' },
      },
    });
    if (yaNotificado > 0) continue;

    const fecha = m.fechaEstimadaRetiro!.toLocaleDateString('es-AR');
    const gen = m.generador;
    const trans = m.transportista;

    const mapsUrl = gen.latitud && gen.longitud
      ? `https://maps.google.com/?q=${gen.latitud},${gen.longitud}`
      : null;

    // Notificar transportista con ubicacion (solo si hay transportista — no aplica para IN_SITU)
    if (trans) {
      await notificationService.crearNotificacion({
        usuarioId: trans.usuario.id,
        tipo: 'ALERTA_SISTEMA',
        titulo: 'Recordatorio: retiro manana',
        mensaje: `${m.numero} — Retiro: ${fecha}. ${gen.razonSocial}, ${gen.domicilio || ''}`.trim(),
        manifiestoId: m.id,
        prioridad: 'ALTA',
        datos: {
          tipo: 'recordatorio_retiro',
          fechaRetiro: fecha,
          direccion: gen.domicilio || null,
          lat: gen.latitud,
          lng: gen.longitud,
          mapsUrl,
          generador: gen.razonSocial,
        },
      });
    }

    // Notificar generador
    await notificationService.crearNotificacion({
      usuarioId: gen.usuario.id,
      tipo: 'ALERTA_SISTEMA',
      titulo: 'Recordatorio: retiro programado manana',
      mensaje: `${m.numero} — ${trans ? `El transportista ${trans.razonSocial} retirara` : 'Operador in situ trabajara'} manana ${fecha}`,
      manifiestoId: m.id,
      prioridad: 'NORMAL',
      datos: { tipo: 'recordatorio_retiro', fechaRetiro: fecha },
    });

    enviados++;
  }

  if (enviados > 0) {
    console.log(`[RecordatorioJob] ${enviados} manifiestos con recordatorio enviado`);
  }

  return enviados;
}
