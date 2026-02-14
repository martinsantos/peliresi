/**
 * SITREP — Seed 200+ Manifiestos Demo con Relaciones Cruzadas
 * =============================================================
 * Crea ~210 manifiestos distribuidos en estados, con eventos, tracking GPS,
 * anomalías y residuos. Todos marcados con isDemoData=true.
 *
 * Uso: npx ts-node prisma/seed-demo-manifiestos.ts
 */

import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// ── Distribution ──
const ESTADO_DIST: { estado: string; count: number }[] = [
  { estado: 'BORRADOR', count: 15 },
  { estado: 'APROBADO', count: 20 },
  { estado: 'EN_TRANSITO', count: 25 },
  { estado: 'ENTREGADO', count: 20 },
  { estado: 'RECIBIDO', count: 25 },
  { estado: 'EN_TRATAMIENTO', count: 30 },
  { estado: 'TRATADO', count: 50 },
  { estado: 'RECHAZADO', count: 10 },
  { estado: 'CANCELADO', count: 15 },
];

// ── Helpers ──
function rand(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function randFloat(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function pickN<T>(arr: T[], n: number): T[] {
  const shuffled = [...arr].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, Math.min(n, shuffled.length));
}

function daysAgo(days: number): Date {
  const d = new Date();
  d.setDate(d.getDate() - days);
  d.setHours(rand(6, 20), rand(0, 59), rand(0, 59));
  return d;
}

function addHours(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 3600000);
}

function addMinutes(date: Date, minutes: number): Date {
  return new Date(date.getTime() + minutes * 60000);
}

function jitter(val: number, range = 0.005): number {
  return val + (Math.random() - 0.5) * 2 * range;
}

function interpolateRoute(
  startLat: number, startLng: number,
  endLat: number, endLng: number,
  numPoints: number
): { lat: number; lng: number }[] {
  const points: { lat: number; lng: number }[] = [];
  for (let i = 0; i <= numPoints; i++) {
    const t = i / numPoints;
    points.push({
      lat: startLat + (endLat - startLat) * t + jitter(0, 0.003),
      lng: startLng + (endLng - startLng) * t + jitter(0, 0.003),
    });
  }
  return points;
}

function heading(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLng = lng2 - lng1;
  const dLat = lat2 - lat1;
  return ((Math.atan2(dLng, dLat) * 180) / Math.PI + 360) % 360;
}

const OBSERVACIONES_CREACION = [
  'Retiro programado para esta semana',
  'Residuos industriales acumulados del mes',
  'Solicitud de retiro urgente',
  'Retiro periódico mensual',
  'Limpieza de planta - residuos varios',
  'Residuos de mantenimiento',
  'Retiro trimestral',
  'Residuos de proceso productivo',
];

const ANOMALIA_DESCRIPCIONES = [
  'Contenedor con etiquetado incompleto',
  'Diferencia significativa en peso declarado vs real',
  'Documentación incompleta del generador',
  'Residuos no coinciden con lo declarado',
  'Embalaje deteriorado - riesgo de derrame',
  'Falta certificado de análisis',
  'Residuos mezclados no compatibles',
  'Temperatura fuera de rango permitido',
  'Vehículo sin habilitación vigente',
  'Chofer sin licencia de transporte de RRPP',
];

const TIPO_ANOMALIAS: Array<'DESVIO_RUTA' | 'TIEMPO_EXCESIVO' | 'VELOCIDAD_ANORMAL' | 'PARADA_PROLONGADA' | 'GPS_PERDIDO' | 'RUTA_NO_AUTORIZADA'> = [
  'DESVIO_RUTA', 'TIEMPO_EXCESIVO', 'VELOCIDAD_ANORMAL',
  'PARADA_PROLONGADA', 'GPS_PERDIDO', 'RUTA_NO_AUTORIZADA',
];

const SEVERIDADES: Array<'BAJA' | 'MEDIA' | 'ALTA' | 'CRITICA'> = ['BAJA', 'MEDIA', 'ALTA', 'CRITICA'];

