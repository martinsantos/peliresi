import { mayRegisterScheduledJob } from '../config/scheduledTaskGate';
import cron from 'node-cron';
import { config } from '../config/config';
import { procesarPendientes } from '../services/blockchain.service';

export function iniciarBlockchainJob(): void {
  if (!config.BLOCKCHAIN_ENABLED) {
    console.log('[BlockchainJob] Blockchain deshabilitado, skipping cron');
    return;
  }

  if (!mayRegisterScheduledJob('BlockchainJob')) return;

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
