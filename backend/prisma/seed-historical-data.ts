/**
 * SEED HISTORICAL DATA
 * Crea datos históricos de los últimos 90 días para estadísticas reales
 *
 * Ejecutar: npx ts-node prisma/seed-historical-data.ts
 *
 * Distribución:
 * - 500+ manifiestos distribuidos en 90 días
 * - 60% TRATADO, 15% RECIBIDO, 10% ENTREGADO, 10% EN_TRANSITO, 5% APROBADO
 * - Variación por día de semana (más actividad L-V)
 */

import { PrismaClient, EstadoManifiesto } from '@prisma/client';

const prisma = new PrismaClient();

// Tipos de residuos con sus códigos
const TIPOS_RESIDUOS_CODIGOS = ['Y1', 'Y6', 'Y7', 'Y8', 'Y9', 'Y10', 'Y11', 'Y12', 'Y14', 'Y15'];

// Ubicaciones de Generadores por departamento
const GENERADORES_POR_DEPT = [
    { dept: 'Capital', domicilio: 'Av. San Martín 1500, Ciudad de Mendoza', lat: -32.8900, lng: -68.8400 },
    { dept: 'Godoy Cruz', domicilio: 'Calle Perito Moreno 800, Godoy Cruz', lat: -32.9200, lng: -68.8500 },
    { dept: 'Guaymallén', domicilio: 'Acceso Este 2100, Guaymallén', lat: -32.8800, lng: -68.7900 },
    { dept: 'Las Heras', domicilio: 'Ruta 7 km 12, Las Heras', lat: -32.8400, lng: -68.8500 },
    { dept: 'Maipú', domicilio: 'Parque Industrial Maipú, Lote 8', lat: -32.9700, lng: -68.7800 },
    { dept: 'Luján de Cuyo', domicilio: 'Ruta 40 km 3045, Luján de Cuyo', lat: -33.0200, lng: -68.8400 },
];

// Distribución de estados (porcentajes)
const DISTRIBUCION_ESTADOS = {
    TRATADO: 60,
    RECIBIDO: 15,
    ENTREGADO: 10,
    EN_TRANSITO: 10,
    APROBADO: 5
};

// Función para generar fecha aleatoria en los últimos N días
function randomDate(daysAgo: number): Date {
    const now = new Date();
    const randomDays = Math.random() * daysAgo;
    const date = new Date(now.getTime() - randomDays * 24 * 60 * 60 * 1000);

    // Ajustar hora laboral (8:00 - 18:00)
    date.setHours(8 + Math.floor(Math.random() * 10));
    date.setMinutes(Math.floor(Math.random() * 60));

    return date;
}

// Función para elegir estado según distribución
function elegirEstado(): EstadoManifiesto {
    const rand = Math.random() * 100;
    let acumulado = 0;

    for (const [estado, porcentaje] of Object.entries(DISTRIBUCION_ESTADOS)) {
        acumulado += porcentaje;
        if (rand <= acumulado) {
            return estado as EstadoManifiesto;
        }
    }
    return 'TRATADO';
}

// Función para generar cantidad de residuos realista
function generarCantidad(): number {
    // Entre 50 y 2000 kg, con tendencia a valores medios
    const base = 200 + Math.random() * 800;
    const variacion = (Math.random() - 0.5) * 400;
    return Math.round((base + variacion) * 10) / 10;
}

