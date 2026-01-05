import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';

export class LogisticsService {
  /**
   * Confirmar retiro coordinando estado y eventos
   */
  async confirmarRetiro(id: string, userId: string, data: { latitud?: number; longitud?: number; observaciones?: string }) {
    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
    if (manifiesto.estado !== 'APROBADO') throw new AppError('El manifiesto debe estar aprobado para confirmar retiro', 400);

    const manifiestoActualizado = await prisma.manifiesto.update({
      where: { id },
      data: {
        estado: 'EN_TRANSITO',
        fechaRetiro: new Date()
      },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        residuos: { include: { tipoResiduo: true } }
      }
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'RETIRO',
        descripcion: data.observaciones || 'Carga retirada del generador',
        latitud: data.latitud,
        longitud: data.longitud,
        usuarioId: userId
      }
    });

    if (data.latitud && data.longitud) {
      await prisma.trackingGPS.create({
        data: {
          manifiestoId: id,
          latitud: data.latitud,
          longitud: data.longitud
        }
      });
    }

    return manifiestoActualizado;
  }

  /**
   * Detección de anomalías GPS
   */
  async detectarAnomalias(manifiestoId: string) {
    const anomaliasDetectadas: any[] = [];
    const tracking = await prisma.trackingGPS.findMany({
      where: { manifiestoId },
      orderBy: { timestamp: 'asc' }
    });

    if (tracking.length < 2) return anomaliasDetectadas;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: { generador: true, operador: true }
    });

    if (!manifiesto) return anomaliasDetectadas;

    for (let i = 1; i < tracking.length; i++) {
      const p1 = tracking[i - 1];
      const p2 = tracking[i];

      const dist = this.calcularDistancia(p1.latitud, p1.longitud, p2.latitud, p2.longitud);
      const timeHours = (p2.timestamp.getTime() - p1.timestamp.getTime()) / (1000 * 3600);
      const speed = timeHours > 0 ? dist / timeHours : 0;

      if (speed > 120) {
        anomaliasDetectadas.push({
          tipo: 'VELOCIDAD_ANORMAL',
          descripcion: `Velocidad excesiva detectada: ${speed.toFixed(1)} km/h`,
          latitud: p2.latitud,
          longitud: p2.longitud,
          valorDetectado: speed,
          valorEsperado: 100,
          severidad: 'ALTA'
        });
      }

      if (dist < 0.1 && timeHours > 2) {
        anomaliasDetectadas.push({
          tipo: 'PARADA_PROLONGADA',
          descripcion: `Parada de ${(timeHours * 60).toFixed(0)} min`,
          latitud: p2.latitud,
          longitud: p2.longitud,
          valorDetectado: timeHours * 60,
          valorEsperado: 60,
          severidad: timeHours > 4 ? 'ALTA' : 'MEDIA'
        });
      }
    }

    for (const anomalia of anomaliasDetectadas) {
      await prisma.anomaliaTransporte.create({
        data: { manifiestoId, ...anomalia }
      });
    }

    return anomaliasDetectadas;
  }

  private calcularDistancia(lat1: number, lon1: number, lat2: number, lon2: number): number {
    const R = 6371;
    const dLat = this.toRad(lat2 - lat1);
    const dLon = this.toRad(lon2 - lon1);
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(this.toRad(lat1)) * Math.cos(this.toRad(lat2)) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRad(deg: number): number { return deg * (Math.PI / 180); }
}

export const logisticsService = new LogisticsService();
