import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

const prisma = new PrismaClient();

// ============== GENERADORES (CU-A06) ==============

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [generadores, total] = await Promise.all([
            prisma.generador.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    _count: { select: { manifiestos: true } }
                },
                orderBy: { razonSocial: 'asc' }
            }),
            prisma.generador.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                generadores,
                pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getGeneradorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const generador = await prisma.generador.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                manifiestos: {
                    take: 10,
                    orderBy: { createdAt: 'desc' },
                    select: { id: true, numero: true, estado: true, createdAt: true }
                }
            }
        });

        if (!generador) {
            throw new AppError('Generador no encontrado', 404);
        }

        res.json({ success: true, data: { generador } });
    } catch (error) {
        next(error);
    }
};

export const createGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { razonSocial, cuit, domicilio, telefono, email, numeroInscripcion, categoria } = req.body;

        // Verificar CUIT único
        const existente = await prisma.generador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un generador con ese CUIT', 400);
        }

        // Crear usuario asociado
        const passwordHash = await bcrypt.hash(cuit, 10); // Password inicial = CUIT
        const usuario = await prisma.usuario.create({
            data: {
                email,
                password: passwordHash,
                nombre: razonSocial,
                apellido: '',
                rol: 'GENERADOR'
            }
        });

        // Crear generador
        const generador = await prisma.generador.create({
            data: {
                usuarioId: usuario.id,
                razonSocial,
                cuit,
                domicilio,
                telefono,
                email,
                numeroInscripcion,
                categoria
            },
            include: {
                usuario: { select: { email: true } }
            }
        });

        res.status(201).json({
            success: true,
            data: { generador },
            message: 'Generador creado. Contraseña inicial: ' + cuit
        });
    } catch (error) {
        next(error);
    }
};

export const updateGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo } = req.body;

        const generador = await prisma.generador.update({
            where: { id },
            data: {
                razonSocial,
                domicilio,
                telefono,
                email,
                numeroInscripcion,
                categoria,
                activo
            }
        });

        res.json({ success: true, data: { generador } });
    } catch (error) {
        next(error);
    }
};

export const deleteGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Verificar que no tenga manifiestos
        const manifiestos = await prisma.manifiesto.count({ where: { generadorId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un generador con manifiestos asociados', 400);
        }

        const generador = await prisma.generador.findUnique({ where: { id } });
        if (!generador) {
            throw new AppError('Generador no encontrado', 404);
        }

        // Eliminar generador y su usuario
        await prisma.generador.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: generador.usuarioId } });

        res.json({ success: true, message: 'Generador eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== TRANSPORTISTAS (CU-A07) ==============

export const getTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [transportistas, total] = await Promise.all([
            prisma.transportista.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    vehiculos: true,
                    choferes: true,
                    _count: { select: { manifiestos: true } }
                },
                orderBy: { razonSocial: 'asc' }
            }),
            prisma.transportista.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                transportistas,
                pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getTransportistaById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const transportista = await prisma.transportista.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                vehiculos: true,
                choferes: true
            }
        });

        if (!transportista) {
            throw new AppError('Transportista no encontrado', 404);
        }

        res.json({ success: true, data: { transportista } });
    } catch (error) {
        next(error);
    }
};

export const createTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { razonSocial, cuit, domicilio, numeroHabilitacion, telefono, email, vehiculos, choferes } = req.body;

        const existente = await prisma.transportista.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un transportista con ese CUIT', 400);
        }

        const passwordHash = await bcrypt.hash(cuit, 10);
        const usuario = await prisma.usuario.create({
            data: {
                email,
                password: passwordHash,
                nombre: razonSocial,
                apellido: '',
                rol: 'TRANSPORTISTA'
            }
        });

        const transportista = await prisma.transportista.create({
            data: {
                usuarioId: usuario.id,
                razonSocial,
                cuit,
                domicilio,
                numeroHabilitacion,
                telefono,
                email,
                vehiculos: vehiculos ? {
                    create: vehiculos.map((v: any) => ({
                        patente: v.patente,
                        marca: v.marca,
                        modelo: v.modelo,
                        anio: v.anio,
                        capacidad: v.capacidad,
                        numeroHabilitacion: v.numeroHabilitacion,
                        vencimiento: new Date(v.vencimiento)
                    }))
                } : undefined,
                choferes: choferes ? {
                    create: choferes.map((c: any) => ({
                        nombre: c.nombre,
                        apellido: c.apellido || '',
                        dni: c.dni,
                        licencia: c.licencia,
                        vencimiento: new Date(c.vencimiento),
                        telefono: c.telefono || ''
                    }))
                } : undefined
            },
            include: { vehiculos: true, choferes: true }
        });

        res.status(201).json({
            success: true,
            data: { transportista },
            message: 'Transportista creado. Contraseña inicial: ' + cuit
        });
    } catch (error) {
        next(error);
    }
};

