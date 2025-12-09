"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const client_1 = require("@prisma/client");
const bcryptjs_1 = __importDefault(require("bcryptjs"));
const prisma = new client_1.PrismaClient();
async function main() {
    console.log('Iniciando seed de datos...');
    // Crear usuario administrador
    const adminPassword = await bcryptjs_1.default.hash('admin123', 10);
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
    // Crear tipos de residuos según Ley 24.051
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
    // Crear generadores
    const generadores = [
        {
            usuario: {
                email: 'quimica.mendoza@industria.com',
                password: await bcryptjs_1.default.hash('gen123', 10),
                rol: 'GENERADOR',
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
                password: await bcryptjs_1.default.hash('gen123', 10),
                rol: 'GENERADOR',
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
                password: await bcryptjs_1.default.hash('gen123', 10),
                rol: 'GENERADOR',
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
    for (const gen of generadores) {
        const usuario = await prisma.usuario.upsert({
            where: { email: gen.usuario.email },
            update: {},
            create: gen.usuario,
        });
        await prisma.generador.upsert({
            where: { usuarioId: usuario.id },
            update: {},
            create: {
                ...gen.generador,
                usuarioId: usuario.id,
            },
        });
    }
    // Crear transportistas
    const transportistas = [
        {
            usuario: {
                email: 'transportes.andes@logistica.com',
                password: await bcryptjs_1.default.hash('trans123', 10),
                rol: 'TRANSPORTISTA',
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
                password: await bcryptjs_1.default.hash('trans123', 10),
                rol: 'TRANSPORTISTA',
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
    for (const trans of transportistas) {
        const usuario = await prisma.usuario.upsert({
            where: { email: trans.usuario.email },
            update: {},
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
        // Crear vehículos para cada transportista
        const vehiculos = [
            {
                transportistaId: transportista.id,
                patente: 'AB123CD',
                marca: 'Mercedes-Benz',
                modelo: 'Axor',
                anio: 2020,
                capacidad: 15000,
                numeroHabilitacion: 'HV-001-2023',
                vencimiento: new Date('2024-12-31'),
            },
            {
                transportistaId: transportista.id,
                patente: 'EF456GH',
                marca: 'Scania',
                modelo: 'R450',
                anio: 2021,
                capacidad: 18000,
                numeroHabilitacion: 'HV-002-2023',
                vencimiento: new Date('2024-12-31'),
            },
        ];
        for (const vehiculo of vehiculos) {
            await prisma.vehiculo.create({
                data: vehiculo,
            });
        }
        // Crear choferes
        const choferes = [
            {
                transportistaId: transportista.id,
                nombre: 'Juan',
                apellido: 'Pérez',
                dni: '12345678',
                licencia: 'A123456',
                vencimiento: new Date('2024-06-30'),
                telefono: '2615551234',
            },
            {
                transportistaId: transportista.id,
                nombre: 'Luis',
                apellido: 'Sánchez',
                dni: '87654321',
                licencia: 'B654321',
                vencimiento: new Date('2024-09-30'),
                telefono: '2615559876',
            },
        ];
        for (const chofer of choferes) {
            await prisma.chofer.create({
                data: chofer,
            });
        }
    }
    // Obtener los IDs de los tipos de residuos
    const residuos = await prisma.tipoResiduo.findMany();
    const residuosMap = new Map(residuos.map(r => [r.codigo, r.id]));
    // Crear operadores
    const operadores = [
        {
            usuario: {
                email: 'tratamiento.residuos@planta.com',
                password: await bcryptjs_1.default.hash('op123', 10),
                rol: 'OPERADOR',
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
                password: await bcryptjs_1.default.hash('op123', 10),
                rol: 'OPERADOR',
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
    for (const op of operadores) {
        const usuario = await prisma.usuario.upsert({
            where: { email: op.usuario.email },
            update: {},
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
        // Crear tratamientos autorizados
        const tratamientos = [
            {
                operadorId: operador.id,
                tipoResiduoId: residuosMap.get('Y1') || '',
                metodo: 'Neutralización química',
                descripcion: 'Proceso de neutralización con bases',
                capacidad: 5000,
            },
            {
                operadorId: operador.id,
                tipoResiduoId: residuosMap.get('Y6') || '',
                metodo: 'Incineración',
                descripcion: 'Incineración a alta temperatura',
                capacidad: 3000,
            },
            {
                operadorId: operador.id,
                tipoResiduoId: residuosMap.get('Y9') || '',
                metodo: 'Estabilización',
                descripcion: 'Estabilización química de lodos',
                capacidad: 10000,
            },
        ];
        for (const tratamiento of tratamientos) {
            await prisma.tratamientoAutorizado.upsert({
                where: {
                    operadorId_tipoResiduoId_metodo: {
                        operadorId: tratamiento.operadorId,
                        tipoResiduoId: tratamiento.tipoResiduoId,
                        metodo: tratamiento.metodo,
                    },
                },
                update: {},
                create: tratamiento,
            });
        }
    }
    console.log('Seed completado exitosamente!');
}
main()
    .catch((e) => {
    console.error(e);
    process.exit(1);
})
    .finally(async () => {
    await prisma.$disconnect();
});
