import { Request, Response, NextFunction } from 'express';
import path from 'path';
import prisma from '../lib/prisma';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// Pre-load enrichment JSON once at startup (they're static, ~580KB total)
const DATA_DIR = path.join(__dirname, '..', '..', 'data');
const generadoresEnrichment = require(path.join(DATA_DIR, 'generadores-enrichment.json'));
const generadoresTopRubros = require(path.join(DATA_DIR, 'generadores-top-rubros.json'));
const operadoresEnrichment = require(path.join(DATA_DIR, 'operadores-enrichment.json'));
const operadoresPorCorriente = require(path.join(DATA_DIR, 'operadores-por-corriente.json'));

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
        // Push tipoResiduoId filter to DB instead of filtering in JS (avoids loading all operadores)
        if (tipoResiduoId) {
            where.tratamientos = { some: { tipoResiduoId: tipoResiduoId as string } };
        }

        const operadores = await prisma.operador.findMany({
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

// Crear tipo de residuo (ADMIN)
export const createTipoResiduo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { codigo, nombre, descripcion, categoria, caracteristicas, peligrosidad } = req.body;

        if (!codigo || !nombre || !categoria || !peligrosidad) {
            throw new AppError('Campos requeridos: codigo, nombre, categoria, peligrosidad', 400);
        }

        // Check unique codigo
        const existing = await prisma.tipoResiduo.findUnique({ where: { codigo } });
        if (existing) {
            throw new AppError(`Ya existe un tipo de residuo con código ${codigo}`, 409);
        }

        const tipoResiduo = await prisma.tipoResiduo.create({
            data: { codigo, nombre, descripcion: descripcion || null, categoria, caracteristicas: caracteristicas || null, peligrosidad, activo: true }
        });

        res.status(201).json({ success: true, data: { tipoResiduo } });
    } catch (error) {
        next(error);
    }
};

// Actualizar tipo de residuo (ADMIN)
export const updateTipoResiduo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { codigo, nombre, descripcion, categoria, caracteristicas, peligrosidad, activo } = req.body;

        const existing = await prisma.tipoResiduo.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('Tipo de residuo no encontrado', 404);
        }

        // If changing codigo, check uniqueness
        if (codigo && codigo !== existing.codigo) {
            const dup = await prisma.tipoResiduo.findUnique({ where: { codigo } });
            if (dup) {
                throw new AppError(`Ya existe un tipo de residuo con código ${codigo}`, 409);
            }
        }

        const tipoResiduo = await prisma.tipoResiduo.update({
            where: { id },
            data: {
                ...(codigo !== undefined && { codigo }),
                ...(nombre !== undefined && { nombre }),
                ...(descripcion !== undefined && { descripcion }),
                ...(categoria !== undefined && { categoria }),
                ...(caracteristicas !== undefined && { caracteristicas }),
                ...(peligrosidad !== undefined && { peligrosidad }),
                ...(activo !== undefined && { activo }),
            }
        });

        res.json({ success: true, data: { tipoResiduo } });
    } catch (error) {
        next(error);
    }
};

// Eliminar tipo de residuo (ADMIN)
export const deleteTipoResiduo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const existing = await prisma.tipoResiduo.findUnique({
            where: { id },
            include: { _count: { select: { manifiestos: true, tratamientos: true } } }
        });
        if (!existing) {
            throw new AppError('Tipo de residuo no encontrado', 404);
        }

        // Prevent deletion if used in manifiestos or tratamientos
        if (existing._count.manifiestos > 0) {
            throw new AppError(`No se puede eliminar: tiene ${existing._count.manifiestos} manifiesto(s) asociado(s)`, 409);
        }
        if (existing._count.tratamientos > 0) {
            throw new AppError(`No se puede eliminar: tiene ${existing._count.tratamientos} tratamiento(s) autorizado(s)`, 409);
        }

        await prisma.tipoResiduo.delete({ where: { id } });

        res.json({ success: true, message: 'Tipo de residuo eliminado' });
    } catch (error) {
        next(error);
    }
};

// CRUD Tratamientos Autorizados
export const createTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { operadorId, tipoResiduoId, metodo, descripcion, capacidad } = req.body;

        if (!operadorId || !tipoResiduoId || !metodo) {
            throw new AppError('Campos requeridos: operadorId, tipoResiduoId, metodo', 400);
        }

        // Verify operador exists
        const operador = await prisma.operador.findUnique({ where: { id: operadorId } });
        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        // Verify tipoResiduo exists
        const tipoResiduo = await prisma.tipoResiduo.findUnique({ where: { id: tipoResiduoId } });
        if (!tipoResiduo) {
            throw new AppError('Tipo de residuo no encontrado', 404);
        }

        const tratamiento = await prisma.tratamientoAutorizado.create({
            data: {
                operadorId,
                tipoResiduoId,
                metodo,
                descripcion: descripcion || null,
                capacidad: capacidad || null,
            },
            include: { tipoResiduo: true, operador: { select: { razonSocial: true } } }
        });

        res.status(201).json({ success: true, data: { tratamiento } });
    } catch (error) {
        next(error);
    }
};

export const updateTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { metodo, descripcion, capacidad, activo } = req.body;

        const existing = await prisma.tratamientoAutorizado.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('Tratamiento autorizado no encontrado', 404);
        }

        const tratamiento = await prisma.tratamientoAutorizado.update({
            where: { id },
            data: {
                ...(metodo !== undefined && { metodo }),
                ...(descripcion !== undefined && { descripcion }),
                ...(capacidad !== undefined && { capacidad }),
                ...(activo !== undefined && { activo }),
            },
            include: { tipoResiduo: true }
        });

        res.json({ success: true, data: { tratamiento } });
    } catch (error) {
        next(error);
    }
};

export const deleteTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const existing = await prisma.tratamientoAutorizado.findUnique({ where: { id } });
        if (!existing) {
            throw new AppError('Tratamiento autorizado no encontrado', 404);
        }

        await prisma.tratamientoAutorizado.delete({ where: { id } });

        res.json({ success: true, message: 'Tratamiento autorizado eliminado' });
    } catch (error) {
        next(error);
    }
};

// Listar todos los tratamientos autorizados (ADMIN)
export const getAllTratamientos = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const tratamientos = await prisma.tratamientoAutorizado.findMany({
            include: {
                tipoResiduo: true,
                operador: { select: { id: true, razonSocial: true, cuit: true } }
            },
            orderBy: { createdAt: 'desc' }
        });

        res.json({ success: true, data: { tratamientos } });
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

// =============================================
// Enrichment data (static JSON, pre-loaded)
// =============================================

// GET /api/catalogos/enrichment/generadores
export const getGeneradoresEnrichment = (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ success: true, data: generadoresEnrichment, topRubros: generadoresTopRubros });
    } catch (error) {
        next(error);
    }
};

// GET /api/catalogos/enrichment/operadores
export const getOperadoresEnrichment = (_req: Request, res: Response, next: NextFunction) => {
    try {
        res.json({ success: true, data: operadoresEnrichment, porCorriente: operadoresPorCorriente });
    } catch (error) {
        next(error);
    }
};
