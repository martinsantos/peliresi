import { PrismaClient, EstadoManifiesto, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const PASSWORD = process.env.TRAINING_DEFAULT_PASSWORD || 'CapacitacionRP2026!';
const RUN_LABEL = process.env.TRAINING_RUN_LABEL || '20260702';
const MANIFEST_PREFIX = `CAP-${RUN_LABEL}`;

type TrainingUser = {
  key: 'generador' | 'transportista' | 'operador';
  email: string;
  password: string;
  rol: Rol;
  nombre: string;
  apellido: string;
  empresa: string;
  cuit: string;
};

const users: TrainingUser[] = [
  {
    key: 'generador',
    email: 'capacitacion.generador@rptrazar.mendoza.gov.ar',
    password: PASSWORD,
    rol: 'GENERADOR',
    nombre: 'Capacitacion',
    apellido: 'Generador',
    empresa: 'CAPACITACION RP - Generador Escuela',
    cuit: '30-92026001-1',
  },
  {
    key: 'transportista',
    email: 'capacitacion.transportista@rptrazar.mendoza.gov.ar',
    password: PASSWORD,
    rol: 'TRANSPORTISTA',
    nombre: 'Capacitacion',
    apellido: 'Transportista',
    empresa: 'CAPACITACION RP - Transporte Escuela',
    cuit: '30-92026002-8',
  },
  {
    key: 'operador',
    email: 'capacitacion.operador@rptrazar.mendoza.gov.ar',
    password: PASSWORD,
    rol: 'OPERADOR',
    nombre: 'Capacitacion',
    apellido: 'Operador',
    empresa: 'CAPACITACION RP - Operador Escuela',
    cuit: '30-92026003-5',
  },
];

const manifestStates: EstadoManifiesto[] = [
  'BORRADOR',
  'APROBADO',
  'EN_TRANSITO',
  'ENTREGADO',
  'RECIBIDO',
  'EN_TRATAMIENTO',
  'TRATADO',
  'RECHAZADO',
  'CANCELADO',
];

function addHours(base: Date, hours: number): Date {
  return new Date(base.getTime() + hours * 60 * 60 * 1000);
}

function workflowDates(estado: EstadoManifiesto, createdAt: Date) {
  const fechaFirma = estado === 'BORRADOR' || estado === 'CANCELADO' ? null : addHours(createdAt, 2);
  const fechaRetiro = ['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)
    ? addHours(createdAt, 8)
    : null;
  const fechaEntrega = ['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)
    ? addHours(createdAt, 14)
    : null;
  const fechaRecepcion = ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado)
    ? addHours(createdAt, 18)
    : null;
  const fechaCierre = estado === 'TRATADO' ? addHours(createdAt, 36) : null;

  return { fechaFirma, fechaRetiro, fechaEntrega, fechaRecepcion, fechaCierre };
}

function eventPlan(estado: EstadoManifiesto): { tipo: string; descripcion: string }[] {
  const events = [{ tipo: 'CREACION', descripcion: 'Manifiesto de capacitacion creado' }];
  if (!['BORRADOR', 'CANCELADO'].includes(estado)) {
    events.push({ tipo: 'FIRMA', descripcion: 'Manifiesto de capacitacion firmado por generador' });
  }
  if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)) {
    events.push({ tipo: 'RETIRO', descripcion: 'Retiro de capacitacion confirmado' });
  }
  if (['ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO', 'RECHAZADO'].includes(estado)) {
    events.push({ tipo: 'ENTREGA', descripcion: 'Entrega de capacitacion registrada' });
  }
  if (['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado)) {
    events.push({ tipo: 'RECEPCION', descripcion: 'Recepcion de capacitacion registrada' });
  }
  if (['EN_TRATAMIENTO', 'TRATADO'].includes(estado)) {
    events.push({ tipo: 'TRATAMIENTO', descripcion: 'Tratamiento de capacitacion iniciado' });
  }
  if (estado === 'TRATADO') {
    events.push({ tipo: 'CIERRE', descripcion: 'Manifiesto de capacitacion cerrado' });
  }
  if (estado === 'RECHAZADO') {
    events.push({ tipo: 'RECHAZO', descripcion: 'Carga de capacitacion rechazada para prueba' });
  }
  if (estado === 'CANCELADO') {
    events.push({ tipo: 'CANCELACION', descripcion: 'Manifiesto de capacitacion cancelado para prueba' });
  }
  return events;
}

async function ensureUser(config: TrainingUser) {
  const password = await bcrypt.hash(config.password, 10);
  return prisma.usuario.upsert({
    where: { email: config.email },
    update: {
      password,
      rol: config.rol,
      nombre: config.nombre,
      apellido: config.apellido,
      empresa: config.empresa,
      cuit: config.cuit,
      activo: true,
      emailVerified: true,
      notifEmail: false,
      notifWhatsapp: false,
      notifTelegram: false,
    },
    create: {
      email: config.email,
      password,
      rol: config.rol,
      nombre: config.nombre,
      apellido: config.apellido,
      empresa: config.empresa,
      cuit: config.cuit,
      activo: true,
      emailVerified: true,
      notifEmail: false,
      notifWhatsapp: false,
      notifTelegram: false,
    },
  });
}

async function ensureTipoResiduo() {
  return prisma.tipoResiduo.upsert({
    where: { codigo: 'Y-CAP-01' },
    update: {
      activo: true,
      nombre: 'Residuo de capacitacion RP Trazar',
      descripcion: 'Tipo de residuo aislado para capacitacion y pruebas controladas',
    },
    create: {
      codigo: 'Y-CAP-01',
      nombre: 'Residuo de capacitacion RP Trazar',
      descripcion: 'Tipo de residuo aislado para capacitacion y pruebas controladas',
      categoria: 'Capacitacion',
      caracteristicas: 'Uso exclusivo para capacitacion',
      peligrosidad: 'Controlada',
      activo: true,
    },
  });
}

async function ensureManifestIsDemo(numero: string) {
  const existing = await prisma.manifiesto.findUnique({ where: { numero } });
  if (existing && !existing.isDemoData) {
    throw new Error(`El manifiesto ${numero} existe y no es demo. Abortando para no tocar datos reales.`);
  }
  return existing;
}

async function main() {
  console.log('RP Trazar production training seed');
  console.log(`manifestPrefix=${MANIFEST_PREFIX}`);

  await prisma.emailQueue.deleteMany({
    where: { subject: { contains: MANIFEST_PREFIX } },
  });

  const createdUsers = Object.fromEntries(
    await Promise.all(users.map(async (config) => [config.key, await ensureUser(config)])),
  ) as Record<TrainingUser['key'], Awaited<ReturnType<typeof ensureUser>>>;

  const generador = await prisma.generador.upsert({
    where: { usuarioId: createdUsers.generador.id },
    update: {
      razonSocial: users[0].empresa,
      cuit: users[0].cuit,
      domicilio: 'Av. San Martin 900, Ciudad, Mendoza',
      telefono: '2614000001',
      email: users[0].email,
      numeroInscripcion: 'CAP-GEN-2026',
      categoria: 'Capacitacion',
      actividad: 'Capacitacion controlada RP Trazar',
      rubro: 'Ambiente - Entrenamiento',
      corrientesControl: 'Y-CAP-01',
      latitud: -32.8895,
      longitud: -68.8458,
      activo: true,
    },
    create: {
      usuarioId: createdUsers.generador.id,
      razonSocial: users[0].empresa,
      cuit: users[0].cuit,
      domicilio: 'Av. San Martin 900, Ciudad, Mendoza',
      telefono: '2614000001',
      email: users[0].email,
      numeroInscripcion: 'CAP-GEN-2026',
      categoria: 'Capacitacion',
      actividad: 'Capacitacion controlada RP Trazar',
      rubro: 'Ambiente - Entrenamiento',
      corrientesControl: 'Y-CAP-01',
      latitud: -32.8895,
      longitud: -68.8458,
      activo: true,
    },
  });

  const transportista = await prisma.transportista.upsert({
    where: { usuarioId: createdUsers.transportista.id },
    update: {
      razonSocial: users[1].empresa,
      cuit: users[1].cuit,
      domicilio: 'Acceso Este 1500, Guaymallen, Mendoza',
      telefono: '2614000002',
      email: users[1].email,
      numeroHabilitacion: 'CAP-TRANS-2026',
      localidad: 'Guaymallen',
      corrientesAutorizadas: 'Y-CAP-01',
      latitud: -32.8832,
      longitud: -68.7745,
      activo: true,
    },
    create: {
      usuarioId: createdUsers.transportista.id,
      razonSocial: users[1].empresa,
      cuit: users[1].cuit,
      domicilio: 'Acceso Este 1500, Guaymallen, Mendoza',
      telefono: '2614000002',
      email: users[1].email,
      numeroHabilitacion: 'CAP-TRANS-2026',
      localidad: 'Guaymallen',
      corrientesAutorizadas: 'Y-CAP-01',
      latitud: -32.8832,
      longitud: -68.7745,
      activo: true,
    },
  });

  const operador = await prisma.operador.upsert({
    where: { usuarioId: createdUsers.operador.id },
    update: {
      razonSocial: users[2].empresa,
      cuit: users[2].cuit,
      domicilio: 'Parque Industrial, Lujan de Cuyo, Mendoza',
      telefono: '2614000003',
      email: users[2].email,
      numeroHabilitacion: 'CAP-OPER-2026',
      categoria: 'Capacitacion',
      tipoOperador: 'FIJO',
      tecnologia: 'Tratamiento controlado de capacitacion',
      corrientesY: 'Y-CAP-01',
      modalidades: ['FIJO'],
      latitud: -33.0348,
      longitud: -68.8792,
      activo: true,
    },
    create: {
      usuarioId: createdUsers.operador.id,
      razonSocial: users[2].empresa,
      cuit: users[2].cuit,
      domicilio: 'Parque Industrial, Lujan de Cuyo, Mendoza',
      telefono: '2614000003',
      email: users[2].email,
      numeroHabilitacion: 'CAP-OPER-2026',
      categoria: 'Capacitacion',
      tipoOperador: 'FIJO',
      tecnologia: 'Tratamiento controlado de capacitacion',
      corrientesY: 'Y-CAP-01',
      modalidades: ['FIJO'],
      latitud: -33.0348,
      longitud: -68.8792,
      activo: true,
    },
  });

  const tipoResiduo = await ensureTipoResiduo();

  const tratamiento = await prisma.tratamientoAutorizado.upsert({
    where: {
      operadorId_tipoResiduoId_metodo: {
        operadorId: operador.id,
        tipoResiduoId: tipoResiduo.id,
        metodo: 'CAPACITACION_CONTROLADA',
      },
    },
    update: {
      descripcion: 'Tratamiento autorizado para capacitacion controlada',
      capacidad: 1000,
      activo: true,
      fechaVencimiento: new Date('2030-12-31T00:00:00.000Z'),
      numeroResolucion: 'CAP-RES-2026',
    },
    create: {
      operadorId: operador.id,
      tipoResiduoId: tipoResiduo.id,
      metodo: 'CAPACITACION_CONTROLADA',
      descripcion: 'Tratamiento autorizado para capacitacion controlada',
      capacidad: 1000,
      activo: true,
      fechaAutorizacion: new Date('2026-01-01T00:00:00.000Z'),
      fechaVencimiento: new Date('2030-12-31T00:00:00.000Z'),
      numeroResolucion: 'CAP-RES-2026',
      expediente: 'CAP-EXP-2026',
    },
  });

  const vehiculo = await prisma.vehiculo.findFirst({
    where: { transportistaId: transportista.id, patente: 'CAP001', activo: true },
  }) ?? await prisma.vehiculo.create({
    data: {
      transportistaId: transportista.id,
      patente: 'CAP001',
      marca: 'Mercedes-Benz',
      modelo: 'Atego Capacitacion',
      anio: 2025,
      capacidad: 8000,
      numeroHabilitacion: 'CAP-VEH-2026',
      vencimiento: new Date('2030-12-31T00:00:00.000Z'),
      activo: true,
    },
  });

  const chofer = await prisma.chofer.findFirst({
    where: { transportistaId: transportista.id, dni: '92026001', activo: true },
  }) ?? await prisma.chofer.create({
    data: {
      transportistaId: transportista.id,
      nombre: 'Chofer',
      apellido: 'Capacitacion',
      dni: '92026001',
      licencia: 'CAP-LIC-2026',
      vencimiento: new Date('2030-12-31T00:00:00.000Z'),
      telefono: '2614000004',
      activo: true,
    },
  });

  const now = new Date();
  const manifests = [];

  for (const [index, estado] of manifestStates.entries()) {
    const numero = `${MANIFEST_PREFIX}-${String(index + 1).padStart(4, '0')}`;
    await ensureManifestIsDemo(numero);
    const createdAt = new Date(now.getTime() - (index + 1) * 24 * 60 * 60 * 1000);
    const dates = workflowDates(estado, createdAt);

    const manifiesto = await prisma.manifiesto.upsert({
      where: { numero },
      update: {
        generadorId: generador.id,
        transportistaId: transportista.id,
        operadorId: operador.id,
        modalidad: 'FIJO',
        tratamientoMetodo: tratamiento.metodo,
        tratamientoAutorizadoId: tratamiento.id,
        estado,
        observaciones: `CAPACITACION_CONTROLADA isDemoData=true estado=${estado}`,
        ...dates,
        qrCode: `https://rptrazar.mendoza.gov.ar/verificar/${numero}`,
        isDemoData: true,
      },
      create: {
        numero,
        generadorId: generador.id,
        transportistaId: transportista.id,
        operadorId: operador.id,
        creadoPorId: createdUsers.generador.id,
        modalidad: 'FIJO',
        tratamientoMetodo: tratamiento.metodo,
        tratamientoAutorizadoId: tratamiento.id,
        estado,
        observaciones: `CAPACITACION_CONTROLADA isDemoData=true estado=${estado}`,
        ...dates,
        qrCode: `https://rptrazar.mendoza.gov.ar/verificar/${numero}`,
        isDemoData: true,
        createdAt,
      },
    });

    // Parent guard above guarantees this cleanup is constrained to CAP demo manifests.
    // Some legacy endpoints still create child rows without propagating isDemoData.
    await prisma.notificacion.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.alertaGenerada.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.blockchainSello.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.anomaliaTransporte.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.trackingGPS.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.eventoManifiesto.deleteMany({ where: { manifiestoId: manifiesto.id } });
    await prisma.manifiestoResiduo.deleteMany({ where: { manifiestoId: manifiesto.id } });

    await prisma.manifiestoResiduo.create({
      data: {
        manifiestoId: manifiesto.id,
        tipoResiduoId: tipoResiduo.id,
        cantidad: 100 + index * 25,
        unidad: 'kg',
        cantidadRecibida: ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado) ? 100 + index * 25 : null,
        tipoDiferencia: ['RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado) ? 'NINGUNA' : null,
        observaciones: 'Residuo de capacitacion aislado',
        descripcion: 'Carga controlada para capacitacion RP Trazar',
        estado: 'DECLARADO',
      },
    });

    for (const [eventIndex, event] of eventPlan(estado).entries()) {
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: manifiesto.id,
          tipo: event.tipo,
          descripcion: event.descripcion,
          ubicacion: 'Mendoza - circuito capacitacion',
          latitud: -32.8895 - eventIndex * 0.01,
          longitud: -68.8458 + eventIndex * 0.01,
          usuarioId: event.tipo === 'RECEPCION' || event.tipo === 'TRATAMIENTO' || event.tipo === 'CIERRE'
            ? createdUsers.operador.id
            : event.tipo === 'RETIRO' || event.tipo === 'ENTREGA'
              ? createdUsers.transportista.id
              : createdUsers.generador.id,
          isDemoData: true,
          createdAt: addHours(createdAt, eventIndex + 1),
        },
      });
    }

    if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'].includes(estado)) {
      await prisma.trackingGPS.createMany({
        data: [
          { manifiestoId: manifiesto.id, latitud: -32.8895, longitud: -68.8458, velocidad: 0, direccion: 130, precision: 8, isDemoData: true, timestamp: addHours(createdAt, 8) },
          { manifiestoId: manifiesto.id, latitud: -32.9350, longitud: -68.8620, velocidad: 42, direccion: 145, precision: 9, isDemoData: true, timestamp: addHours(createdAt, 9) },
          { manifiestoId: manifiesto.id, latitud: -33.0348, longitud: -68.8792, velocidad: estado === 'EN_TRANSITO' ? 36 : 0, direccion: 155, precision: 8, isDemoData: true, timestamp: addHours(createdAt, 10) },
        ],
      });
    }

    if (estado === 'EN_TRANSITO') {
      await prisma.anomaliaTransporte.create({
        data: {
          manifiestoId: manifiesto.id,
          tipo: 'PARADA_PROLONGADA',
          descripcion: 'Anomalia demo para visualizacion en capacitacion',
          latitud: -32.9350,
          longitud: -68.8620,
          valorDetectado: 18,
          valorEsperado: 10,
          severidad: 'BAJA',
          isDemoData: true,
        },
      });
    }

    manifests.push({ numero, id: manifiesto.id, estado });
  }

  console.log(JSON.stringify({
    status: 'ok',
    manifestPrefix: MANIFEST_PREFIX,
    users: Object.fromEntries(users.map((user) => [user.key, user.email])),
    actors: {
      generadorId: generador.id,
      transportistaId: transportista.id,
      operadorId: operador.id,
      vehiculoId: vehiculo.id,
      choferId: chofer.id,
      tipoResiduoId: tipoResiduo.id,
      tratamientoId: tratamiento.id,
    },
    manifests,
  }, null, 2));
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
