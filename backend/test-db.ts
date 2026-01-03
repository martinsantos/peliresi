import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
    try {
        console.log('Testing connection to sitrep_prod...');
        const count = await prisma.analyticsLog.count();
        console.log(`Successfully connected. Row count in AnalyticsLog: ${count}`);
        
        console.log('Testing batch insertion (createMany)...');
        const batchResult = await prisma.analyticsLog.createMany({
            data: [
                {
                    method: 'BATCH-TEST-1',
                    path: '/test-batch',
                    statusCode: 200,
                    responseTimeMs: 1
                },
                {
                    method: 'BATCH-TEST-2',
                    path: '/test-batch',
                    statusCode: 200,
                    responseTimeMs: 2
                }
            ]
        });
        console.log(`Successfully batch inserted ${batchResult.count} logs.`);
        
    } catch (e) {
        console.error('Error during test:', e);
    } finally {
        await prisma.$disconnect();
    }
}

main();
