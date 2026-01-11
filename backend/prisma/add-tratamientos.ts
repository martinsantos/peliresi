/**
 * Script to add authorized treatments for all waste types to all operators
 * Run with: npx ts-node prisma/add-tratamientos.ts
 */
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Treatment methods for each category
const metodoPorCategoria: Record<string, { metodo: string; descripcion: string }> = {
    'Ácidos': { metodo: 'Neutralización química', descripcion: 'Neutralización con bases controladas' },
    'Bases': { metodo: 'Neutralización química', descripcion: 'Neutralización con ácidos controlados' },
    'Disolventes': { metodo: 'Incineración controlada', descripcion: 'Incineración a alta temperatura (1200°C)' },
    'Aceites': { metodo: 'Recuperación y reciclaje', descripcion: 'Procesamiento para reutilización' },
    'Lodos': { metodo: 'Estabilización/Solidificación', descripcion: 'Encapsulamiento en matriz sólida' },
    'Baterías': { metodo: 'Reciclaje de componentes', descripcion: 'Separación y recuperación de metales' },
    'Químicos': { metodo: 'Tratamiento fisicoquímico', descripcion: 'Procesos de oxidación/reducción' },
    'Pinturas': { metodo: 'Incineración controlada', descripcion: 'Destrucción térmica de orgánicos' },
    'Plásticos': { metodo: 'Incineración con recuperación energética', descripcion: 'Valorización energética' },
    'Biológicos': { metodo: 'Autoclave + Incineración', descripcion: 'Esterilización y destrucción térmica' },
};

async function main() {
    console.log('🔄 Agregando tratamientos autorizados para todos los tipos de residuos...\n');

    // Get all operators
    const operadores = await prisma.operador.findMany({
        where: { activo: true },
        select: { id: true, razonSocial: true }
    });

    console.log(`📋 Operadores encontrados: ${operadores.length}`);

    // Get all waste types
    const tiposResiduos = await prisma.tipoResiduo.findMany({
        where: { activo: true },
        select: { id: true, codigo: true, nombre: true, categoria: true }
    });

    console.log(`📋 Tipos de residuos encontrados: ${tiposResiduos.length}\n`);

    let created = 0;
    let skipped = 0;

    for (const operador of operadores) {
        console.log(`\n🏭 Procesando: ${operador.razonSocial}`);

        for (const tipoResiduo of tiposResiduos) {
            const categoria = tipoResiduo.categoria || 'Químicos';
            const tratamiento = metodoPorCategoria[categoria] || metodoPorCategoria['Químicos'];

            try {
                await prisma.tratamientoAutorizado.upsert({
                    where: {
                        operadorId_tipoResiduoId_metodo: {
                            operadorId: operador.id,
                            tipoResiduoId: tipoResiduo.id,
                            metodo: tratamiento.metodo
                        }
                    },
                    update: {},
                    create: {
                        operadorId: operador.id,
                        tipoResiduoId: tipoResiduo.id,
                        metodo: tratamiento.metodo,
                        descripcion: tratamiento.descripcion,
                        capacidad: 5000 + Math.floor(Math.random() * 5000), // 5000-10000
                        activo: true
                    }
                });
                created++;
                console.log(`   ✅ ${tipoResiduo.codigo} - ${tipoResiduo.nombre}: ${tratamiento.metodo}`);
            } catch (e: any) {
                if (e.code === 'P2002') {
                    skipped++;
                    console.log(`   ⏭️  ${tipoResiduo.codigo} ya existe`);
                } else {
                    console.error(`   ❌ Error: ${e.message}`);
                }
            }
        }
    }

    console.log('\n' + '='.repeat(60));
    console.log(`✅ Tratamientos creados/actualizados: ${created}`);
    console.log(`⏭️  Ya existentes: ${skipped}`);
    console.log('='.repeat(60));
}

main()
    .catch((e) => {
        console.error('❌ Error:', e);
        process.exit(1);
    })
    .finally(async () => {
        await prisma.$disconnect();
    });
