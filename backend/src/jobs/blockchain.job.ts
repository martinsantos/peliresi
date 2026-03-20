import cron from 'node-cron';
import { config } from '../config/config';
import { procesarPendientes } from '../services/blockchain.service';

export function iniciarBlockchainJob(): void {
  if (!config.BLOCKCHAIN_ENABLED) {
    console.log('[BlockchainJob] Blockchain deshabilitado, skipping cron');
    return;
  }

  // Solo ejecutar en instancia 0 de PM2 cluster para evitar duplicacion
  const instanceId = process.env.INSTANCE_ID || process.env.pm_id;
  if (instanceId && instanceId !== '0') {
    console.log(`[BlockchainJob] PM2 instancia ${instanceId}, skipping cron`);
    return;
  }

  // Verificar registros pendientes/fallidos cada 60 segundos
  cron.schedule('*/1 * * * *', async () => {
    try {
      await procesarPendientes();
    } catch (err: any) {
      console.error('[BlockchainJob] Error:', err.message);
    }
  });

  console.log('[BlockchainJob] Cron registrado (cada 60s)');
}
