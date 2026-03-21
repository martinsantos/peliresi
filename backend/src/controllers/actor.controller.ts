import { Response, NextFunction } from 'express';
import prisma from '../lib/prisma';
import bcrypt from 'bcryptjs';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';

// ============== GENERADORES (CU-A06) ==============

export const getGeneradores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page = 1, limit = 10, sortBy, sortOrder } = req.query;
        const limitNum = Math.min(500, Math.max(1, Number(limit)));
        const skip = (Number(page) - 1) * limitNum;
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const GEN_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            categoria: { categoria: order },
            activo: { activo: order },
        };
        const orderBy = GEN_SORT[sortBy as string] ?? { razonSocial: 'asc' };

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
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    _count: { select: { manifiestos: true } }
                },
                orderBy
            }),
            prisma.generador.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                generadores,
                pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
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
        const { razonSocial, cuit, domicilio, telefono, email, password, nombre, numeroInscripcion, categoria, actividad, rubro, corrientesControl } = req.body;

        if (!razonSocial || !cuit || !email) {
            throw new AppError('Razón social, CUIT y email son obligatorios', 400);
        }

        // Verificar CUIT único en generadores
        const existente = await prisma.generador.findFirst({ where: { cuit } });
        if (existente) {
            throw new AppError('Ya existe un generador con ese CUIT', 400);
        }

        // Verificar email único en usuarios
        const existeEmail = await prisma.usuario.findUnique({ where: { email } });
        if (existeEmail) {
            throw new AppError('Ya existe un usuario con ese email', 400);
        }

        // Password: usar el proporcionado por el admin, o CUIT como fallback
        const rawPassword = password || cuit;
        const passwordHash = await bcrypt.hash(rawPassword, 10);

        // Crear usuario asociado (admin-created → emailVerified + activo)
        const usuario = await prisma.usuario.create({
            data: {
                email,
                password: passwordHash,
                nombre: nombre || razonSocial,
                cuit,
                rol: 'GENERADOR',
                activo: true,
                emailVerified: true,
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
                categoria,
                actividad,
                rubro,
                corrientesControl
            },
            include: {
                usuario: { select: { email: true, nombre: true } }
            }
        });

        res.status(201).json({
            success: true,
            data: { generador },
            message: `Generador creado. ${password ? 'Password: el definido en el formulario' : 'Password inicial: ' + cuit}`
        });
    } catch (error) {
        next(error);
    }
};

export const updateGenerador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { razonSocial, domicilio, telefono, email, numeroInscripcion, categoria, activo, actividad, rubro, corrientesControl } = req.body;

        const generador = await prisma.generador.update({
            where: { id },
            data: {
                razonSocial,
                domicilio,
                telefono,
                email,
                numeroInscripcion,
                categoria,
                activo,
                actividad,
                rubro,
                corrientesControl
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
        const { search, activo, page = 1, limit = 10, sortBy, sortOrder } = req.query;
        const limitNum = Math.min(500, Math.max(1, Number(limit)));
        const skip = (Number(page) - 1) * limitNum;
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const TRANS_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            localidad: { localidad: order },
            activo: { activo: order },
            vehiculosCount: { vehiculos: { _count: order } },
            choferesCount: { choferes: { _count: order } },
        };
        const orderBy = TRANS_SORT[sortBy as string] ?? { razonSocial: 'asc' };

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
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    vehiculos: true,
                    choferes: true,
                    _count: { select: { manifiestos: true } }
                },
                orderBy
            }),
            prisma.transportista.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                transportistas,
                pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
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
        const {
            razonSocial, cuit, domicilio, numeroHabilitacion, telefono, email, vehiculos, choferes,
            // Campos regulatorios DPA
            localidad, vencimientoHabilitacion, corrientesAutorizadas,
            expedienteDPA, resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2,
        } = req.body;

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
                ...(localidad !== undefined && { localidad }),
                ...(vencimientoHabilitacion !== undefined && { vencimientoHabilitacion: new Date(vencimientoHabilitacion) }),
                ...(corrientesAutorizadas !== undefined && { corrientesAutorizadas }),
                ...(expedienteDPA !== undefined && { expedienteDPA }),
                ...(resolucionDPA !== undefined && { resolucionDPA }),
                ...(resolucionSSP !== undefined && { resolucionSSP }),
                ...(actaInspeccion !== undefined && { actaInspeccion }),
                ...(actaInspeccion2 !== undefined && { actaInspeccion2 }),
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
        const {
            razonSocial, domicilio, numeroHabilitacion, telefono, email, activo,
            // Campos regulatorios DPA
            localidad, vencimientoHabilitacion, corrientesAutorizadas,
            expedienteDPA, resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2,
        } = req.body;

        const transportista = await prisma.transportista.update({
            where: { id },
            data: {
                razonSocial, domicilio, numeroHabilitacion, telefono, email, activo,
                ...(localidad !== undefined && { localidad }),
                ...(vencimientoHabilitacion !== undefined && {
                    vencimientoHabilitacion: vencimientoHabilitacion ? new Date(vencimientoHabilitacion) : null,
                }),
                ...(corrientesAutorizadas !== undefined && { corrientesAutorizadas }),
                ...(expedienteDPA !== undefined && { expedienteDPA }),
                ...(resolucionDPA !== undefined && { resolucionDPA }),
                ...(resolucionSSP !== undefined && { resolucionSSP }),
                ...(actaInspeccion !== undefined && { actaInspeccion }),
                ...(actaInspeccion2 !== undefined && { actaInspeccion2 }),
            }
        });

        res.json({ success: true, data: { transportista } });
    } catch (error) {
        next(error);
    }
};