// ── State transition event types ──
const EVENTO_POR_ESTADO: Record<string, { tipo: string; desc: string }[]> = {
  BORRADOR: [{ tipo: 'CREACION', desc: 'Manifiesto creado' }],
  APROBADO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado digitalmente por el generador' },
  ],
  EN_TRANSITO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado digitalmente por el generador' },
    { tipo: 'RETIRO', desc: 'Carga retirada del generador' },
  ],
  ENTREGADO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado digitalmente' },
    { tipo: 'RETIRO', desc: 'Carga retirada del generador' },
    { tipo: 'ENTREGA', desc: 'Carga entregada en planta de tratamiento' },
  ],
  RECIBIDO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado digitalmente' },
    { tipo: 'RETIRO', desc: 'Carga retirada' },
    { tipo: 'ENTREGA', desc: 'Carga entregada' },
    { tipo: 'RECEPCION', desc: 'Carga recibida por operador' },
  ],
  EN_TRATAMIENTO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado' },
    { tipo: 'RETIRO', desc: 'Carga retirada' },
    { tipo: 'ENTREGA', desc: 'Carga entregada' },
    { tipo: 'RECEPCION', desc: 'Carga recibida' },
    { tipo: 'TRATAMIENTO', desc: 'Tratamiento iniciado' },
  ],
  TRATADO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado' },
    { tipo: 'RETIRO', desc: 'Carga retirada' },
    { tipo: 'ENTREGA', desc: 'Carga entregada' },
    { tipo: 'RECEPCION', desc: 'Carga recibida' },
    { tipo: 'TRATAMIENTO', desc: 'Tratamiento iniciado' },
    { tipo: 'CIERRE', desc: 'Manifiesto cerrado - tratamiento completado' },
  ],
  RECHAZADO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'FIRMA', desc: 'Manifiesto firmado' },
    { tipo: 'RETIRO', desc: 'Carga retirada' },
    { tipo: 'ENTREGA', desc: 'Carga entregada' },
    { tipo: 'RECHAZO', desc: 'Carga rechazada por operador' },
  ],
  CANCELADO: [
    { tipo: 'CREACION', desc: 'Manifiesto creado' },
    { tipo: 'CANCELACION', desc: 'Manifiesto cancelado' },
  ],
};

