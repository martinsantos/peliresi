import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// Obtener tipos de residuos
export const getTiposResiduos = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { categoria, activo } = req.query;

        const where: any = {};
        if (categoria) where.categoria = categoria;
        if (activo !== undefined) where.activo = activo === 'true';

        const tiposResiduos = await prisma.tipoResiduo.findMany({
            where,
            orderBy: { codigo: 'asc' }
        });

        res.json({
            success: true,
            data: { tiposResiduos }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener generadores
export const getGeneradores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activo } = req.query;

        const where: any = {};
        if (activo !== undefined) where.activo = activo === 'true';

        const generadores = await prisma.generador.findMany({
            where,
            orderBy: { razonSocial: 'asc' },
            include: {
                usuario: {
                    select: {
                        email: true,
                        nombre: true,
                        apellido: true
                    }
                }
            }
        });

        res.json({
            success: true,
            data: { generadores }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener transportistas
export const getTransportistas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activo } = req.query;

        const where: any = {};
        if (activo !== undefined) where.activo = activo === 'true';

        const transportistas = await prisma.transportista.findMany({
            where,
            orderBy: { razonSocial: 'asc' },
            include: {
                usuario: {
                    select: {
                        email: true,
                        nombre: true,
                        apellido: true
                    }
                },
                vehiculos: true,
                choferes: true
            }
        });

        res.json({
            success: true,
            data: { transportistas }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener operadores
export const getOperadores = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { activo, tipoResiduoId } = req.query;

        const where: any = {};
        if (activo !== undefined) where.activo = activo === 'true';

        let operadores = await prisma.operador.findMany({
            where,
            orderBy: { razonSocial: 'asc' },
            include: {
                usuario: {
                    select: {
                        email: true,
                        nombre: true,
                        apellido: true
                    }
                },
                tratamientos: {
                    include: {
                        tipoResiduo: true
                    }
                }
            }
        });

        // Filtrar por tipo de residuo si se especifica
        if (tipoResiduoId) {
            operadores = operadores.filter(op =>
                op.tratamientos.some(t => t.tipoResiduoId === tipoResiduoId)
            );
        }

        res.json({
            success: true,
            data: { operadores }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener todos los vehículos (global)
export const getAllVehiculos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const vehiculos = await prisma.vehiculo.findMany({
            where: { activo: true },
            include: {
                transportista: { select: { razonSocial: true, cuit: true } }
            },
            orderBy: { patente: 'asc' }
        });

        res.json({ success: true, data: { vehiculos } });
    } catch (error) {
        next(error);
    }
};

// Obtener todos los choferes (global)
export const getAllChoferes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const choferes = await prisma.chofer.findMany({
            where: { activo: true },
            include: {
                transportista: { select: { razonSocial: true, cuit: true } }
            },
            orderBy: { apellido: 'asc' }
        });

        res.json({ success: true, data: { choferes } });
    } catch (error) {
        next(error);
    }
};

// Obtener vehículos de un transportista
export const getVehiculos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { transportistaId } = req.params;

        const vehiculos = await prisma.vehiculo.findMany({
            where: {
                transportistaId,
                activo: true
            },
            orderBy: { patente: 'asc' }
        });

        res.json({
            success: true,
            data: { vehiculos }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener choferes de un transportista
export const getChoferes = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { transportistaId } = req.params;

        const choferes = await prisma.chofer.findMany({
            where: {
                transportistaId,
                activo: true
            },
            orderBy: { apellido: 'asc' }
        });

        res.json({
            success: true,
            data: { choferes }
        });
    } catch (error) {
        next(error);
    }
};

// Obtener tratamientos autorizados de un operador
export const getTratamientos = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { operadorId } = req.params;

        const tratamientos = await prisma.tratamientoAutorizado.findMany({
            where: {
                operadorId,
                activo: true
            },
            include: {
                tipoResiduo: true
            }
        });

        res.json({
            success: true,
            data: { tratamientos }
        });
    } catch (error) {
        next(error);
    }
};