export const deleteTransportista = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        const manifiestos = await prisma.manifiesto.count({ where: { transportistaId: id } });
        if (manifiestos > 0) {
            throw new AppError('No se puede eliminar un transportista con manifiestos asociados', 400);
        }

        const transportista = await prisma.transportista.findUnique({ where: { id } });
        if (!transportista) {
            throw new AppError('Transportista no encontrado', 404);
        }

        // Eliminar vehículos y choferes asociados, luego transportista, luego usuario
        await prisma.vehiculo.deleteMany({ where: { transportistaId: id } });
        await prisma.chofer.deleteMany({ where: { transportistaId: id } });
        await prisma.transportista.delete({ where: { id } });
        await prisma.usuario.delete({ where: { id: transportista.usuarioId } });

        res.json({ success: true, message: 'Transportista eliminado' });
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

// Actualizar vehículo
export const updateVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, vehiculoId } = req.params;
        const { patente, marca, modelo, anio, capacidad, numeroHabilitacion, vencimiento, activo } = req.body;

        const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
        if (!vehiculo) {
            throw new AppError('Vehículo no encontrado', 404);
        }
        if (vehiculo.transportistaId !== id) {
            throw new AppError('El vehículo no pertenece a este transportista', 403);
        }

        const updated = await prisma.vehiculo.update({
            where: { id: vehiculoId },
            data: {
                ...(patente !== undefined && { patente }),
                ...(marca !== undefined && { marca }),
                ...(modelo !== undefined && { modelo }),
                ...(anio !== undefined && { anio }),
                ...(capacidad !== undefined && { capacidad }),
                ...(numeroHabilitacion !== undefined && { numeroHabilitacion }),
                ...(vencimiento !== undefined && { vencimiento: new Date(vencimiento) }),
                ...(activo !== undefined && { activo }),
            }
        });

        res.json({ success: true, data: { vehiculo: updated } });
    } catch (error) {
        next(error);
    }
};

// Eliminar vehículo
export const deleteVehiculo = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, vehiculoId } = req.params;

        const vehiculo = await prisma.vehiculo.findUnique({ where: { id: vehiculoId } });
        if (!vehiculo) {
            throw new AppError('Vehículo no encontrado', 404);
        }
        if (vehiculo.transportistaId !== id) {
            throw new AppError('El vehículo no pertenece a este transportista', 403);
        }

        await prisma.vehiculo.delete({ where: { id: vehiculoId } });

        res.json({ success: true, message: 'Vehículo eliminado' });
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

// Actualizar chofer
export const updateChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, choferId } = req.params;
        const { nombre, apellido, dni, licencia, vencimiento, telefono, activo } = req.body;

        const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
        if (!chofer) {
            throw new AppError('Chofer no encontrado', 404);
        }
        if (chofer.transportistaId !== id) {
            throw new AppError('El chofer no pertenece a este transportista', 403);
        }

        const updated = await prisma.chofer.update({
            where: { id: choferId },
            data: {
                ...(nombre !== undefined && { nombre }),
                ...(apellido !== undefined && { apellido }),
                ...(dni !== undefined && { dni }),
                ...(licencia !== undefined && { licencia }),
                ...(vencimiento !== undefined && { vencimiento: new Date(vencimiento) }),
                ...(telefono !== undefined && { telefono }),
                ...(activo !== undefined && { activo }),
            }
        });

        res.json({ success: true, data: { chofer: updated } });
    } catch (error) {
        next(error);
    }
};

// Eliminar chofer
export const deleteChofer = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { id, choferId } = req.params;

        const chofer = await prisma.chofer.findUnique({ where: { id: choferId } });
        if (!chofer) {
            throw new AppError('Chofer no encontrado', 404);
        }
        if (chofer.transportistaId !== id) {
            throw new AppError('El chofer no pertenece a este transportista', 403);
        }

        await prisma.chofer.delete({ where: { id: choferId } });

        res.json({ success: true, message: 'Chofer eliminado' });
    } catch (error) {
        next(error);
    }
};

// ============== OPERADORES (CU-A08) ==============