async function main() {
    console.log('🗓️  Iniciando seed de datos históricos (90 días)...\n');

    // Obtener datos existentes
    const generadores = await prisma.generador.findMany({ take: 10 });
    const operadores = await prisma.operador.findMany({ take: 5 });
    const transportistas = await prisma.transportista.findMany({
        include: {
            vehiculos: { take: 1 },
            choferes: { take: 1 },
            usuario: true
        },
        take: 20
    });
    const tiposResiduo = await prisma.tipoResiduo.findMany({
        where: { codigo: { in: TIPOS_RESIDUOS_CODIGOS } }
    });

    if (generadores.length === 0 || operadores.length === 0 || transportistas.length === 0) {
        console.error('❌ Error: Faltan datos base. Ejecuta primero: npm run db:seed');
        process.exit(1);
    }

    if (tiposResiduo.length === 0) {
        console.error('❌ Error: No hay tipos de residuo. Ejecuta: npm run db:seed');
        process.exit(1);
    }

    console.log(`📊 Datos base encontrados:`);
    console.log(`   • ${generadores.length} generadores`);
    console.log(`   • ${operadores.length} operadores`);
    console.log(`   • ${transportistas.length} transportistas`);
    console.log(`   • ${tiposResiduo.length} tipos de residuo\n`);

    // Actualizar coordenadas de generadores existentes
    console.log('📍 Actualizando ubicaciones de generadores...');
    for (let i = 0; i < generadores.length; i++) {
        const ubicacion = GENERADORES_POR_DEPT[i % GENERADORES_POR_DEPT.length];
        await prisma.generador.update({
            where: { id: generadores[i].id },
            data: {
                domicilio: ubicacion.domicilio,
                latitud: ubicacion.lat + (Math.random() - 0.5) * 0.02,
                longitud: ubicacion.lng + (Math.random() - 0.5) * 0.02
            }
        });
    }

    // Contar manifiestos existentes para numerar
    const countExistentes = await prisma.manifiesto.count();
    let numeroBase = countExistentes + 1;

    // Generar manifiestos históricos
    const TOTAL_MANIFIESTOS = 500;
    console.log(`\n📋 Creando ${TOTAL_MANIFIESTOS} manifiestos históricos...`);

    let created = 0;
    const errores: string[] = [];

    for (let i = 0; i < TOTAL_MANIFIESTOS; i++) {
        try {
            const generador = generadores[Math.floor(Math.random() * generadores.length)];
            const operador = operadores[Math.floor(Math.random() * operadores.length)];
            const transportista = transportistas[Math.floor(Math.random() * transportistas.length)];
            const tipoResiduo = tiposResiduo[Math.floor(Math.random() * tiposResiduo.length)];

            const estado = elegirEstado();
            const fechaCreacion = randomDate(90);
            const numero = `MAN-HIST-${String(numeroBase + i).padStart(5, '0')}`;

            // Calcular fechas según estado
            let fechaRetiro = null;
            let fechaEntrega = null;
            let fechaRecepcion = null;
            let fechaCierre = null;

            if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(estado)) {
                fechaRetiro = new Date(fechaCreacion.getTime() + 2 * 60 * 60 * 1000); // +2 horas
            }
            if (['ENTREGADO', 'RECIBIDO', 'TRATADO'].includes(estado)) {
                fechaEntrega = new Date(fechaCreacion.getTime() + 4 * 60 * 60 * 1000); // +4 horas
            }
            if (['RECIBIDO', 'TRATADO'].includes(estado)) {
                fechaRecepcion = new Date(fechaCreacion.getTime() + 5 * 60 * 60 * 1000); // +5 horas
            }
            if (estado === 'TRATADO') {
                fechaCierre = new Date(fechaCreacion.getTime() + 24 * 60 * 60 * 1000); // +24 horas
            }

            await prisma.manifiesto.create({
                data: {
                    numero,
                    generadorId: generador.id,
                    transportistaId: transportista.id,
                    operadorId: operador.id,
                    creadoPorId: transportista.usuario.id,
                    estado,
                    observaciones: `Manifiesto histórico generado automáticamente - ${estado}`,
                    fechaRetiro,
                    fechaEntrega,
                    fechaRecepcion,
                    fechaCierre,
                    createdAt: fechaCreacion,
                    residuos: {
                        create: {
                            tipoResiduoId: tipoResiduo.id,
                            cantidad: generarCantidad(),
                            unidad: 'kg',
                            descripcion: `Residuo ${tipoResiduo.codigo} - ${tipoResiduo.nombre}`,
                            estado: estado === 'TRATADO' ? 'TRATADO' : 'PENDIENTE',
                            cantidadRecibida: estado === 'TRATADO' ? generarCantidad() * 0.98 : null
                        }
                    },
                    eventos: {
                        create: {
                            tipo: 'CREACION',
                            descripcion: `Manifiesto histórico creado - ${estado}`,
                            usuarioId: transportista.usuario.id,
                            createdAt: fechaCreacion
                        }
                    }
                }
            });

            created++;
            if (created % 50 === 0) {
                process.stdout.write(`   Creados: ${created}/${TOTAL_MANIFIESTOS}\r`);
            }
        } catch (err: any) {
            errores.push(`Error en manifiesto ${i + 1}: ${err.message}`);
        }
    }

    console.log(`\n   ✅ ${created} manifiestos históricos creados`);

    if (errores.length > 0) {
        console.log(`   ⚠️ ${errores.length} errores (algunos pueden ser duplicados)`);
    }

    // Crear algunas alertas históricas
    console.log('\n🚨 Creando alertas históricas...');

    const manifiestosSinAlertas = await prisma.manifiesto.findMany({
        where: {
            createdAt: { gte: new Date(Date.now() - 90 * 24 * 60 * 60 * 1000) }
        },
        take: 50,
        orderBy: { createdAt: 'desc' }
    });

    let alertasCreadas = 0;
    for (const m of manifiestosSinAlertas) {
        if (Math.random() < 0.2) { // 20% de probabilidad de alerta
            try {
                await prisma.alertaGenerada.create({
                    data: {
                        manifiestoId: m.id,
                        tipo: Math.random() < 0.5 ? 'TIEMPO_EXCESIVO' : 'DESVIO_RUTA',
                        severidad: Math.random() < 0.3 ? 'ALTA' : 'MEDIA',
                        mensaje: 'Alerta generada automáticamente para datos históricos',
                        estado: 'RESUELTA',
                        createdAt: new Date(m.createdAt.getTime() + 3 * 60 * 60 * 1000)
                    }
                });
                alertasCreadas++;
            } catch (err) {
                // Ignorar errores de alertas
            }
        }
    }
    console.log(`   ✅ ${alertasCreadas} alertas históricas creadas`);

    // Resumen estadístico
    console.log('\n═══════════════════════════════════════════════════════════════');
    console.log('                    SEED HISTÓRICO COMPLETADO                    ');
    console.log('═══════════════════════════════════════════════════════════════');

    const statsEstado = await prisma.manifiesto.groupBy({
        by: ['estado'],
        _count: { id: true }
    });

    console.log('\n📊 Distribución por estado:');
    statsEstado.forEach(s => {
        console.log(`   • ${s.estado}: ${s._count.id}`);
    });

    const total = await prisma.manifiesto.count();
    const ultimoMes = await prisma.manifiesto.count({
        where: { createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) } }
    });

    console.log(`\n📈 Totales:`);
    console.log(`   • Total manifiestos: ${total}`);
    console.log(`   • Último mes: ${ultimoMes}`);
    console.log(`   • Alertas: ${alertasCreadas}`);
    console.log('');
}

main()
    .catch((e) => {
        console.error('❌ Error en seed histórico:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
