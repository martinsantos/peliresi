/**
 * SEED CONCURRENT DEMO
 * Crea 20 transportistas + 20 manifiestos para pruebas de simultaneidad
 *
 * Ejecutar: npx ts-node prisma/seed-concurrent-demo.ts
 */

import { PrismaClient, EstadoManifiesto } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();
const DEMO_PASSWORD = 'password';

// Coordenadas de ubicaciones en Mendoza (origen y destino)
const UBICACIONES_GENERADORES = [
  { nombre: 'Química Mendoza', lat: -32.8908, lng: -68.8272, domicilio: 'Av. San Martín 1200, Ciudad' },
  { nombre: 'Petroquímica Norte', lat: -32.8456, lng: -68.8456, domicilio: 'Parque Industrial Norte, Las Heras' },
  { nombre: 'Laboratorio Central', lat: -32.9312, lng: -68.8756, domicilio: 'Calle España 450, Godoy Cruz' },
  { nombre: 'Industrias del Sur', lat: -33.0100, lng: -68.8500, domicilio: 'Ruta 40 km 3050, Luján de Cuyo' },
  { nombre: 'Metalúrgica Cuyo', lat: -32.8700, lng: -68.7900, domicilio: 'Acceso Este 2500, Guaymallén' },
];

const UBICACIONES_OPERADORES = [
  { nombre: 'Planta Tratamiento Maipú', lat: -32.9834, lng: -68.7934, domicilio: 'Parque Industrial Maipú, Lote 15' },
  { nombre: 'Eco Ambiental Luján', lat: -33.0400, lng: -68.8200, domicilio: 'Ruta 40 km 3080, Luján de Cuyo' },
  { nombre: 'Reciclados Mendoza', lat: -32.9200, lng: -68.7600, domicilio: 'Zona Industrial Este, Maipú' },
];

const NOMBRES_TRANSPORTISTAS = [
  'Juan García', 'María López', 'Carlos Rodríguez', 'Ana Martínez', 'Pedro Sánchez',
  'Laura Fernández', 'Diego Ruiz', 'Sofía Torres', 'Miguel Díaz', 'Lucía Romero',
  'Andrés Castro', 'Valentina Morales', 'Fernando Acosta', 'Camila Herrera', 'Nicolás Vargas',
  'Paula Mendoza', 'Sebastián Ortiz', 'Daniela Silva', 'Martín Aguilar', 'Carolina Reyes',
];

