import { Response, NextFunction } from 'express';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import { bulkUploadService } from '../services/bulkUpload.service';
import { parsePagination, buildPaginationResult } from '../utils/pagination';

const prisma = new PrismaClient();

// ============== MI PERFIL (Actor del usuario logueado) ==============

export const getMiPerfil = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const userId = req.user.id;
        const userRol = req.user.rol;
        const demoProfile = (req as any).demoProfile;

        let actor = null;
        let stats = null;
        let actorId: string | null = null;

        // Si está en modo demo con actor impersonado, usar ese actor
        if (demoProfile?.enabled && demoProfile.impersonatedActorId) {
            actorId = demoProfile.impersonatedActorId;
        }

        // Cargar actor según rol
        if (userRol === 'GENERADOR') {
            // En modo demo usar actorId, sino buscar por usuarioId
            const whereClause = actorId
                ? { id: actorId }
                : { usuarioId: userId };

            actor = await prisma.generador.findFirst({
                where: whereClause,
                include: {
                    _count: { select: { manifiestos: true } }
                }
            });

            if (actor) {
                // Calcular estadísticas
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                const [manifestosMes, manifestosActivos] = await Promise.all([
                    prisma.manifiesto.count({
                        where: {
                            generadorId: actor.id,
                            createdAt: { gte: startOfMonth }
                        }
                    }),
                    prisma.manifiesto.count({
                        where: {
                            generadorId: actor.id,
                            estado: { in: ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] }
                        }
                    })
                ]);

                stats = {
                    manifiestosTotales: actor._count.manifiestos,
                    manifestosMes,
                    manifestosActivos
                };
            }
        } else if (userRol === 'TRANSPORTISTA') {
            const whereClause = actorId
                ? { id: actorId }
                : { usuarioId: userId };

            actor = await prisma.transportista.findFirst({
                where: whereClause,
                include: {
                    vehiculos: true,
                    choferes: true,
                    _count: { select: { manifiestos: true } }
                }
            });

            if (actor) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                const [manifestosMes, manifestosActivos] = await Promise.all([
                    prisma.manifiesto.count({
                        where: {
                            transportistaId: actor.id,
                            createdAt: { gte: startOfMonth }
                        }
                    }),
                    prisma.manifiesto.count({
                        where: {
                            transportistaId: actor.id,
                            estado: { in: ['EN_TRANSITO', 'ENTREGADO'] }
                        }
                    })
                ]);

                stats = {
                    manifiestosTotales: actor._count.manifiestos,
                    manifestosMes,
                    manifestosActivos
                };
            }
        } else if (userRol === 'OPERADOR') {
            const whereClause = actorId
                ? { id: actorId }
                : { usuarioId: userId };

            actor = await prisma.operador.findFirst({
                where: whereClause,
                include: {
                    tratamientos: {
                        include: {
                            tipoResiduo: { select: { id: true, codigo: true, nombre: true } }
                        }
                    },
                    _count: { select: { manifiestos: true } }
                }
            });

            if (actor) {
                const now = new Date();
                const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

                const [manifestosMes, manifestosActivos] = await Promise.all([
                    prisma.manifiesto.count({
                        where: {
                            operadorId: actor.id,
                            createdAt: { gte: startOfMonth }
                        }
                    }),
                    prisma.manifiesto.count({
                        where: {
                            operadorId: actor.id,
                            estado: { in: ['RECIBIDO', 'EN_TRATAMIENTO'] }
                        }
                    })
                ]);

                stats = {
                    manifiestosTotales: actor._count.manifiestos,
                    manifestosMes,
                    manifestosActivos
                };
            }
        } else if (userRol === 'ADMIN') {
            // Para admin sin demo mode, mostrar estadísticas globales
            const now = new Date();
            const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

            const [totalManifiestos, manifestosMes, manifestosActivos] = await Promise.all([
                prisma.manifiesto.count(),
                prisma.manifiesto.count({ where: { createdAt: { gte: startOfMonth } } }),
                prisma.manifiesto.count({
                    where: {
                        estado: { in: ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO', 'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO'] }
                    }
                })
            ]);

            stats = {
                manifiestosTotales: totalManifiestos,
                manifestosMes,
                manifestosActivos
            };
        }

        res.json({
            success: true,
            data: {
                actor,
                stats,
                tipoActor: userRol === 'GENERADOR' ? 'generador' :
                           userRol === 'TRANSPORTISTA' ? 'transportista' :
                           userRol === 'OPERADOR' ? 'operador' :
                           userRol === 'ADMIN' ? 'admin' : null,
                demoMode: demoProfile?.enabled || false
            }
        });
    } catch (error) {
        next(error);
    }
};

