import { Request, Response, NextFunction } from 'express';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { config } from '../config/config';
import { verificarEnBlockchain, registrarEnBlockchain } from '../services/blockchain.service';

/**
 * GET /api/blockchain/manifiesto/:id
 * Retorna el estado blockchain de un manifiesto (requiere auth).
 */
export const getBlockchainStatus = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: {
        blockchainHash: true,
        blockchainTxHash: true,
        blockchainBlockNumber: true,
        blockchainTimestamp: true,
        blockchainStatus: true,
      },
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    res.json({
      success: true,
      data: {
        blockchain: {
          ...manifiesto,
          enabled: config.BLOCKCHAIN_ENABLED,
          network: 'Ethereum Sepolia',
          contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS || null,
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/blockchain/registrar/:id
 * Registra un manifiesto en blockchain on-demand (requiere auth).
 * Solo funciona si el manifiesto esta APROBADO o posterior y no tiene blockchain aun.
 */
export const registrarBlockchain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;

    if (!config.BLOCKCHAIN_ENABLED) {
      throw new AppError('Blockchain no esta habilitado', 400);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: { estado: true, blockchainStatus: true },
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado === 'BORRADOR') {
      throw new AppError('El manifiesto debe estar firmado para certificar en blockchain', 400);
    }

    if (manifiesto.blockchainStatus === 'CONFIRMADO') {
      throw new AppError('El manifiesto ya esta certificado en blockchain', 400);
    }

    // Fire-and-forget: start registration, respond immediately
    setImmediate(() => {
      registrarEnBlockchain(id).catch((err) => {
        console.error('[Blockchain] Error registrando manifiesto:', err.message);
      });
    });

    res.json({
      success: true,
      message: 'Registro blockchain iniciado',
      data: { blockchainStatus: 'PENDIENTE' },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/verificar/:hash
 * Verificacion publica de un hash en blockchain (sin auth).
 */
export const verificarBlockchainPublico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { hash } = req.params;

    if (!hash || hash.length !== 64) {
      throw new AppError('Hash SHA-256 invalido (debe ser 64 caracteres hex)', 400);
    }

    if (!config.BLOCKCHAIN_ENABLED) {
      res.json({
        success: true,
        data: { enabled: false, exists: false, timestamp: 0 },
      });
      return;
    }

    const result = await verificarEnBlockchain(hash);
    res.json({
      success: true,
      data: {
        enabled: true,
        ...result,
        network: 'Ethereum Sepolia',
        contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/blockchain/registro
 * Lista todos los manifiestos con registro blockchain (requiere auth ADMIN).
 */
export const getRegistroBlockchain = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const page = parseInt(req.query.page as string) || 1;
    const limit = Math.min(parseInt(req.query.limit as string) || 20, 100);
    const status = req.query.status as string;

    const where: any = {
      blockchainHash: { not: null },
    };
    if (status) {
      where.blockchainStatus = status;
    }

    const [manifiestos, total] = await Promise.all([
      prisma.manifiesto.findMany({
        where,
        select: {
          id: true,
          numero: true,
          estado: true,
          fechaFirma: true,
          blockchainHash: true,
          blockchainTxHash: true,
          blockchainBlockNumber: true,
          blockchainTimestamp: true,
          blockchainStatus: true,
          generador: { select: { razonSocial: true } },
          operador: { select: { razonSocial: true } },
        },
        orderBy: { blockchainTimestamp: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.manifiesto.count({ where }),
    ]);

    res.json({
      success: true,
      data: {
        manifiestos,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
        contractAddress: config.BLOCKCHAIN_CONTRACT_ADDRESS,
        network: 'Ethereum Sepolia',
      },
    });
  } catch (error) {
    next(error);
  }
};
