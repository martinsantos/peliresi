import { PrismaClient, Rol } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const demoUsers = {
  generador: {
    email: 'quimica.mendoza@industria.com',
    password: 'gen123',
    rol: 'GENERADOR' as Rol,
    nombre: 'Quimica',
    apellido: 'Mendoza',
    empresa: 'Quimica Mendoza Demo',
    cuit: '30710000001',
  },
  transportista: {
    email: 'transportes.andes@logistica.com',
    password: 'trans123',
    rol: 'TRANSPORTISTA' as Rol,
    nombre: 'Transportes',
    apellido: 'Andes',
    empresa: 'Transportes Andes Demo',
    cuit: '30710000002',
  },
  operador: {
    email: 'tratamiento.residuos@planta.com',
    password: 'op123',
    rol: 'OPERADOR' as Rol,
    nombre: 'Tratamiento',
    apellido: 'Residuos',
    empresa: 'Planta Tratamiento Demo',
    cuit: '30710000003',
  },
};

async function ensureUser(config: typeof demoUsers.generador) {
  const existing = await prisma.usuario.findUnique({ where: { email: config.email } });
  if (existing) {
    return prisma.usuario.update({
      where: { id: existing.id },
      data: {
        activo: true,
        emailVerified: true,
        rol: config.rol,
        nombre: existing.nombre || config.nombre,
        apellido: existing.apellido || config.apellido,
        empresa: existing.empresa || config.empresa,
      },
    });
  }

  return prisma.usuario.create({
    data: {
      email: config.email,
      password: await bcrypt.hash(config.password, 10),
      rol: config.rol,
      nombre: config.nombre,
      apellido: config.apellido,
      empresa: config.empresa,
      cuit: config.cuit,
      activo: true,
      emailVerified: true,
    },
  });
}

async function ensureTipoResiduo() {
  const existing = await prisma.tipoResiduo.findFirst({
    where: { activo: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing;

  return prisma.tipoResiduo.create({
    data: {
      codigo: 'Y9-DEMO',
      nombre: 'Residuo demo certificacion',
      categoria: 'Y9',
      peligrosidad: 'MEDIA',
      descripcion: 'Residuo estable para certificacion funcional demo',
      activo: true,
    },
  });
}

async function main() {
  console.log('SITREP demo certification repair');

  const generadorUser = await ensureUser(demoUsers.generador);
  const transportistaUser = await ensureUser(demoUsers.transportista);
  const operadorUser = await ensureUser(demoUsers.operador);

  const generador = await prisma.generador.upsert({
    where: { usuarioId: generadorUser.id },
    update: { activo: true, email: generadorUser.email, razonSocial: generadorUser.empresa || demoUsers.generador.empresa },
    create: {
      usuarioId: generadorUser.id,
      razonSocial: demoUsers.generador.empresa,
      cuit: demoUsers.generador.cuit,
      domicilio: 'Av. Demo 100, Mendoza',
      telefono: '2610000001',
      email: demoUsers.generador.email,
      numeroInscripcion: 'GEN-DEMO-001',
      categoria: 'MEDIANO',
      activo: true,
    },
  });

  const transportista = await prisma.transportista.upsert({
    where: { usuarioId: transportistaUser.id },
    update: { activo: true, email: transportistaUser.email, razonSocial: transportistaUser.empresa || demoUsers.transportista.empresa },
    create: {
      usuarioId: transportistaUser.id,
      razonSocial: demoUsers.transportista.empresa,
      cuit: demoUsers.transportista.cuit,
      domicilio: 'Ruta Demo 200, Mendoza',
      telefono: '2610000002',
      email: demoUsers.transportista.email,
      numeroHabilitacion: 'TRANS-DEMO-001',
      activo: true,
    },
  });

  const operador = await prisma.operador.upsert({
    where: { usuarioId: operadorUser.id },
    update: { activo: true, email: operadorUser.email, razonSocial: operadorUser.empresa || demoUsers.operador.empresa, modalidades: ['FIJO', 'IN_SITU'] },
    create: {
      usuarioId: operadorUser.id,
      razonSocial: demoUsers.operador.empresa,
      cuit: demoUsers.operador.cuit,
      domicilio: 'Parque Industrial Demo, Mendoza',
      telefono: '2610000003',
      email: demoUsers.operador.email,
      numeroHabilitacion: 'OPER-DEMO-001',
      categoria: 'OPERADOR',
      modalidades: ['FIJO', 'IN_SITU'],
      activo: true,
    },
  });

  const tipoResiduo = await ensureTipoResiduo();

  const tratamiento = await prisma.tratamientoAutorizado.upsert({
    where: {
      operadorId_tipoResiduoId_metodo: {
        operadorId: operador.id,
        tipoResiduoId: tipoResiduo.id,
        metodo: 'TRATAMIENTO_DEMO',
      },
    },
    update: { activo: true },
    create: {
      operadorId: operador.id,
      tipoResiduoId: tipoResiduo.id,
      metodo: 'TRATAMIENTO_DEMO',
      descripcion: 'Tratamiento demo para certificacion funcional',
      capacidad: 10000,
      activo: true,
    },
  });

  const vehiculo = await prisma.vehiculo.findFirst({
    where: { transportistaId: transportista.id, activo: true },
  }) ?? await prisma.vehiculo.create({
    data: {
      transportistaId: transportista.id,
      patente: 'DEM001',
      marca: 'Demo',
      modelo: 'Certificacion',
      anio: 2024,
      capacidad: 10000,
      numeroHabilitacion: 'VEH-DEMO-001',
      vencimiento: new Date('2030-12-31T00:00:00.000Z'),
      activo: true,
    },
  });

  const chofer = await prisma.chofer.findFirst({
    where: { transportistaId: transportista.id, activo: true },
  }) ?? await prisma.chofer.create({
    data: {
      transportistaId: transportista.id,
      nombre: 'Chofer',
      apellido: 'Demo',
      dni: '30000001',
      licencia: 'LIC-DEMO-001',
      vencimiento: new Date('2030-12-31T00:00:00.000Z'),
      telefono: '2610000004',
      activo: true,
    },
  });

  console.log(JSON.stringify({
    status: 'ok',
    users: {
      generador: generadorUser.email,
      transportista: transportistaUser.email,
      operador: operadorUser.email,
    },
    actors: {
      generadorId: generador.id,
      transportistaId: transportista.id,
      operadorId: operador.id,
    },
    certificationData: {
      tipoResiduoId: tipoResiduo.id,
      tratamientoId: tratamiento.id,
      vehiculoId: vehiculo.id,
      choferId: chofer.id,
    },
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
