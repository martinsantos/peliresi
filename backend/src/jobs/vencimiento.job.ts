import cron from 'node-cron';
import prisma from '../lib/prisma';
import { domainEvents } from '../services/domainEvent.service';

const DIAS_ANTICIPACION = 30;

export function iniciarVencimientoJob(): void {
  // Solo ejecutar en instancia 0 de PM2 cluster para evitar duplicación
  if (process.env.pm_id && process.env.pm_id !== '0') {
    console.log('[VencimientoJob] Instancia PM2 no-0, skipping cron');
    return;
  }

  // Ejecutar diariamente a las 8:00
  cron.schedule('0 8 * * *', async () => {
    console.log('[VencimientoJob] Verificando vencimientos...');
    try {
      await verificarVencimientos();
    } catch (err: any) {
      console.error('[VencimientoJob] Error:', err.message);
    }
  });

  console.log('[VencimientoJob] Cron registrado (diario 8:00)');
}

export async function verificarVencimientos(): Promise<void> {
  const ahora = new Date();
  const limite = new Date(ahora.getTime() + DIAS_ANTICIPACION * 86_400_000);

  // Transportistas con habilitación próxima a vencer
  const transportistas = await prisma.transportista.findMany({
    where: {
      vencimientoHabilitacion: { lte: limite, gte: ahora },
    },
    select: { id: true, razonSocial: true, vencimientoHabilitacion: true },
  });

  for (const t of transportistas) {
    const dias = Math.ceil((t.vencimientoHabilitacion!.getTime() - ahora.getTime()) / 86_400_000);
    domainEvents.emit({
      type: 'VENCIMIENTO_PROXIMO',
      entidad: 'TRANSPORTISTA',
      entidadId: t.id,
      nombre: t.razonSocial,
      vencimiento: t.vencimientoHabilitacion!,
      diasRestantes: dias,
    });
  }

  // Vehículos con habilitación próxima a vencer
  const vehiculos = await prisma.vehiculo.findMany({
    where: {
      activo: true,
      vencimiento: { lte: limite, gte: ahora },
    },
    select: { id: true, patente: true, marca: true, modelo: true, vencimiento: true },
  });

  for (const v of vehiculos) {
    const dias = Math.ceil((v.vencimiento.getTime() - ahora.getTime()) / 86_400_000);
    domainEvents.emit({
      type: 'VENCIMIENTO_PROXIMO',
      entidad: 'VEHICULO',
      entidadId: v.id,
      nombre: `${v.patente} (${v.marca} ${v.modelo})`,
      vencimiento: v.vencimiento,
      diasRestantes: dias,
    });
  }

  // Choferes con licencia próxima a vencer
  const choferes = await prisma.chofer.findMany({
    where: {
      activo: true,
      vencimiento: { lte: limite, gte: ahora },
    },
    select: { id: true, nombre: true, apellido: true, vencimiento: true },
  });

  for (const c of choferes) {
    const dias = Math.ceil((c.vencimiento.getTime() - ahora.getTime()) / 86_400_000);
    domainEvents.emit({
      type: 'VENCIMIENTO_PROXIMO',
      entidad: 'CHOFER',
      entidadId: c.id,
      nombre: `${c.nombre} ${c.apellido}`,
      vencimiento: c.vencimiento,
      diasRestantes: dias,
    });
  }

  const total = transportistas.length + vehiculos.length + choferes.length;
  console.log(`[VencimientoJob] ${total} vencimientos emitidos (T:${transportistas.length} V:${vehiculos.length} C:${choferes.length})`);
}
