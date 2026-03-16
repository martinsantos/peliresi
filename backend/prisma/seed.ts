import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Iniciando seed de datos...');

  // ========================================
  // ADMIN
  // ========================================
  const adminPassword = await bcrypt.hash('admin123', 10);
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@dgfa.mendoza.gov.ar' },
    update: {},
    create: {
      email: 'admin@dgfa.mendoza.gov.ar',
      password: adminPassword,
      rol: 'ADMIN',
      nombre: 'Administrador',
      apellido: 'DGFA',
      activo: true,
    },
  });

  // ========================================
  // TIPOS DE RESIDUOS (Ley 24.051)
  // ========================================
  const tiposResiduos = [
    { codigo: 'Y1', nombre: 'HCl Ácido Clorhídrico', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
    { codigo: 'Y2', nombre: 'H2SO4 Ácido Sulfúrico', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
    { codigo: 'Y3', nombre: 'HNO3 Ácido Nítrico', categoria: 'Ácidos', peligrosidad: 'Corrosivo, Oxidante' },
    { codigo: 'Y4', nombre: 'NaOH Hidróxido de Sodio', categoria: 'Bases', peligrosidad: 'Corrosivo' },
    { codigo: 'Y5', nombre: 'KOH Hidróxido de Potasio', categoria: 'Bases', peligrosidad: 'Corrosivo' },
    { codigo: 'Y6', nombre: 'Disolventes Halogenados', categoria: 'Disolventes', peligrosidad: 'Tóxico, Cancerígeno' },
    { codigo: 'Y7', nombre: 'Disolventes Orgánicos', categoria: 'Disolventes', peligrosidad: 'Tóxico, Inflamable' },
    { codigo: 'Y8', nombre: 'Aceites Minerales', categoria: 'Aceites', peligrosidad: 'Tóxico' },
    { codigo: 'Y9', nombre: 'Lodos Galvánicos', categoria: 'Lodos', peligrosidad: 'Tóxico, Corrosivo' },
    { codigo: 'Y10', nombre: 'Baterías de Plomo', categoria: 'Baterías', peligrosidad: 'Tóxico' },
    { codigo: 'Y11', nombre: 'Residuos de Laboratorio', categoria: 'Químicos', peligrosidad: 'Tóxico, Reactivo' },
    { codigo: 'Y12', nombre: 'Pinturas y Barnices', categoria: 'Pinturas', peligrosidad: 'Tóxico, Inflamable' },
    { codigo: 'Y13', nombre: 'Residuos Fotográficos', categoria: 'Químicos', peligrosidad: 'Tóxico' },
    { codigo: 'Y14', nombre: 'Plásticos Contaminados', categoria: 'Plásticos', peligrosidad: 'Tóxico' },
    { codigo: 'Y15', nombre: 'Residuos Hospitalarios', categoria: 'Biológicos', peligrosidad: 'Infeccioso, Tóxico' },
  ];

  for (const tipo of tiposResiduos) {
    await prisma.tipoResiduo.upsert({
      where: { codigo: tipo.codigo },
      update: {},
      create: tipo,
    });
  }

  // ========================================
  // GENERADORES (3 actores con GPS + enrichment)
  // ========================================
  // Coordenadas GPS reales de Mendoza, Argentina
  const generadores = [
    {
      usuario: {
        email: 'quimica.mendoza@industria.com',
        password: await bcrypt.hash('gen123', 10),
        rol: 'GENERADOR' as const,
        nombre: 'Roberto',
        apellido: 'Gómez',
        empresa: 'Química Mendoza S.A.',
      },
      generador: {
        razonSocial: 'Química Mendoza S.A.',
        cuit: '30-12345678-9',
        domicilio: 'Av. San Martín 1200, Ciudad, Mendoza',
        telefono: '2614251234',
        email: 'quimica.mendoza@industria.com',
        numeroInscripcion: 'RG-001-2023',
        categoria: 'Categoría III',
        // GPS: Av. San Martín y Garibaldi, Ciudad de Mendoza
        latitud: -32.8908,
        longitud: -68.8272,
        actividad: 'Fabricación de productos químicos industriales',
        rubro: 'Industria Química',
        corrientesControl: 'Y1, Y2, Y6, Y7, Y12',
      },
    },
    {
      usuario: {
        email: 'petroquimica.andes@industria.com',
        password: await bcrypt.hash('gen123', 10),
        rol: 'GENERADOR' as const,
        nombre: 'María',
        apellido: 'López',
        empresa: 'Petroquímica Andes S.A.',
      },
      generador: {
        razonSocial: 'Petroquímica Andes S.A.',
        cuit: '30-87654321-0',
        domicilio: 'Ruta Nacional 7 km 1050, Guaymallén, Mendoza',
        telefono: '2614859876',
        email: 'petroquimica.andes@industria.com',
        numeroInscripcion: 'RG-002-2023',
        categoria: 'Categoría II',
        // GPS: Zona industrial Rodríguez Peña, Guaymallén
        latitud: -32.8753,
        longitud: -68.7892,
        actividad: 'Refinación y procesamiento petroquímico',
        rubro: 'Industria Petroquímica',
        corrientesControl: 'Y6, Y7, Y8, Y9, Y14',
      },
    },
    {
      usuario: {
        email: 'laboratorio.central@medicina.com',
        password: await bcrypt.hash('gen123', 10),
        rol: 'GENERADOR' as const,
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        empresa: 'Laboratorio Central de Análisis',
      },
      generador: {
        razonSocial: 'Laboratorio Central de Análisis',
        cuit: '30-56789012-3',
        domicilio: 'Calle España 450, Ciudad, Mendoza',
        telefono: '2614567890',
        email: 'laboratorio.central@medicina.com',
        numeroInscripcion: 'RG-003-2023',
        categoria: 'Categoría I',
        // GPS: Calle España entre Rioja y Catamarca, Ciudad de Mendoza
        latitud: -32.8945,
        longitud: -68.8418,
        actividad: 'Análisis clínicos y bioquímicos',
        rubro: 'Laboratorio Médico',
        corrientesControl: 'Y11, Y13, Y15',
      },
    },
  ];

  for (const gen of generadores) {
    const usuario = await prisma.usuario.upsert({
      where: { email: gen.usuario.email },
      update: {},
      create: gen.usuario,
    });

    await prisma.generador.upsert({
      where: { usuarioId: usuario.id },
      update: {
        latitud: gen.generador.latitud,
        longitud: gen.generador.longitud,
        actividad: gen.generador.actividad,
        rubro: gen.generador.rubro,
        corrientesControl: gen.generador.corrientesControl,
      },
      create: {
        ...gen.generador,
        usuarioId: usuario.id,
      },
    });
  }

  // ========================================
  // TRANSPORTISTAS (2 actores con GPS + vehículos/choferes ÚNICOS)
  // ========================================
  const transportistasData = [
    {
      usuario: {
        email: 'transportes.andes@logistica.com',
        password: await bcrypt.hash('trans123', 10),
        rol: 'TRANSPORTISTA' as const,
        nombre: 'Pedro',
        apellido: 'Martínez',
        empresa: 'Transportes Andes S.R.L.',
      },
      transportista: {
        razonSocial: 'Transportes Andes S.R.L.',
        cuit: '30-34567890-1',
        domicilio: 'Acceso Este 1500, Guaymallén, Mendoza',
        telefono: '2614123456',
        email: 'transportes.andes@logistica.com',
        numeroHabilitacion: 'HT-001-2023',
        // GPS: Acceso Este, Guaymallén
        latitud: -32.8832,
        longitud: -68.7745,
      },
      vehiculos: [
        {
          patente: 'AB123CD',
          marca: 'Mercedes-Benz',
          modelo: 'Atego 1726',
          anio: 2022,
          capacidad: 15000,
          numeroHabilitacion: 'HV-001-2023',
          vencimiento: new Date('2027-12-31'),
        },
        {
          patente: 'AC456EF',
          marca: 'Scania',
          modelo: 'R450',
          anio: 2023,
          capacidad: 18000,
          numeroHabilitacion: 'HV-002-2023',
          vencimiento: new Date('2027-12-31'),
        },
      ],
      choferes: [
        {
          nombre: 'Juan Carlos',
          apellido: 'Pérez',
          dni: '25678901',
          licencia: 'MZA-A-25678901',
          vencimiento: new Date('2027-06-30'),
          telefono: '2615551234',
        },
        {
          nombre: 'Luis Alberto',
          apellido: 'Sánchez',
          dni: '28901234',
          licencia: 'MZA-A-28901234',
          vencimiento: new Date('2027-09-30'),
          telefono: '2615559876',
        },
      ],
    },
    {
      usuario: {
        email: 'logistica.cuyo@transporte.com',
        password: await bcrypt.hash('trans123', 10),
        rol: 'TRANSPORTISTA' as const,
        nombre: 'Ana',
        apellido: 'González',
        empresa: 'Logística Cuyo S.A.',
      },
      transportista: {
        razonSocial: 'Logística Cuyo S.A.',
        cuit: '30-09876543-2',
        domicilio: 'Ruta Provincial 60 km 25, Maipú, Mendoza',
        telefono: '2614789123',
        email: 'logistica.cuyo@transporte.com',
        numeroHabilitacion: 'HT-002-2023',
        // GPS: Zona industrial Maipú
        latitud: -32.9437,
        longitud: -68.7583,
      },
      vehiculos: [
        {
          patente: 'AD789GH',
          marca: 'Iveco',
          modelo: 'Tector 170E22',
          anio: 2021,
          capacidad: 12000,
          numeroHabilitacion: 'HV-003-2023',
          vencimiento: new Date('2027-06-30'),
        },
        {
          patente: 'AE012JK',
          marca: 'Volkswagen',
          modelo: 'Constellation 17.280',
          anio: 2022,
          capacidad: 16000,
          numeroHabilitacion: 'HV-004-2023',
          vencimiento: new Date('2027-12-31'),
        },
      ],
      choferes: [
        {
          nombre: 'Marcos Daniel',
          apellido: 'Fernández',
          dni: '30456789',
          licencia: 'MZA-A-30456789',
          vencimiento: new Date('2027-08-31'),
          telefono: '2615553456',
        },
        {
          nombre: 'Diego Hernán',
          apellido: 'Morales',
          dni: '32789012',
          licencia: 'MZA-A-32789012',
          vencimiento: new Date('2027-11-30'),
          telefono: '2615557890',
        },
      ],
    },
  ];

  for (const trans of transportistasData) {
    const usuario = await prisma.usuario.upsert({
      where: { email: trans.usuario.email },
      update: {},
      create: trans.usuario,
    });

    const transportista = await prisma.transportista.upsert({
      where: { usuarioId: usuario.id },
      update: {
        latitud: trans.transportista.latitud,
        longitud: trans.transportista.longitud,
      },
      create: {
        ...trans.transportista,
        usuarioId: usuario.id,
      },
    });

    // Crear vehículos (skip si ya existen por patente para este transportista)
    for (const v of trans.vehiculos) {
      const exists = await prisma.vehiculo.findFirst({
        where: { transportistaId: transportista.id, patente: v.patente },
      });
      if (!exists) {
        await prisma.vehiculo.create({
          data: { ...v, transportistaId: transportista.id },
        });
      }
    }

    // Crear choferes (skip si ya existen por DNI para este transportista)
    for (const c of trans.choferes) {
      const exists = await prisma.chofer.findFirst({
        where: { transportistaId: transportista.id, dni: c.dni },
      });
      if (!exists) {
        await prisma.chofer.create({
          data: { ...c, transportistaId: transportista.id },
        });
      }
    }
  }

  // ========================================
  // OPERADORES (2 actores con GPS + enrichment + tratamientos diferenciados)
  // ========================================
  const residuos = await prisma.tipoResiduo.findMany();
  const residuosMap = new Map(residuos.map(r => [r.codigo, r.id]));

  const operadores = [
    {
      usuario: {
        email: 'tratamiento.residuos@planta.com',
        password: await bcrypt.hash('op123', 10),
        rol: 'OPERADOR' as const,
        nombre: 'Miguel',
        apellido: 'Fernández',
        empresa: 'Tratamiento de Residuos Mendoza S.A.',
      },
      operador: {
        razonSocial: 'Tratamiento de Residuos Mendoza S.A.',
        cuit: '30-13579246-8',
        domicilio: 'Parque Industrial Mendoza, Lote 15, Luján de Cuyo',
        telefono: '2614321987',
        email: 'tratamiento.residuos@planta.com',
        numeroHabilitacion: 'HO-001-2023',
        categoria: 'Categoría III',
        // GPS: Parque Industrial Provincial, Luján de Cuyo
        latitud: -33.0312,
        longitud: -68.8745,
        tipoOperador: 'Planta de Tratamiento Integral',
        tecnologia: 'Incineración controlada, Neutralización química, Estabilización/Solidificación',
        corrientesY: 'Y1, Y2, Y3, Y4, Y5, Y6, Y7, Y8, Y9, Y10, Y11, Y12, Y14, Y15',
      },
      tratamientos: [
        { residuoCodigo: 'Y1', metodo: 'Neutralización química', descripcion: 'Neutralización con bases controlada pH 6-8', capacidad: 5000 },
        { residuoCodigo: 'Y6', metodo: 'Incineración', descripcion: 'Incineración a 1200°C con lavado de gases', capacidad: 3000 },
        { residuoCodigo: 'Y9', metodo: 'Estabilización', descripcion: 'Estabilización/solidificación con cemite Portland', capacidad: 10000 },
        { residuoCodigo: 'Y15', metodo: 'Autoclavado', descripcion: 'Esterilización por autoclave a 134°C, 18 min', capacidad: 2000 },
        { residuoCodigo: 'Y8', metodo: 'Destilación', descripcion: 'Recuperación de aceites por destilación fraccionada', capacidad: 4000 },
      ],
    },
    {
      usuario: {
        email: 'eco.ambiental@reciclado.com',
        password: await bcrypt.hash('op123', 10),
        rol: 'OPERADOR' as const,
        nombre: 'Laura',
        apellido: 'Díaz',
        empresa: 'Eco Ambiental S.R.L.',
      },
      operador: {
        razonSocial: 'Eco Ambiental S.R.L.',
        cuit: '30-24681357-9',
        domicilio: 'Ruta Nacional 40 km 120, Luján de Cuyo, Mendoza',
        telefono: '2614765432',
        email: 'eco.ambiental@reciclado.com',
        numeroHabilitacion: 'HO-002-2023',
        categoria: 'Categoría II',
        // GPS: Ruta 40 Sur, Luján de Cuyo
        latitud: -33.0689,
        longitud: -68.9127,
        tipoOperador: 'Centro de Reciclaje y Recuperación',
        tecnologia: 'Reciclaje mecánico, Recuperación de solventes, Landfarming',
        corrientesY: 'Y7, Y8, Y10, Y12, Y14',
      },
      tratamientos: [
        { residuoCodigo: 'Y7', metodo: 'Recuperación de solventes', descripcion: 'Destilación y recuperación de solventes orgánicos', capacidad: 6000 },
        { residuoCodigo: 'Y10', metodo: 'Reciclaje de baterías', descripcion: 'Desarme, separación de plomo y reciclaje de componentes', capacidad: 8000 },
        { residuoCodigo: 'Y12', metodo: 'Incineración', descripcion: 'Incineración de pinturas y barnices contaminados', capacidad: 2500 },
        { residuoCodigo: 'Y14', metodo: 'Reciclaje mecánico', descripcion: 'Trituración, lavado y pelletizado de plásticos', capacidad: 7000 },
      ],
    },
  ];

  for (const op of operadores) {
    const usuario = await prisma.usuario.upsert({
      where: { email: op.usuario.email },
      update: {},
      create: op.usuario,
    });

    const operador = await prisma.operador.upsert({
      where: { usuarioId: usuario.id },
      update: {
        latitud: op.operador.latitud,
        longitud: op.operador.longitud,
        tipoOperador: op.operador.tipoOperador,
        tecnologia: op.operador.tecnologia,
        corrientesY: op.operador.corrientesY,
      },
      create: {
        ...op.operador,
        usuarioId: usuario.id,
      },
    });

    // Crear tratamientos autorizados (diferenciados por operador)
    for (const t of op.tratamientos) {
      const tipoResiduoId = residuosMap.get(t.residuoCodigo);
      if (!tipoResiduoId) {
        console.warn(`  WARN: Tipo residuo ${t.residuoCodigo} no encontrado, saltando tratamiento`);
        continue;
      }
      await prisma.tratamientoAutorizado.upsert({
        where: {
          operadorId_tipoResiduoId_metodo: {
            operadorId: operador.id,
            tipoResiduoId,
            metodo: t.metodo,
          },
        },
        update: {
          descripcion: t.descripcion,
          capacidad: t.capacidad,
        },
        create: {
          operadorId: operador.id,
          tipoResiduoId,
          metodo: t.metodo,
          descripcion: t.descripcion,
          capacidad: t.capacidad,
        },
      });
    }
  }

  // ========================================
  // REGLAS DE ALERTA POR DEFECTO
  // ========================================
  const reglaCount = await prisma.reglaAlerta.count();
  if (reglaCount === 0) {
    await prisma.reglaAlerta.createMany({
      data: [
        { nombre: 'Cambios de estado', evento: 'CAMBIO_ESTADO' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN', 'GENERADOR', 'TRANSPORTISTA', 'OPERADOR']), activa: true, creadoPorId: admin.id },
        { nombre: 'Incidentes en tránsito', evento: 'INCIDENTE' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN', 'OPERADOR']), activa: true, creadoPorId: admin.id },
        { nombre: 'Rechazo de carga', evento: 'RECHAZO_CARGA' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN', 'GENERADOR']), activa: true, creadoPorId: admin.id },
        { nombre: 'Diferencia de peso', evento: 'DIFERENCIA_PESO' as any, condicion: JSON.stringify({ tolerancia: 5 }), destinatarios: JSON.stringify(['ADMIN', 'GENERADOR']), activa: true, creadoPorId: admin.id },
        { nombre: 'Anomalía GPS', evento: 'ANOMALIA_GPS' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN']), activa: true, creadoPorId: admin.id },
        { nombre: 'Tiempo de tránsito excesivo', evento: 'TIEMPO_EXCESIVO' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN']), activa: true, creadoPorId: admin.id },
        { nombre: 'Desvío de ruta', evento: 'DESVIO_RUTA' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN']), activa: true, creadoPorId: admin.id },
        { nombre: 'Vencimiento próximo', evento: 'VENCIMIENTO' as any, condicion: JSON.stringify({}), destinatarios: JSON.stringify(['ADMIN']), activa: true, creadoPorId: admin.id },
      ],
    });
  }

  console.log('Seed completado exitosamente!');
  console.log('  - 1 Admin');
  console.log('  - 15 Tipos de residuos');
  console.log('  - 3 Generadores (con GPS + enrichment)');
  console.log('  - 2 Transportistas (con GPS + vehículos únicos + choferes únicos)');
  console.log('  - 2 Operadores (con GPS + enrichment + tratamientos diferenciados)');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