async function main() {
  console.log('=== SITREP Seed Demo Manifiestos ===\n');

  // ── Check for existing demo data ──
  const existingDemo = await prisma.manifiesto.count({ where: { isDemoData: true } });
  if (existingDemo > 0) {
    console.log(`Ya existen ${existingDemo} manifiestos demo. Ejecute rollback-demo.ts primero.`);
    return;
  }

  // ── Load actors ──
  const allGeneradores = await prisma.generador.findMany({
    where: { activo: true },
    select: { id: true, razonSocial: true, latitud: true, longitud: true },
  });
  const allTransportistas = await prisma.transportista.findMany({
    where: { activo: true },
    select: { id: true, razonSocial: true, latitud: true, longitud: true },
  });
  const allOperadores = await prisma.operador.findMany({
    where: { activo: true },
    select: { id: true, razonSocial: true, latitud: true, longitud: true },
  });
  const tiposResiduo = await prisma.tipoResiduo.findMany({
    where: { activo: true },
    select: { id: true, nombre: true, codigo: true },
  });

  // Get an admin user as creator
  const adminUser = await prisma.usuario.findFirst({
    where: { rol: 'ADMIN', activo: true },
    select: { id: true },
  });

  if (!adminUser) {
    console.error('No hay usuario ADMIN activo. Necesario para crear manifiestos.');
    return;
  }
  if (allGeneradores.length === 0 || allTransportistas.length === 0 || allOperadores.length === 0) {
    console.error('Se necesitan generadores, transportistas y operadores activos.');
    return;
  }
  if (tiposResiduo.length === 0) {
    console.error('Se necesitan tipos de residuo activos.');
    return;
  }

  console.log(`Actores: ${allGeneradores.length} generadores, ${allTransportistas.length} transportistas, ${allOperadores.length} operadores`);
  console.log(`Tipos de residuo: ${tiposResiduo.length}`);

  // Select diverse subset of actors
  const generadores = pickN(allGeneradores, 30);
  const transportistas = allTransportistas.length >= 3 ? pickN(allTransportistas, 3) : allTransportistas;
  const operadores = allOperadores.length >= 2 ? pickN(allOperadores, 2) : allOperadores;

  console.log(`Usando: ${generadores.length} generadores, ${transportistas.length} transportistas, ${operadores.length} operadores\n`);

  // ── Get next manifest number ──
  // Find the highest numeric suffix across all 2026- manifiestos
  const allManifiestos2026 = await prisma.manifiesto.findMany({
    where: { numero: { startsWith: '2026-' } },
    select: { numero: true },
  });
  let nextNum = 1;
  for (const m of allManifiestos2026) {
    const suffix = m.numero.replace('2026-', '');
    const parsed = parseInt(suffix, 10);
    if (!isNaN(parsed) && parsed >= nextNum) {
      nextNum = parsed + 1;
    }
  }

  let totalCreated = 0;

  for (const { estado, count } of ESTADO_DIST) {
    console.log(`Creando ${count} manifiestos en estado ${estado}...`);

    for (let i = 0; i < count; i++) {
      const gen = pick(generadores);
      const trans = pick(transportistas);
      const oper = pick(operadores);
      const numero = `2026-${(nextNum++).toString().padStart(6, '0')}`;

      // Distribute over 90 days
      const createdDaysAgo = rand(1, 90);
      const fechaCreacion = daysAgo(createdDaysAgo);

      // Timestamps for workflow
      const fechaFirma = estado !== 'BORRADOR' ? addHours(fechaCreacion, rand(1, 24)) : null;
      const fechaRetiro = ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)
        ? addHours(fechaFirma!, rand(1, 48))
        : null;
      const fechaEntrega = ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)
        ? addHours(fechaRetiro!, rand(1, 8))
        : null;
      const fechaRecepcion = ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado)
        ? addHours(fechaEntrega!, rand(0, 4))
        : null;
      const fechaCierre = estado === 'TRATADO'
        ? addHours(fechaRecepcion!, rand(24, 168))
        : null;

      // Residuos: 1-3 types
      const numResiduos = rand(1, 3);
      const selectedResiduos = pickN(tiposResiduo, numResiduos);

      // Create manifiesto
      const manifiesto = await prisma.manifiesto.create({
        data: {
          numero,
          generadorId: gen.id,
          transportistaId: trans.id,
          operadorId: oper.id,
          estado: estado as any,
          observaciones: pick(OBSERVACIONES_CREACION),
          fechaCreacion,
          fechaFirma,
          fechaRetiro,
          fechaEntrega,
          fechaRecepcion,
          fechaCierre,
          isDemoData: true,
          creadoPorId: adminUser.id,
          residuos: {
            create: selectedResiduos.map(r => ({
              tipoResiduoId: r.id,
              cantidad: randFloat(50, 5000),
              unidad: pick(['kg', 'litros', 'toneladas', 'unidades']),
              estado: ['TRATADO', 'EN_TRATAMIENTO', 'RECIBIDO'].includes(estado) ? 'pesado' : 'pendiente',
              cantidadRecibida: ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado)
                ? randFloat(45, 5100)
                : undefined,
            })),
          },
        },
      });

      // ── Events ──
      const events = EVENTO_POR_ESTADO[estado] || [];
      let eventTime = fechaCreacion;
      for (const ev of events) {
        eventTime = addMinutes(eventTime, rand(10, 360));
        const evLat = gen.latitud || jitter(-32.89);
        const evLng = gen.longitud || jitter(-68.83);

        await prisma.eventoManifiesto.create({
          data: {
            manifiestoId: manifiesto.id,
            tipo: ev.tipo,
            descripcion: ev.desc,
            latitud: ev.tipo === 'RETIRO' ? evLat : ev.tipo === 'ENTREGA' ? (oper.latitud || jitter(-32.93)) : undefined,
            longitud: ev.tipo === 'RETIRO' ? evLng : ev.tipo === 'ENTREGA' ? (oper.longitud || jitter(-68.85)) : undefined,
            usuarioId: adminUser.id,
            isDemoData: true,
            createdAt: eventTime,
          },
        });
      }

      // ── Tracking GPS for EN_TRANSITO manifiestos ──
      if (estado === 'EN_TRANSITO' && fechaRetiro) {
        const startLat = gen.latitud || -32.89;
        const startLng = gen.longitud || -68.83;
        const endLat = oper.latitud || -32.93;
        const endLng = oper.longitud || -68.85;
        const numPoints = rand(10, 30);
        const route = interpolateRoute(startLat, startLng, endLat, endLng, numPoints);

        // Only generate partial route (in transit = not arrived yet)
        const progressPoints = route.slice(0, rand(3, numPoints - 2));
        let trackTime = fechaRetiro;

        for (let p = 0; p < progressPoints.length; p++) {
          trackTime = addMinutes(trackTime, rand(2, 5));
          const speed = randFloat(20, 60);
          const dir = p < progressPoints.length - 1
            ? heading(progressPoints[p].lat, progressPoints[p].lng, progressPoints[p + 1].lat, progressPoints[p + 1].lng)
            : 0;

          await prisma.trackingGPS.create({
            data: {
              manifiestoId: manifiesto.id,
              latitud: progressPoints[p].lat,
              longitud: progressPoints[p].lng,
              velocidad: speed,
              direccion: dir,
              precision: randFloat(3, 15),
              isDemoData: true,
              timestamp: trackTime,
            },
          });
        }
      }

      // ── Tracking GPS for completed states (full route) ──
      if (['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado) && fechaRetiro && fechaEntrega) {
        const startLat = gen.latitud || -32.89;
        const startLng = gen.longitud || -68.83;
        const endLat = oper.latitud || -32.93;
        const endLng = oper.longitud || -68.85;
        const numPoints = rand(15, 30);
        const route = interpolateRoute(startLat, startLng, endLat, endLng, numPoints);
        let trackTime = fechaRetiro;

        for (let p = 0; p < route.length; p++) {
          trackTime = addMinutes(trackTime, rand(2, 5));
          const speed = randFloat(20, 60);
          const dir = p < route.length - 1
            ? heading(route[p].lat, route[p].lng, route[p + 1].lat, route[p + 1].lng)
            : 0;

          await prisma.trackingGPS.create({
            data: {
              manifiestoId: manifiesto.id,
              latitud: route[p].lat,
              longitud: route[p].lng,
              velocidad: speed,
              direccion: dir,
              precision: randFloat(3, 15),
              isDemoData: true,
              timestamp: trackTime,
            },
          });
        }
      }

      // ── Anomalías for RECHAZADO ──
      if (estado === 'RECHAZADO') {
        await prisma.anomaliaTransporte.create({
          data: {
            manifiestoId: manifiesto.id,
            tipo: pick(TIPO_ANOMALIAS),
            descripcion: pick(ANOMALIA_DESCRIPCIONES),
            latitud: oper.latitud || jitter(-32.93),
            longitud: oper.longitud || jitter(-68.85),
            severidad: pick(SEVERIDADES),
            isDemoData: true,
          },
        });
      }

      totalCreated++;
    }
  }

  // ── Summary ──
  const counts = await Promise.all([
    prisma.manifiesto.count({ where: { isDemoData: true } }),
    prisma.eventoManifiesto.count({ where: { isDemoData: true } }),
    prisma.trackingGPS.count({ where: { isDemoData: true } }),
    prisma.anomaliaTransporte.count({ where: { isDemoData: true } }),
  ]);

  console.log('\n=== Resumen Seed ===');
  console.log(`Manifiestos creados: ${counts[0]}`);
  console.log(`Eventos creados: ${counts[1]}`);
  console.log(`Puntos GPS creados: ${counts[2]}`);
  console.log(`Anomalías creadas: ${counts[3]}`);
  console.log('\nSeed completo!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