export const getOperadores = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { search, activo, page = 1, limit = 10, sortBy, sortOrder } = req.query;
        const limitNum = Math.min(500, Math.max(1, Number(limit)));
        const skip = (Number(page) - 1) * limitNum;
        const order: 'asc' | 'desc' = sortOrder === 'desc' ? 'desc' : 'asc';
        const OPER_SORT: Record<string, any> = {
            razonSocial: { razonSocial: order },
            categoria: { categoria: order },
            activo: { activo: order },
        };
        const orderBy = OPER_SORT[sortBy as string] ?? { razonSocial: 'asc' };

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
                take: limitNum,
                include: {
                    usuario: { select: { email: true, nombre: true, apellido: true } },
                    tratamientos: { include: { tipoResiduo: true } },
                    _count: { select: { manifiestos: true } }
                },
                orderBy
            }),
            prisma.operador.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                operadores,
                pagination: { page: Number(page), limit: limitNum, total, pages: Math.ceil(total / limitNum) }
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
                tratamientos: {
                    include: { tipoResiduo: true }
                }
            }
        });

        if (!operador) {
            throw new AppError('Operador no encontrado', 404);
        }

        // Estadísticas y datos enriquecidos
        const [manifiestoStats, ultimosManifiestos, historialTratados] = await Promise.all([
            // Contar manifiestos por estado
            prisma.manifiesto.groupBy({
                by: ['estado'],
                where: { operadorId: id },
                _count: true
            }),
            // Últimos 10 manifiestos
            prisma.manifiesto.findMany({
                where: { operadorId: id },
                orderBy: { createdAt: 'desc' },
                take: 10,
                include: {
                    generador: { select: { razonSocial: true } },
                    residuos: { select: { cantidad: true, cantidadRecibida: true, unidad: true } }
                }
            }),
            // Historial de tratamientos (manifiestos TRATADO/EN_TRATAMIENTO/RECIBIDO)
            prisma.manifiesto.findMany({
                where: {
                    operadorId: id,
                    estado: { in: ['TRATADO', 'EN_TRATAMIENTO', 'RECIBIDO'] }
                },
                orderBy: { updatedAt: 'desc' },
                take: 50,
                include: {
                    residuos: { select: { cantidad: true, cantidadRecibida: true, unidad: true } }
                }
            })
        ]);

        // Procesar métodos autorizados (únicos)
        const metodosAutorizados = [...new Set(operador.tratamientos.map(t => t.metodo))];

        // Procesar residuos aceptados (códigos únicos)
        const residuosAceptados = [...new Set(operador.tratamientos.map(t => t.tipoResiduo.codigo))];

        // Estadísticas de manifiestos
        const manifiestos = {
            recibidos: manifiestoStats.find(s => s.estado === 'RECIBIDO')?._count || 0,
            enTratamiento: manifiestoStats.find(s => s.estado === 'EN_TRATAMIENTO')?._count || 0,
            cerrados: manifiestoStats.find(s => s.estado === 'TRATADO')?._count || 0,
            rechazados: manifiestoStats.find(s => s.estado === 'RECHAZADO')?._count || 0,
        };

        // Mapear últimos manifiestos para UI
        const ultimosManifiestosUI = ultimosManifiestos.map(m => ({
            id: m.id,
            numero: m.numero,
            fecha: m.createdAt,
            estado: m.estado,
            peso: m.residuos.reduce((sum, r) => sum + (r.cantidad || 0), 0),
            generador: m.generador?.razonSocial || '-'
        }));

        // Mapear historial de tratamientos (manifiestos procesados)
        const tratamientos = historialTratados.map(m => ({
            id: m.id,
            fecha: m.fechaCierre || m.fechaRecepcion || m.updatedAt,
            manifiesto: m.numero,
            metodo: metodosAutorizados[0] || 'Tratamiento estándar',
            peso: m.residuos.reduce((sum, r) => sum + (r.cantidadRecibida || r.cantidad || 0), 0),
            certificado: operador.numeroHabilitacion || '-'
        }));

        // Mapear tratamientos autorizados para UI
        const tratamientosAutorizados = operador.tratamientos.map(t => ({
            id: t.id,
            tipoResiduo: t.tipoResiduo.codigo,
            tipoResiduoNombre: t.tipoResiduo.nombre,
            metodo: t.metodo,
            capacidad: t.capacidad,
            activo: t.activo
        }));

        res.json({
            success: true,
            data: {
                operador: {
                    ...operador,
                    metodosAutorizados,
                    residuosAceptados,
                    manifiestos,
                    ultimosManifiestos: ultimosManifiestosUI,
                    tratamientos,
                    tratamientosAutorizados
                }
            }
        });
    } catch (error) {
        next(error);
    }
};

export const createOperador = async (req: AuthRequest, res: Response, next: NextFunction) => {
    try {
        const { razonSocial, cuit, numeroHabilitacion, domicilio, telefono, email, categoria, tipoOperador, tecnologia, corrientesY } = req.body;

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
                categoria,
                tipoOperador,
                tecnologia,
                corrientesY
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
        const { razonSocial, numeroHabilitacion, domicilio, telefono, email, categoria, activo, tipoOperador, tecnologia, corrientesY } = req.body;

        const operador = await prisma.operador.update({
            where: { id },
            data: {
                razonSocial,
                numeroHabilitacion,
                domicilio,
                telefono,
                email,
                categoria,
                activo,
                tipoOperador,
                tecnologia,
                corrientesY
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