const TIPOS_RESIDUOS = ['Y1', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y14', 'Y15'];

async function main() {
  console.log('🚀 Iniciando seed de datos para pruebas concurrentes...\n');

  const hashedPassword = await bcrypt.hash(DEMO_PASSWORD, 10);

  // ========== 1. ACTUALIZAR COORDENADAS DE GENERADORES EXISTENTES ==========
  console.log('📍 Actualizando coordenadas de Generadores existentes...');

  const generadoresExistentes = await prisma.generador.findMany();
  for (let i = 0; i < generadoresExistentes.length; i++) {
    const coords = UBICACIONES_GENERADORES[i % UBICACIONES_GENERADORES.length];
    await prisma.generador.update({
      where: { id: generadoresExistentes[i].id },
      data: {
        latitud: coords.lat,
        longitud: coords.lng,
      },
    });
  }
  console.log(`   ✅ ${generadoresExistentes.length} generadores actualizados con coordenadas\n`);

  // ========== 2. ACTUALIZAR COORDENADAS DE OPERADORES EXISTENTES ==========
  console.log('📍 Actualizando coordenadas de Operadores existentes...');

  const operadoresExistentes = await prisma.operador.findMany();
  for (let i = 0; i < operadoresExistentes.length; i++) {
    const coords = UBICACIONES_OPERADORES[i % UBICACIONES_OPERADORES.length];
    await prisma.operador.update({
      where: { id: operadoresExistentes[i].id },
      data: {
        latitud: coords.lat,
        longitud: coords.lng,
      },
    });
  }
  console.log(`   ✅ ${operadoresExistentes.length} operadores actualizados con coordenadas\n`);

  // ========== 3. CREAR 20 TRANSPORTISTAS DEMO ==========
  console.log('🚚 Creando 20 transportistas demo...');

  const transportistasCreados: any[] = [];

  for (let i = 1; i <= 20; i++) {
    const numStr = String(i).padStart(2, '0');
    const email = `transportista${numStr}@demo.com`;
    const nombreCompleto = NOMBRES_TRANSPORTISTAS[i - 1];
    const [nombre, apellido] = nombreCompleto.split(' ');

    // Crear o actualizar usuario
    const usuario = await prisma.usuario.upsert({
      where: { email },
      update: { password: hashedPassword },
      create: {
        email,
        password: hashedPassword,
        rol: 'TRANSPORTISTA',
        nombre,
        apellido,
        empresa: `Transporte Demo ${numStr} S.R.L.`,
        activo: true,
      },
    });

    // Crear o actualizar transportista
    const transportista = await prisma.transportista.upsert({
      where: { usuarioId: usuario.id },
      update: {},
      create: {
        usuarioId: usuario.id,
        razonSocial: `Transporte Demo ${numStr} S.R.L.`,
        cuit: `30-7000000${numStr}-${i % 10}`,
        domicilio: `Calle Demo ${i * 100}, Mendoza`,
        telefono: `261400${numStr}00`,
        email,
        numeroHabilitacion: `HAB-DEMO-${numStr}`,
        activo: true,
      },
    });

    // Crear vehículo si no existe
    const vehiculoExistente = await prisma.vehiculo.findFirst({
      where: { transportistaId: transportista.id },
    });

    let vehiculo = vehiculoExistente;
    if (!vehiculoExistente) {
      vehiculo = await prisma.vehiculo.create({
        data: {
          transportistaId: transportista.id,
          patente: `AB${numStr}CD`,
          marca: i % 2 === 0 ? 'Mercedes-Benz' : 'Scania',
          modelo: i % 2 === 0 ? 'Atego 1726' : 'P310',
          anio: 2020 + (i % 5),
          capacidad: 8000 + (i * 200),
          numeroHabilitacion: `VEH-DEMO-${numStr}`,
          vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
          activo: true,
        },
      });
    }

    // Crear chofer si no existe
    const choferExistente = await prisma.chofer.findFirst({
      where: { transportistaId: transportista.id },
    });

    let chofer = choferExistente;
    if (!choferExistente) {
      chofer = await prisma.chofer.create({
        data: {
          transportistaId: transportista.id,
          nombre,
          apellido,
          dni: `3000000${numStr}`,
          licencia: `LIC-DEMO-${numStr}`,
          vencimiento: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000), // 1 año
          telefono: `261500${numStr}00`,
          activo: true,
        },
      });
    }

    transportistasCreados.push({ usuario, transportista, vehiculo, chofer });
    process.stdout.write(`   Transportista ${numStr}/20 creado\r`);
  }
  console.log(`\n   ✅ 20 transportistas creados con vehículos y choferes\n`);

  // ========== 4. OBTENER DATOS NECESARIOS ==========
  const generadores = await prisma.generador.findMany({ take: 5 });
  const operadores = await prisma.operador.findMany({ take: 3 });
  const tiposResiduo = await prisma.tipoResiduo.findMany({
    where: { codigo: { in: TIPOS_RESIDUOS } },
  });

  if (generadores.length === 0 || operadores.length === 0 || tiposResiduo.length === 0) {
    console.error('❌ Error: Faltan datos base. Ejecuta primero: npm run db:seed');
    process.exit(1);
  }

  // ========== 5. CREAR 20 MANIFIESTOS APROBADOS ==========
  console.log('📋 Creando 20 manifiestos en estado APROBADO...');

  for (let i = 0; i < 20; i++) {
    const numStr = String(i + 1).padStart(4, '0');
    const numero = `MAN-DEMO-${numStr}`;

    const generador = generadores[i % generadores.length];
    const operador = operadores[i % operadores.length];
    const transportistaData = transportistasCreados[i];
    const tipoResiduo = tiposResiduo[i % tiposResiduo.length];

    // Verificar si ya existe
    const manifiestoExistente = await prisma.manifiesto.findFirst({
      where: { numero },
    });

    if (manifiestoExistente) {
      // Actualizar a APROBADO si existe
      await prisma.manifiesto.update({
        where: { id: manifiestoExistente.id },
        data: { estado: 'APROBADO' },
      });
      process.stdout.write(`   Manifiesto ${numero} ya existe, actualizado\r`);
      continue;
    }

    // Crear manifiesto nuevo
    const manifiesto = await prisma.manifiesto.create({
      data: {
        numero,
        generadorId: generador.id,
        transportistaId: transportistaData.transportista.id,
        operadorId: operador.id,
        creadoPorId: transportistaData.usuario.id,
        estado: 'APROBADO',
        observaciones: `Manifiesto de prueba para simulación concurrente #${i + 1}`,
        residuos: {
          create: {
            tipoResiduoId: tipoResiduo.id,
            cantidad: 500 + (i * 50),
            unidad: 'kg',
            descripcion: `Residuo de prueba - ${tipoResiduo.nombre}`,
            estado: 'PENDIENTE',
          },
        },
        eventos: {
          create: {
            tipo: 'CREACION',
            descripcion: 'Manifiesto creado para pruebas de simultaneidad',
            usuarioId: transportistaData.usuario.id,
          },
        },
      },
    });

    process.stdout.write(`   Manifiesto ${numero} creado\r`);
  }
  console.log(`\n   ✅ 20 manifiestos APROBADOS listos para viajes\n`);

  // ========== 6. RESUMEN ==========
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('                    SEED COMPLETADO                             ');
  console.log('═══════════════════════════════════════════════════════════════');
  console.log('');
  console.log('📊 Datos creados:');
  console.log('   • 20 Transportistas: transportista01@demo.com ... transportista20@demo.com');
  console.log('   • 20 Vehículos (uno por transportista)');
  console.log('   • 20 Choferes (uno por transportista)');
  console.log('   • 20 Manifiestos: MAN-DEMO-0001 ... MAN-DEMO-0020 (APROBADOS)');
  console.log('   • Coordenadas GPS agregadas a Generadores y Operadores');
  console.log('');
  console.log('🔑 Credenciales:');
  console.log('   • Password: password (igual para todos)');
  console.log('   • Admin: admin@dgfa.mendoza.gov.ar');
  console.log('');
  console.log('🚀 Siguiente paso:');
  console.log('   npx ts-node scripts/simulate-concurrent-trips.ts');
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ Error en seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
