import { PrismaClient, EstadoManifiesto } from '@prisma/client';
import bcrypt from 'bcryptjs';
import QRCode from 'qrcode';

const prisma = new PrismaClient();

// Contraseña unificada para todos los usuarios demo
const DEMO_PASSWORD = 'password';
const BASE_URL = 'https://sitrep.ultimamilla.com.ar';

async function main() {
  console.log('Iniciando seed de datos...');

  // Contraseña hasheada para todos
  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ========== CREAR USUARIO ADMINISTRADOR ==========
  const admin = await prisma.usuario.upsert({
    where: { email: 'admin@dgfa.mendoza.gov.ar' },
    update: { password: hashedPassword },
    create: {
      email: 'admin@dgfa.mendoza.gov.ar',
      password: hashedPassword,
      rol: 'ADMIN',
      nombre: 'Administrador',
      apellido: 'DGFA',
      activo: true,
    },
  });
  console.log('✅ Admin creado:', admin.email);

  // ========== CREAR TIPOS DE RESIDUOS ==========
  const tiposResiduos = [
    { codigo: 'Y1', nombre: 'Ácido Clorhídrico (HCl)', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
    { codigo: 'Y2', nombre: 'Ácido Sulfúrico (H2SO4)', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
    { codigo: 'Y3', nombre: 'Ácido Nítrico (HNO3)', categoria: 'Ácidos', peligrosidad: 'Corrosivo, Oxidante' },
    { codigo: 'Y4', nombre: 'Hidróxido de Sodio (NaOH)', categoria: 'Bases', peligrosidad: 'Corrosivo' },
    { codigo: 'Y5', nombre: 'Hidróxido de Potasio (KOH)', categoria: 'Bases', peligrosidad: 'Corrosivo' },
    { codigo: 'Y6', nombre: 'Disolventes Halogenados', categoria: 'Disolventes', peligrosidad: 'Tóxico, Cancerígeno' },
    { codigo: 'Y7', nombre: 'Disolventes Orgánicos', categoria: 'Disolventes', peligrosidad: 'Tóxico, Inflamable' },
    { codigo: 'Y8', nombre: 'Aceites Minerales Usados', categoria: 'Aceites', peligrosidad: 'Tóxico' },
    { codigo: 'Y9', nombre: 'Lodos Galvánicos', categoria: 'Lodos', peligrosidad: 'Tóxico, Corrosivo' },
    { codigo: 'Y10', nombre: 'Baterías de Plomo-Ácido', categoria: 'Baterías', peligrosidad: 'Tóxico' },
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
  console.log('✅ Tipos de residuos creados:', tiposResiduos.length);

  // ========== CREAR GENERADORES ==========
  const generadoresData = [
    {
      usuario: {
        email: 'quimica.mendoza@industria.com',
        password: hashedPassword,
        rol: 'GENERADOR' as const,
        nombre: 'Roberto',
        apellido: 'Gómez',
        empresa: 'Química Mendoza S.A.',
      },
      generador: {
        razonSocial: 'Química Mendoza S.A.',
        cuit: '30-12345678-9',
        domicilio: 'Av. San Martín 1200, Mendoza',
        telefono: '2614251234',
        email: 'quimica.mendoza@industria.com',
        numeroInscripcion: 'RG-001-2023',
        categoria: 'Categoría III',
      },
    },
    {
      usuario: {
        email: 'petroquimica.andes@industria.com',
        password: hashedPassword,
        rol: 'GENERADOR' as const,
        nombre: 'María',
        apellido: 'López',
        empresa: 'Petroquímica Andes',
      },
      generador: {
        razonSocial: 'Petroquímica Andes S.A.',
        cuit: '30-87654321-0',
        domicilio: 'Ruta Nacional 7 km 1050, Guaymallén',
        telefono: '2614859876',
        email: 'petroquimica.andes@industria.com',
        numeroInscripcion: 'RG-002-2023',
        categoria: 'Categoría II',
      },
    },
    {
      usuario: {
        email: 'laboratorio.central@medicina.com',
        password: hashedPassword,
        rol: 'GENERADOR' as const,
        nombre: 'Carlos',
        apellido: 'Rodríguez',
        empresa: 'Laboratorio Central',
      },
      generador: {
        razonSocial: 'Laboratorio Central de Análisis',
        cuit: '30-56789012-3',
        domicilio: 'Calle España 450, Ciudad',
        telefono: '2614567890',
        email: 'laboratorio.central@medicina.com',
        numeroInscripcion: 'RG-003-2023',
        categoria: 'Categoría I',
      },
    },
  ];

  const generadores: any[] = [];
  for (const gen of generadoresData) {
    const usuario = await prisma.usuario.upsert({
      where: { email: gen.usuario.email },
      update: { password: hashedPassword },
      create: gen.usuario,
    });

    const generador = await prisma.generador.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        ...gen.generador,
        usuarioId: usuario.id,
      },
    });
    generadores.push({ usuario, generador });
  }
  console.log('✅ Generadores creados:', generadores.length);

  // ========== CREAR TRANSPORTISTAS ==========
  const transportistasData = [
    {
      usuario: {
        email: 'transportes.andes@logistica.com',
        password: hashedPassword,
        rol: 'TRANSPORTISTA' as const,
        nombre: 'Pedro',
        apellido: 'Martínez',
        empresa: 'Transportes Andes',
      },
      transportista: {
        razonSocial: 'Transportes Andes S.R.L.',
        cuit: '30-34567890-1',
        domicilio: 'Acceso Este 1500, Mendoza',
        telefono: '2614123456',
        email: 'transportes.andes@logistica.com',
        numeroHabilitacion: 'HT-001-2023',
      },
    },
    {
      usuario: {
        email: 'logistica.cuyo@transporte.com',
        password: hashedPassword,
        rol: 'TRANSPORTISTA' as const,
        nombre: 'Ana',
        apellido: 'González',
        empresa: 'Logística Cuyo',
      },
      transportista: {
        razonSocial: 'Logística Cuyo S.A.',
        cuit: '30-09876543-2',
        domicilio: 'Ruta Provincial 60 km 25, Maipú',
        telefono: '2614789123',
        email: 'logistica.cuyo@transporte.com',
        numeroHabilitacion: 'HT-002-2023',
      },
    },
  ];

  const transportistas: any[] = [];
  for (const trans of transportistasData) {
    const usuario = await prisma.usuario.upsert({
      where: { email: trans.usuario.email },
      update: { password: hashedPassword },
      create: trans.usuario,
    });

    const transportista = await prisma.transportista.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        ...trans.transportista,
        usuarioId: usuario.id,
      },
    });
    transportistas.push({ usuario, transportista });

    // Crear vehículos
    const vehiculosExistentes = await prisma.vehiculo.count({
      where: { transportistaId: transportista.id }
    });
    
    if (vehiculosExistentes === 0) {
      await prisma.vehiculo.createMany({
        data: [
          {
            transportistaId: transportista.id,
            patente: `${trans.usuario.nombre.substring(0,2).toUpperCase()}123CD`,
            marca: 'Mercedes-Benz',
            modelo: 'Axor 2036',
            anio: 2022,
            capacidad: 15000,
            numeroHabilitacion: `HV-${transportista.id.substring(0,4)}-2023`,
            vencimiento: new Date('2025-12-31'),
          },
          {
            transportistaId: transportista.id,
            patente: `${trans.usuario.nombre.substring(0,2).toUpperCase()}456GH`,
            marca: 'Scania',
            modelo: 'R450',
            anio: 2021,
            capacidad: 18000,
            numeroHabilitacion: `HV-${transportista.id.substring(0,4)}-2024`,
            vencimiento: new Date('2025-12-31'),
          },
        ],
      });
    }

    // Crear choferes
    const choferesExistentes = await prisma.chofer.count({
      where: { transportistaId: transportista.id }
    });
    
    if (choferesExistentes === 0) {
      await prisma.chofer.createMany({
        data: [
          {
            transportistaId: transportista.id,
            nombre: 'Juan',
            apellido: 'Pérez',
            dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
            licencia: `A${Math.floor(100000 + Math.random() * 900000)}`,
            vencimiento: new Date('2025-06-30'),
            telefono: '2615551234',
          },
          {
            transportistaId: transportista.id,
            nombre: 'Luis',
            apellido: 'Sánchez',
            dni: `${Math.floor(10000000 + Math.random() * 90000000)}`,
            licencia: `B${Math.floor(100000 + Math.random() * 900000)}`,
            vencimiento: new Date('2025-09-30'),
            telefono: '2615559876',
          },
        ],
      });
    }
  }
  console.log('✅ Transportistas creados:', transportistas.length);

  // ========== CREAR OPERADORES ==========
  const operadoresData = [
    {
      usuario: {
        email: 'tratamiento.residuos@planta.com',
        password: hashedPassword,
        rol: 'OPERADOR' as const,
        nombre: 'Miguel',
        apellido: 'Fernández',
        empresa: 'Tratamiento de Residuos',
      },
      operador: {
        razonSocial: 'Tratamiento de Residuos Mendoza S.A.',
        cuit: '30-13579246-8',
        domicilio: 'Parque Industrial Mendoza, Lote 15',
        telefono: '2614321987',
        email: 'tratamiento.residuos@planta.com',
        numeroHabilitacion: 'HO-001-2023',
        categoria: 'Categoría III',
      },
    },
    {
      usuario: {
        email: 'eco.ambiental@reciclado.com',
        password: hashedPassword,
        rol: 'OPERADOR' as const,
        nombre: 'Laura',
        apellido: 'Díaz',
        empresa: 'Eco Ambiental',
      },
      operador: {
        razonSocial: 'Eco Ambiental S.R.L.',
        cuit: '30-24681357-9',
        domicilio: 'Ruta Nacional 40 km 120, Luján de Cuyo',
        telefono: '2614765432',
        email: 'eco.ambiental@reciclado.com',
        numeroHabilitacion: 'HO-002-2023',
        categoria: 'Categoría II',
      },
    },
  ];

  const operadores: any[] = [];
  const residuos = await prisma.tipoResiduo.findMany();
  const residuosMap = new Map(residuos.map(r => [r.codigo, r.id]));

  for (const op of operadoresData) {
    const usuario = await prisma.usuario.upsert({
      where: { email: op.usuario.email },
      update: { password: hashedPassword },
      create: op.usuario,
    });

    const operador = await prisma.operador.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        ...op.operador,
        usuarioId: usuario.id,
      },
    });
    operadores.push({ usuario, operador });

    // Crear tratamientos autorizados
    const tratamientos = [
      { tipoResiduoId: residuosMap.get('Y1')!, metodo: 'Neutralización química', descripcion: 'Proceso de neutralización con bases', capacidad: 5000 },
      { tipoResiduoId: residuosMap.get('Y6')!, metodo: 'Incineración', descripcion: 'Incineración a alta temperatura', capacidad: 3000 },
      { tipoResiduoId: residuosMap.get('Y9')!, metodo: 'Estabilización', descripcion: 'Estabilización química de lodos', capacidad: 10000 },
    ];

    for (const trat of tratamientos) {
      await prisma.tratamientoAutorizado.upsert({
        where: {
          operadorId_tipoResiduoId_metodo: {
            operadorId: operador.id,
            tipoResiduoId: trat.tipoResiduoId,
            metodo: trat.metodo,
          },
        },
        update: {},
        create: {
          operadorId: operador.id,
          ...trat,
        },
      });
    }
  }
  console.log('✅ Operadores creados:', operadores.length);

  // ========== CREAR MANIFIESTOS ==========
  console.log('📦 Creando manifiestos de demo...');

  // Limpiar manifiestos existentes para recrear con datos frescos
  await prisma.manifiestoResiduo.deleteMany({});
  await prisma.eventoManifiesto.deleteMany({});
  await prisma.trackingGPS.deleteMany({});
  await prisma.manifiesto.deleteMany({});

  const manifiestoConfigs = [
    // Manifiestos en BORRADOR (2)
    { numero: 'MAN-2025-0001', estado: 'BORRADOR' as EstadoManifiesto, genIdx: 0, transIdx: 0, opIdx: 0, residuoCodigo: 'Y1' },
    { numero: 'MAN-2025-0002', estado: 'BORRADOR' as EstadoManifiesto, genIdx: 1, transIdx: 1, opIdx: 1, residuoCodigo: 'Y6' },
    // Manifiesto APROBADO (firmado con QR) (1)
    { numero: 'MAN-2025-0003', estado: 'APROBADO' as EstadoManifiesto, genIdx: 0, transIdx: 0, opIdx: 0, residuoCodigo: 'Y9', firmado: true },
    // Manifiestos EN_TRANSITO (2)
    { numero: 'MAN-2025-0004', estado: 'EN_TRANSITO' as EstadoManifiesto, genIdx: 1, transIdx: 0, opIdx: 0, residuoCodigo: 'Y8', firmado: true, conTracking: true },
    { numero: 'MAN-2025-0005', estado: 'EN_TRANSITO' as EstadoManifiesto, genIdx: 2, transIdx: 1, opIdx: 1, residuoCodigo: 'Y11', firmado: true, conTracking: true },
    // Manifiesto ENTREGADO (1)
    { numero: 'MAN-2025-0006', estado: 'ENTREGADO' as EstadoManifiesto, genIdx: 0, transIdx: 1, opIdx: 0, residuoCodigo: 'Y12', firmado: true },
    // Manifiesto RECIBIDO (1)
    { numero: 'MAN-2025-0007', estado: 'RECIBIDO' as EstadoManifiesto, genIdx: 1, transIdx: 0, opIdx: 1, residuoCodigo: 'Y7', firmado: true },
    // Manifiesto TRATADO (completado) (1)
    { numero: 'MAN-2025-0008', estado: 'TRATADO' as EstadoManifiesto, genIdx: 2, transIdx: 1, opIdx: 0, residuoCodigo: 'Y15', firmado: true },
  ];

  for (const config of manifiestoConfigs) {
    const gen = generadores[config.genIdx];
    const trans = transportistas[config.transIdx];
    const op = operadores[config.opIdx];
    const tipoResiduoId = residuosMap.get(config.residuoCodigo)!;

    // Calcular fechas según estado
    const fechaCreacion = new Date();
    fechaCreacion.setDate(fechaCreacion.getDate() - Math.floor(Math.random() * 30));
    
    let fechaFirma: Date | null = null;
    let fechaRetiro: Date | null = null;
    let fechaEntrega: Date | null = null;
    let fechaRecepcion: Date | null = null;
    let fechaCierre: Date | null = null;
    let qrCode: string | null = null;
    let firmaDigital: any = null;

    if (config.firmado) {
      fechaFirma = new Date(fechaCreacion);
      fechaFirma.setHours(fechaFirma.getHours() + 2);
      
      // Generar firma digital simulada
      firmaDigital = {
        algoritmo: 'SHA-256 + RSA',
        firmante: gen.usuario.email,
        fechaFirma: fechaFirma.toISOString(),
        hash: `${Buffer.from(config.numero + fechaFirma.toISOString()).toString('base64').substring(0, 44)}`,
        certificado: {
          emisor: 'DGFA Mendoza CA',
          validoDesde: '2024-01-01',
          validoHasta: '2026-01-01',
        },
      };
    }

    if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(config.estado)) {
      fechaRetiro = new Date(fechaFirma || fechaCreacion);
      fechaRetiro.setHours(fechaRetiro.getHours() + 4);
    }

    if (['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(config.estado)) {
      fechaEntrega = new Date(fechaRetiro!);
      fechaEntrega.setHours(fechaEntrega.getHours() + 3);
    }

    if (['RECIBIDO', 'TRATADO'].includes(config.estado)) {
      fechaRecepcion = new Date(fechaEntrega!);
      fechaRecepcion.setMinutes(fechaRecepcion.getMinutes() + 30);
    }

    if (config.estado === 'TRATADO') {
      fechaCierre = new Date(fechaRecepcion!);
      fechaCierre.setDate(fechaCierre.getDate() + 1);
    }

    // Crear el manifiesto
    const manifiesto = await prisma.manifiesto.create({
      data: {
        numero: config.numero,
        generadorId: gen.generador.id,
        transportistaId: trans.transportista.id,
        operadorId: op.operador.id,
        creadoPorId: gen.usuario.id,
        estado: config.estado,
        observaciones: `Manifiesto de demo - Estado: ${config.estado}`,
        fechaCreacion,
        fechaFirma,
        fechaRetiro,
        fechaEntrega,
        fechaRecepcion,
        fechaCierre,
        firmaDigital,
      },
    });

    // Generar QR para manifiestos firmados
    if (config.firmado) {
      const verificationUrl = `${BASE_URL}/verify/${manifiesto.id}`;
      try {
        qrCode = await QRCode.toDataURL(verificationUrl);
        await prisma.manifiesto.update({
          where: { id: manifiesto.id },
          data: { qrCode },
        });
      } catch (err) {
        console.warn(`⚠️ No se pudo generar QR para ${config.numero}`);
      }
    }

    // Crear residuos del manifiesto
    await prisma.manifiestoResiduo.create({
      data: {
        manifiestoId: manifiesto.id,
        tipoResiduoId,
        cantidad: Math.floor(100 + Math.random() * 900),
        unidad: 'kg',
        estado: config.estado === 'TRATADO' ? 'TRATADO' : 'PENDIENTE',
        cantidadRecibida: config.estado === 'TRATADO' ? Math.floor(100 + Math.random() * 900) : null,
      },
    });

    // Crear eventos de timeline
    const eventos: { tipo: string; descripcion: string; fecha: Date }[] = [
      { tipo: 'CREACION', descripcion: 'Manifiesto creado', fecha: fechaCreacion },
    ];

    if (fechaFirma) {
      eventos.push({ tipo: 'FIRMA', descripcion: 'Manifiesto firmado digitalmente', fecha: fechaFirma });
    }
    if (fechaRetiro) {
      eventos.push({ tipo: 'RETIRO', descripcion: 'Residuos retirados por transportista', fecha: fechaRetiro });
    }
    if (fechaEntrega) {
      eventos.push({ tipo: 'ENTREGA', descripcion: 'Residuos entregados en planta', fecha: fechaEntrega });
    }
    if (fechaRecepcion) {
      eventos.push({ tipo: 'RECEPCION', descripcion: 'Residuos recibidos y verificados', fecha: fechaRecepcion });
    }
    if (fechaCierre) {
      eventos.push({ tipo: 'CIERRE', descripcion: 'Tratamiento completado', fecha: fechaCierre });
    }

    for (const evento of eventos) {
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: manifiesto.id,
          tipo: evento.tipo,
          descripcion: evento.descripcion,
          usuarioId: gen.usuario.id,
          createdAt: evento.fecha,
        },
      });
    }

    // Crear tracking GPS para manifiestos en tránsito
    if (config.conTracking) {
      const puntos = [
        { lat: -32.8908, lng: -68.8272, desc: 'Inicio - Mendoza Centro' },
        { lat: -32.8850, lng: -68.8400, desc: 'Acceso Este' },
        { lat: -32.8700, lng: -68.8600, desc: 'Ruta 7' },
        { lat: -32.8500, lng: -68.8800, desc: 'Parque Industrial' },
      ];

      let trackingTime = new Date(fechaRetiro!);
      for (const punto of puntos) {
        await prisma.trackingGPS.create({
          data: {
            manifiestoId: manifiesto.id,
            latitud: punto.lat,
            longitud: punto.lng,
            velocidad: 40 + Math.random() * 30,
            timestamp: trackingTime,
          },
        });
        trackingTime = new Date(trackingTime.getTime() + 15 * 60 * 1000); // +15 min
      }
    }

    console.log(`  ✅ ${config.numero} - ${config.estado}${config.firmado ? ' (firmado)' : ''}`);
  }

  console.log('');
  console.log('🎉 Seed completado exitosamente!');
  console.log('');
  console.log('📋 Resumen de datos creados:');
  console.log(`   - 1 Administrador`);
  console.log(`   - ${generadores.length} Generadores`);
  console.log(`   - ${transportistas.length} Transportistas (con vehículos y choferes)`);
  console.log(`   - ${operadores.length} Operadores (con tratamientos autorizados)`);
  console.log(`   - ${manifiestoConfigs.length} Manifiestos en diferentes estados`);
  console.log(`   - ${tiposResiduos.length} Tipos de residuos`);
  console.log('');
  console.log('🔐 Credenciales de acceso (contraseña: "password"):');
  console.log('   - Admin: admin@dgfa.mendoza.gov.ar');
  console.log('   - Generador: quimica.mendoza@industria.com');
  console.log('   - Transportista: transportes.andes@logistica.com');
  console.log('   - Operador: tratamiento.residuos@planta.com');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
