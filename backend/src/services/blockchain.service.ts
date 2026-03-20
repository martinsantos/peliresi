import { ethers } from 'ethers';
import crypto from 'crypto';
import prisma from '../lib/prisma';
import { config } from '../config/config';
import SitrepRegistryABI from '../contracts/SitrepRegistry.json';

// Lazy-initialized connections (only when BLOCKCHAIN_ENABLED=true)
let provider: ethers.JsonRpcProvider | null = null;
let wallet: ethers.Wallet | null = null;
let contract: ethers.Contract | null = null;

function getContract(): ethers.Contract {
  if (!contract) {
    if (!config.BLOCKCHAIN_RPC_URL || !config.BLOCKCHAIN_CONTRACT_ADDRESS) {
      throw new Error('BLOCKCHAIN_RPC_URL and BLOCKCHAIN_CONTRACT_ADDRESS must be set');
    }
    provider = new ethers.JsonRpcProvider(config.BLOCKCHAIN_RPC_URL);
    wallet = new ethers.Wallet(process.env.BLOCKCHAIN_PRIVATE_KEY!, provider);
    contract = new ethers.Contract(
      config.BLOCKCHAIN_CONTRACT_ADDRESS,
      SitrepRegistryABI,
      wallet
    );
  }
  return contract;
}

interface ManifiestoParaHash {
  numero: string;
  generadorId: string;
  generador: { cuit: string };
  transportistaId: string;
  transportista: { cuit: string };
  operadorId: string;
  operador: { cuit: string };
  residuos: Array<{ tipoResiduoId: string; cantidad: number; unidad: string }>;
  fechaFirma: Date | null;
}

/**
 * Genera un hash SHA-256 determinista del manifiesto.
 * El JSON canonico usa claves ordenadas y residuos sorted por tipoResiduoId.
 */
export function hashManifiesto(manifiesto: ManifiestoParaHash): string {
  const residuosSorted = [...manifiesto.residuos]
    .sort((a, b) => a.tipoResiduoId.localeCompare(b.tipoResiduoId))
    .map(r => ({
      tipoResiduoId: r.tipoResiduoId,
      cantidad: r.cantidad,
      unidad: r.unidad,
    }));

  const canonical = JSON.stringify({
    numero: manifiesto.numero,
    generadorId: manifiesto.generadorId,
    generadorCuit: manifiesto.generador.cuit,
    transportistaId: manifiesto.transportistaId,
    transportistaCuit: manifiesto.transportista.cuit,
    operadorId: manifiesto.operadorId,
    operadorCuit: manifiesto.operador.cuit,
    residuos: residuosSorted,
    fechaFirma: manifiesto.fechaFirma?.toISOString() ?? null,
  });

  return crypto.createHash('sha256').update(canonical).digest('hex');
}

/**
 * Registra un manifiesto en blockchain (fire-and-forget).
 * No lanza excepciones — errores se loguean y el status queda ERROR.
 */
export async function registrarEnBlockchain(manifiestoId: string): Promise<void> {
  if (!config.BLOCKCHAIN_ENABLED) return;

  try {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: {
        generador: { select: { cuit: true } },
        transportista: { select: { cuit: true } },
        operador: { select: { cuit: true } },
        residuos: { select: { tipoResiduoId: true, cantidad: true, unidad: true } },
      },
    });

    if (!manifiesto) {
      console.error(`[Blockchain] Manifiesto ${manifiestoId} no encontrado`);
      return;
    }

    const hash = hashManifiesto(manifiesto);
    const hashBytes32 = '0x' + hash;

    // Mark as PENDIENTE with the hash
    await prisma.manifiesto.update({
      where: { id: manifiestoId },
      data: { blockchainHash: hash, blockchainStatus: 'PENDIENTE' },
    });

    const c = getContract();
    const tx = await c.registrar(hashBytes32);

    // Store tx hash immediately (before confirmation)
    await prisma.manifiesto.update({
      where: { id: manifiestoId },
      data: { blockchainTxHash: tx.hash },
    });

    // Wait for 1 confirmation
    const receipt = await tx.wait(1);

    // Update with confirmation data
    const block = await provider!.getBlock(receipt.blockNumber);
    await prisma.manifiesto.update({
      where: { id: manifiestoId },
      data: {
        blockchainBlockNumber: receipt.blockNumber,
        blockchainTimestamp: block ? new Date(block.timestamp * 1000) : new Date(),
        blockchainStatus: 'CONFIRMADO',
      },
    });

    console.log(`[Blockchain] Manifiesto ${manifiesto.numero} registrado — tx: ${tx.hash}`);
  } catch (err: any) {
    console.error(`[Blockchain] Error registrando ${manifiestoId}:`, err.message);
    try {
      await prisma.manifiesto.update({
        where: { id: manifiestoId },
        data: {
          blockchainStatus: 'ERROR',
          blockchainRetries: { increment: 1 },
        },
      });
    } catch { /* ignore DB error during error handling */ }
  }
}

/**
 * Verifica un hash en el smart contract (lectura gratuita).
 */
export async function verificarEnBlockchain(hash: string): Promise<{ exists: boolean; timestamp: number }> {
  if (!config.BLOCKCHAIN_ENABLED) {
    return { exists: false, timestamp: 0 };
  }

  const c = getContract();
  const hashBytes32 = '0x' + hash;
  const [exists, timestamp] = await c.verificar(hashBytes32);
  return { exists, timestamp: Number(timestamp) };
}

/**
 * Procesa manifiestos con registros blockchain pendientes o fallidos.
 * Llamado por el cron job cada 60 segundos.
 */
export async function procesarPendientes(): Promise<void> {
  if (!config.BLOCKCHAIN_ENABLED) return;

  const pendientes = await prisma.manifiesto.findMany({
    where: {
      blockchainHash: { not: null },
      blockchainStatus: { in: ['PENDIENTE', 'ERROR'] },
      blockchainRetries: { lt: 3 },
    },
    select: { id: true, numero: true, blockchainTxHash: true, blockchainStatus: true },
    take: 10,
  });

  if (pendientes.length === 0) return;

  console.log(`[Blockchain] Procesando ${pendientes.length} registros pendientes`);

  for (const m of pendientes) {
    // If we have a tx hash, check if it was confirmed
    if (m.blockchainTxHash && m.blockchainStatus === 'PENDIENTE') {
      try {
        const receipt = await provider!.getTransactionReceipt(m.blockchainTxHash);
        if (receipt && receipt.status === 1) {
          const block = await provider!.getBlock(receipt.blockNumber);
          await prisma.manifiesto.update({
            where: { id: m.id },
            data: {
              blockchainBlockNumber: receipt.blockNumber,
              blockchainTimestamp: block ? new Date(block.timestamp * 1000) : new Date(),
              blockchainStatus: 'CONFIRMADO',
            },
          });
          console.log(`[Blockchain] Confirmado: ${m.numero} — tx: ${m.blockchainTxHash}`);
          continue;
        }
      } catch { /* fall through to retry */ }
    }

    // Re-attempt registration
    await registrarEnBlockchain(m.id);
  }
}
