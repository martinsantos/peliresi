"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const prisma = new client_1.PrismaClient();
// Coordenadas de Mendoza para simular rutas
const ROUTES = [
    // Ruta Norte (Las Heras -> Parque Industrial)
    [
        { lat: -32.8456, lng: -68.8456 },
        { lat: -32.8534, lng: -68.8412 },
        { lat: -32.8612, lng: -68.8356 },
        { lat: -32.8756, lng: -68.8312 },
        { lat: -32.8908, lng: -68.8272 }
    ],
    // Ruta Sur (Luján -> Parque Industrial)
    [
        { lat: -33.0312, lng: -68.8756 },
        { lat: -33.0156, lng: -68.8612 },
        { lat: -32.9856, lng: -68.8512 },
        { lat: -32.9456, lng: -68.8412 },
        { lat: -32.8908, lng: -68.8272 }
    ],
    // Ruta Este (Maipú -> Parque Industrial)
    [
        { lat: -32.9756, lng: -68.7812 },
        { lat: -32.9556, lng: -68.7956 },
        { lat: -32.9356, lng: -68.8112 },
        { lat: -32.9156, lng: -68.8212 },
        { lat: -32.8908, lng: -68.8272 }
    ]
];
function randomDate(start, end) {
    return new Date(start.getTime() + Math.random() * (end.getTime() - start.getTime()));
}
function generateTrackingPoints(route, manifiestoId) {
    return route.map((point, index) => ({
        manifiestoId,
        latitud: point.lat + (Math.random() - 0.5) * 0.005, // Pequeña variación
        longitud: point.lng + (Math.random() - 0.5) * 0.005,
        velocidad: 40 + Math.random() * 40, // 40-80 km/h
        direccion: Math.random() * 360,
        timestamp: new Date(Date.now() - (route.length - index) * 10 * 60000) // Puntos cada 10 mins hacia atrás
    }));
}
async function main() {
    console.log('🚀 Iniciando volcado de datos masivo para DEMO...');
    // 1. Recuperar actores existentes
    const generadores = await prisma.generador.findMany();
    const transportistas = await prisma.transportista.findMany();
    const operadores = await prisma.operador.findMany();
    const tiposResiduos = await prisma.tipoResiduo.findMany();
    if (generadores.length === 0 || transportistas.length === 0 || operadores.length === 0) {
        console.error('❌ No se encontraron actores. Ejecuta primero "npm run db:seed"');
        return;
    }
    console.log(`📊 Actores encontrados: ${generadores.length} Generadores, ${transportistas.length} Transportistas, ${operadores.length} Operadores`);
    // 2. Generar Manifiestos Históricos (TRATADO, RECHAZADO, CANCELADO)
    const HISTORICAL_COUNT = 50;
    console.log(`📜 Generando ${HISTORICAL_COUNT} manifiestos históricos...`);
    for (let i = 0; i < HISTORICAL_COUNT; i++) {
        const estado = Math.random() > 0.1 ? 'TRATADO' : (Math.random() > 0.5 ? 'RECHAZADO' : 'CANCELADO');
        const generador = generadores[Math.floor(Math.random() * generadores.length)];
        const transportista = transportistas[Math.floor(Math.random() * transportistas.length)];
        const operador = operadores[Math.floor(Math.random() * operadores.length)];
        const tipoResiduo = tiposResiduos[Math.floor(Math.random() * tiposResiduos.length)];
        // Fechas coherentes
        const fechaCreacion = randomDate(new Date(2023, 0, 1), new Date(2023, 11, 31));
        const fechaFirma = new Date(fechaCreacion.getTime() + 3600000); // +1 hora
        const fechaRetiro = new Date(fechaCreacion.getTime() + 86400000); // +1 día
        const fechaEntrega = new Date(fechaRetiro.getTime() + 14400000); // +4 horas
        const fechaRecepcion = new Date(fechaEntrega.getTime() + 3600000); // +1 hora
        const fechaCierre = new Date(fechaRecepcion.getTime() + 172800000); // +2 días
        await prisma.manifiesto.create({
            data: {
                numero: `M-${2023}-${String(i + 1).padStart(6, '0')}`,
                estado: estado,
                generadorId: generador.id,
                transportistaId: transportista.id,
                operadorId: operador.id,
                creadoPorId: generador.usuarioId, // Agregado campo requerido
                fechaFirma: estado !== 'CANCELADO' ? fechaFirma : null,
                fechaRetiro: ['TRATADO', 'RECHAZADO'].includes(estado) ? fechaRetiro : null,
                fechaEntrega: ['TRATADO', 'RECHAZADO'].includes(estado) ? fechaEntrega : null,
                fechaRecepcion: ['TRATADO', 'RECHAZADO'].includes(estado) ? fechaRecepcion : null,
                fechaCierre: estado === 'TRATADO' ? fechaCierre : null,
                createdAt: fechaCreacion,
                updatedAt: fechaCierre,
                residuos: {
                    create: {
                        tipoResiduoId: tipoResiduo.id,
                        cantidad: Math.floor(Math.random() * 5000) + 100,
                        unidad: 'kg',
                        descripcion: `Residuo generado en proceso ${Math.floor(Math.random() * 10)}`,
                        estado: 'PENDIENTE' // Agregado campo requerido
                    }
                },
                eventos: {
                    create: [
                        { tipo: 'CREADO', descripcion: 'Manifiesto creado', usuarioId: generador.usuarioId, createdAt: fechaCreacion },
                        ...(estado !== 'CANCELADO' ? [{ tipo: 'FIRMADO', descripcion: 'Manifiesto firmado digitalmente', usuarioId: generador.usuarioId, createdAt: fechaFirma }] : []),
                        ...(['TRATADO', 'RECHAZADO'].includes(estado) ? [
                            { tipo: 'RETIRO_CONFIRMADO', descripcion: 'Carga retirada por transportista', usuarioId: transportista.usuarioId, createdAt: fechaRetiro },
                            { tipo: 'ENTREGA_CONFIRMADA', descripcion: 'Carga entregada en planta', usuarioId: transportista.usuarioId, createdAt: fechaEntrega },
                            { tipo: 'RECEPCION_CONFIRMADA', descripcion: 'Carga recibida por operador', usuarioId: operador.usuarioId, createdAt: fechaRecepcion }
                        ] : []),
                        ...(estado === 'TRATADO' ? [{ tipo: 'TRATAMIENTO_COMPLETADO', descripcion: 'Residuos tratados exitosamente', usuarioId: operador.usuarioId, createdAt: fechaCierre }] : [])
                    ]
                }
            }
        });
    }
    // 3. Generar Manifiestos Activos (EN_TRANSITO, PENDIENTES, ETC)
    const ACTIVE_COUNT = 20;
    console.log(`🚚 Generando ${ACTIVE_COUNT} manifiestos activos...`);
    const estadosActivos = ['BORRADOR', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'];
    for (let i = 0; i < ACTIVE_COUNT; i++) {
        const estado = estadosActivos[i % estadosActivos.length];
        const generador = generadores[Math.floor(Math.random() * generadores.length)];
        const transportista = transportistas[Math.floor(Math.random() * transportistas.length)];
        const operador = operadores[Math.floor(Math.random() * operadores.length)];
        const tipoResiduo = tiposResiduos[Math.floor(Math.random() * tiposResiduos.length)];
        const fechaCreacion = new Date();
        fechaCreacion.setDate(fechaCreacion.getDate() - Math.floor(Math.random() * 5)); // Hace unos días
        const manifiestoData = {
            numero: `M-${2024}-${String(i + 1000).padStart(6, '0')}`,
            estado: estado,
            generadorId: generador.id,
            transportistaId: transportista.id,
            operadorId: operador.id,
            creadoPorId: generador.usuarioId, // Agregado campo requerido
            createdAt: fechaCreacion,
            updatedAt: new Date(),
            residuos: {
                create: {
                    tipoResiduoId: tipoResiduo.id,
                    cantidad: Math.floor(Math.random() * 5000) + 100,
                    unidad: 'kg',
                    descripcion: 'Residuo industrial activo',
                    estado: 'PENDIENTE' // Agregado campo requerido
                }
            },
            eventos: {
                create: [
                    { tipo: 'CREADO', descripcion: 'Manifiesto creado', usuarioId: generador.usuarioId, createdAt: fechaCreacion }
                ]
            }
        };
        if (estado !== 'BORRADOR') {
            manifiestoData.fechaFirma = new Date(fechaCreacion.getTime() + 3600000);
            manifiestoData.eventos.create.push({ tipo: 'FIRMADO', descripcion: 'Manifiesto firmado', usuarioId: generador.usuarioId, createdAt: manifiestoData.fechaFirma });
        }
        if (['EN_TRANSITO', 'ENTREGADO', 'RECIBIDO'].includes(estado)) {
            manifiestoData.fechaRetiro = new Date(fechaCreacion.getTime() + 7200000);
            manifiestoData.eventos.create.push({ tipo: 'RETIRO_CONFIRMADO', descripcion: 'Retiro confirmado', usuarioId: transportista.usuarioId, createdAt: manifiestoData.fechaRetiro });
        }
        if (['ENTREGADO', 'RECIBIDO'].includes(estado)) {
            manifiestoData.fechaEntrega = new Date(fechaCreacion.getTime() + 14400000);
            manifiestoData.eventos.create.push({ tipo: 'ENTREGA_CONFIRMADA', descripcion: 'Entrega confirmada', usuarioId: transportista.usuarioId, createdAt: manifiestoData.fechaEntrega });
        }
        if (estado === 'RECIBIDO') {
            manifiestoData.fechaRecepcion = new Date(fechaCreacion.getTime() + 18000000);
            manifiestoData.eventos.create.push({ tipo: 'RECEPCION_CONFIRMADA', descripcion: 'Recepción confirmada', usuarioId: operador.usuarioId, createdAt: manifiestoData.fechaRecepcion });
        }
        const manifiesto = await prisma.manifiesto.create({ data: manifiestoData });
        // Generar Tracking GPS para los EN_TRANSITO
        if (estado === 'EN_TRANSITO') {
            const route = ROUTES[i % ROUTES.length];
            const trackingPoints = generateTrackingPoints(route, manifiesto.id);
            await prisma.trackingGPS.createMany({
                data: trackingPoints
            });
            console.log(`📍 Tracking GPS generado para manifiesto ${manifiesto.numero}`);
        }
    }
    console.log('✅ Volcado de datos completado exitosamente!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
