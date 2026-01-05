import { Request, Response, NextFunction } from 'express';
import { EventoAlerta, EstadoAlerta } from '@prisma/client';
import prisma from '../lib/prisma';

export const getReglasAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reglas = await prisma.reglaAlerta.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                creadoPor: { select: { nombre: true, apellido: true } },
                _count: { select: { alertasGeneradas: true } }
            }
        });
        res.json({ success: true, data: reglas });
    } catch (error) {
        next(error);
    }
};

export const crearReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const usuarioId = (req as any).user.id;
        const { nombre, descripcion, evento, condicion, destinatarios } = req.body;

        const regla = await prisma.reglaAlerta.create({
            data: {
                nombre,
                descripcion,
                evento: evento as EventoAlerta,
                condicion: JSON.stringify(condicion),
                destinatarios: JSON.stringify(destinatarios),
                creadoPorId: usuarioId
            }
        });

        res.status(201).json({ success: true, data: regla });
    } catch (error) {
        next(error);
    }
};

export const getAlertasGeneradas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { estado, limit = 50, offset = 0 } = req.query;
        const where: any = {};
        if (estado) where.estado = estado;

        const [alertas, total] = await Promise.all([
            prisma.alertaGenerada.findMany({
                where,
                orderBy: { createdAt: 'desc' },
                take: parseInt(limit as string),
                skip: parseInt(offset as string),
                include: {
                    regla: { select: { nombre: true, evento: true } },
                    manifiesto: { select: { numero: true, estado: true } }
                }
            }),
            prisma.alertaGenerada.count({ where })
        ]);

        res.json({
            success: true,
            data: {
                alertas,
                total,
                pagina: Math.floor(parseInt(offset as string) / parseInt(limit as string)) + 1,
                totalPaginas: Math.ceil(total / parseInt(limit as string))
            }
        });
    } catch (error) {
        next(error);
    }
};

export const resolverAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { estado, notas } = req.body;
        const usuarioId = (req as any).user.id;

        const alerta = await prisma.alertaGenerada.update({
            where: { id },
            data: {
                estado: estado as EstadoAlerta,
                notas,
                resueltaPor: usuarioId,
                fechaResolucion: new Date()
            }
        });

        res.json({ success: true, data: alerta });
    } catch (error) {
        next(error);
    }
};