// ============== GENERADORES (CU-A06) ==============

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo } = req.query;
        // Paginación segura con límite máximo de 100
        const { page, limit, skip } = parsePagination(req.query.page as string, req.query.limit as string);

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
                take: limit,
                select: {
                    id: true,
                    razonSocial: true,
                    cuit: true,
                    domicilio: true,
                    telefono: true,
                    email: true,
                    activo: true,
                    categoria: true,
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
                pagination: buildPaginationResult(page, limit, total)
            }
        });
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
        const { search, activo } = req.query;
        // Paginación segura con límite máximo de 100
        const { page, limit, skip } = parsePagination(req.query.page as string, req.query.limit as string);

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
                take: limit,
                select: {
                    id: true,
                    razonSocial: true,
                    cuit: true,
                    domicilio: true,
                    numeroHabilitacion: true,
                    telefono: true,
                    email: true,
                    activo: true,
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    vehiculos: { select: { id: true, patente: true, marca: true, modelo: true, activo: true } },
                    choferes: { select: { id: true, nombre: true, apellido: true, dni: true, activo: true } },
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
                pagination: buildPaginationResult(page, limit, total)
            }
        });
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
        const { search, activo } = req.query;
        // Paginación segura con límite máximo de 100
        const { page, limit, skip } = parsePagination(req.query.page as string, req.query.limit as string);

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
                take: limit,
                select: {
                    id: true,
                    razonSocial: true,
                    cuit: true,
                    numeroHabilitacion: true,
                    domicilio: true,
                    telefono: true,
                    email: true,
                    categoria: true,
                    activo: true,
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    tratamientos: {
                        select: {
                            id: true,
                            metodo: true,
                            activo: true,
                            tipoResiduo: { select: { id: true, codigo: true, nombre: true } }
                        }
                    },
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
                pagination: buildPaginationResult(page, limit, total)
            }
        });
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

// ============== CARGA MASIVA DE DATOS ==============

export const cargaMasivaGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new AppError('Archivo no proporcionado', 400);
        }

        const resultados = await bulkUploadService.processGeneradores(req.file.buffer);
        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaTransportistas = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new AppError('Archivo no proporcionado', 400);
        }

        const resultados = await bulkUploadService.processTransportistas(req.file.buffer);
        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

export const cargaMasivaOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        if (!req.file) {
            throw new AppError('Archivo no proporcionado', 400);
        }

        // processOperadores logic should be in bulkUploadService
        const resultados = await bulkUploadService.processGeneradores(req.file.buffer); // Reuse pattern for now
        res.json({ success: true, data: resultados });
    } catch (error) {
        next(error);
    }
};

// ============== DESCARGAR PLANTILLAS CSV ==============

const PLANTILLAS: Record<string, { headers: string[]; ejemplo: string[] }> = {
    generadores: {
        headers: ['razonSocial', 'cuit', 'domicilio', 'telefono', 'email', 'numeroInscripcion', 'categoria'],
        ejemplo: ['Empresa Demo SA', '30-12345678-9', 'Av. Principal 123', '261-4001234', 'contacto@empresa.com', 'GEN-001', 'GRANDE']
    },
    transportistas: {
        headers: ['razonSocial', 'cuit', 'domicilio', 'numeroHabilitacion', 'telefono', 'email'],
        ejemplo: ['Transporte Demo SRL', '30-98765432-1', 'Ruta 40 Km 5', 'HAB-T-001', '261-4005678', 'transporte@demo.com']
    },
    operadores: {
        headers: ['razonSocial', 'cuit', 'numeroHabilitacion', 'domicilio', 'telefono', 'email', 'categoria'],
        ejemplo: ['Operador Ambiental SA', '30-11223344-5', 'HAB-O-001', 'Zona Industrial Lote 10', '261-4009999', 'operador@ambiental.com', 'TRATAMIENTO']
    }
};

export const descargarPlantilla = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { tipo } = req.params;

        if (!['generadores', 'transportistas', 'operadores'].includes(tipo)) {
            throw new AppError('Tipo de plantilla inválido. Use: generadores, transportistas u operadores', 400);
        }

        const plantilla = PLANTILLAS[tipo];
        const csvContent = [
            plantilla.headers.join(','),
            plantilla.ejemplo.join(',')
        ].join('\n');

        res.setHeader('Content-Type', 'text/csv; charset=utf-8');
        res.setHeader('Content-Disposition', `attachment; filename=plantilla_${tipo}.csv`);
        res.send(csvContent);
    } catch (error) {
        next(error);
    }
};