export const updateTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { razonSocial, domicilio, numeroHabilitacion, telefono, email, activo } = req.body;

        const transportista = await prisma.transportista.update({
            where: { id },
            data: { razonSocial, domicilio, numeroHabilitacion, telefono, email, activo }
        });

        res.json({ success: true, data: { transportista } });
    } catch (error) {
        next(error);
    }
};

// Gestionar vehículos
export const addVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { patente, marca, modelo, anio, capacidad, numeroHabilitacion, vencimiento } = req.body;

        const vehiculo = await prisma.vehiculo.create({
            data: {
                transportistaId: id,
                patente,
                marca,
                modelo,
                anio,
                capacidad,
                numeroHabilitacion,
                vencimiento: new Date(vencimiento)
            }
        });

        res.status(201).json({ success: true, data: { vehiculo } });
    } catch (error) {
        next(error);
    }
};

// Gestionar choferes
export const addChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { nombre, apellido, dni, licencia, vencimiento, telefono } = req.body;

        const chofer = await prisma.chofer.create({
            data: {
                transportistaId: id,
                nombre,
                apellido: apellido || '',
                dni,
                licencia,
                vencimiento: new Date(vencimiento),
                telefono: telefono || ''
            }
        });

        res.status(201).json({ success: true, data: { chofer } });
    } catch (error) {
        next(error);
    }
};

// ============== OPERADORES (CU-A08) ==============

export const getOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page = 1, limit = 10 } = req.query;
        const skip = (Number(page) - 1) * Number(limit);

        const where: any = {};
        if (search) {
            where.OR = [
                { razonSocial: { contains: search as string, mode: 'insensitive' } },
                { cuit: { contains: search as string } }
            ];
        }
        if (activo !== undefined) {
            where.activo = activo === 'true';
        }

        const [operadores, total] = await Promise.all([
            prisma.operador.findMany({
                where,
                skip,
                take: Number(limit),
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    tratamientos: { include: { tipoResiduo: true } },
                    _count: { select: { manifiestos: true } }
                },
                orderBy: { razonSocial: 'asc' }
            }),
            prisma.operador.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                operadores,
                pagination: { page: Number(page), limit: Number(limit), total, pages: Math.ceil(total / Number(limit)) }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const getOperadorById = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const operador = await prisma.operador.findUnique({
            where: { id },
            include: {
                usuario: { select: { email: true, nombre: true, apellido: true } },
                tratamientos: true
            }
        });

        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        res.json({ success: true, data: { operador } });
    } catch (error) {
        next(error);
    }
};

export const createOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { razonSocial, cuit, numeroHabilitacion, domicilio, telefono, email, categoria } = req.body;

        const existente = await prisma.operador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un operador con ese CUIT', 400);
        }

        const passwordHash = await bcrypt.hash(cuit, 10);
        const usuario = await prisma.usuario.create({
            data: {
                email,
                password: passwordHash,
                nombre: razonSocial,
                apellido: '',
                rol: 'OPERADOR'
            }
        });

        const operador = await prisma.operador.create({
            data: {
                usuarioId: usuario.id,
                razonSocial,
                cuit,
                numeroHabilitacion,
                domicilio,
                telefono,
                email,
                categoria
            }
        });

        res.status(201).json({
            success: true,
            data: { operador },
            message: 'Operador creado. Contraseña inicial: ' + cuit
        });
    } catch (error) {
        next(error);
    }
};

export const updateOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { razonSocial, numeroHabilitacion, domicilio, telefono, email, categoria, activo } = req.body;

        const operador = await prisma.operador.update({
            where: { id },
            data: {
                razonSocial,
                numeroHabilitacion,
                domicilio,
                telefono,
                email,
                categoria,
                activo
            }
        });

        res.json({ success: true, data: { operador } });
    } catch (error) {
        next(error);
    }
};

export const deleteOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiestos = await prisma.manifiesto.count({ where: { operadorId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un operador con manifiestos asociados', 400);
        }

        const operador = await prisma.operador.findUnique({ where: { id } });
        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        await prisma.operador.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: operador.usuarioId } });

        res.json({ success: true, message: 'Operador eliminado' });
    } catch (error) {
        next(error);
    }
};
