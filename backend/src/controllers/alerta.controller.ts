import { Request, Response, NextFunction } from 'express';
import { EventoAlerta, EstadoAlerta } from '@prisma/client';
import prisma from '../lib/prisma';
import { alertaService } from '../services/alerta.service';

export const getReglasAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const reglas = await prisma.reglaAlerta.findMany({
            orderBy: { createdAt: 'desc' },
            include: {
                creadoPor: { select: { nombre: true, apellido: true } },
                _count: { select: { alertasGeneradas: true } }
            }
        });

        // Parsear y validar campos JSON (pueden estar double-stringified)
        const reglasFormateadas = reglas.map(regla => {
            let condicion = '{}';
            let destinatarios = '[]';

            // Parsear condición
            try {
                let parsed = JSON.parse(regla.condicion || '{}');
                // Si es string, parsear nuevamente
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                condicion = JSON.stringify(parsed);
            } catch {
                condicion = '{}';
            }

            // Parsear destinatarios
            try {
                let parsed = JSON.parse(regla.destinatarios || '[]');
                // Si es string, parsear nuevamente
                if (typeof parsed === 'string') {
                    parsed = JSON.parse(parsed);
                }
                // Asegurar que sea array
                if (!Array.isArray(parsed)) {
                    parsed = [];
                }
                destinatarios = JSON.stringify(parsed);
            } catch {
                destinatarios = '[]';
            }

            return {
                ...regla,
                condicion,
                destinatarios
            };
        });

        res.json({ success: true, data: reglasFormateadas });
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

export const actualizarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;
        const { nombre, descripcion, evento, condicion, destinatarios, activa } = req.body;

        const updateData: any = {};
        if (nombre !== undefined) updateData.nombre = nombre;
        if (descripcion !== undefined) updateData.descripcion = descripcion;
        if (evento !== undefined) updateData.evento = evento as EventoAlerta;
        if (condicion !== undefined) updateData.condicion = JSON.stringify(condicion);
        if (destinatarios !== undefined) updateData.destinatarios = JSON.stringify(destinatarios);
        if (activa !== undefined) updateData.activa = activa;

        const regla = await prisma.reglaAlerta.update({
            where: { id },
            data: updateData,
            include: {
                creadoPor: { select: { nombre: true, apellido: true } },
                _count: { select: { alertasGeneradas: true } }
            }
        });

        // Parsear campos JSON (pueden estar double-stringified)
        let condicionParsed = '{}';
        let destinatariosParsed = '[]';
        try {
            let parsed = JSON.parse(regla.condicion || '{}');
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            condicionParsed = JSON.stringify(parsed);
        } catch {
            condicionParsed = '{}';
        }
        try {
            let parsed = JSON.parse(regla.destinatarios || '[]');
            if (typeof parsed === 'string') parsed = JSON.parse(parsed);
            if (!Array.isArray(parsed)) parsed = [];
            destinatariosParsed = JSON.stringify(parsed);
        } catch {
            destinatariosParsed = '[]';
        }

        res.json({ success: true, data: { ...regla, condicion: condicionParsed, destinatarios: destinatariosParsed } });
    } catch (error) {
        next(error);
    }
};

export const eliminarReglaAlerta = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { id } = req.params;

        // Eliminar alertas generadas asociadas primero
        await prisma.alertaGenerada.deleteMany({ where: { reglaId: id } });

        // Eliminar la regla
        await prisma.reglaAlerta.delete({ where: { id } });

        res.json({ success: true, message: 'Regla de alerta eliminada' });
    } catch (error) {
        next(error);
    }
};

/**
 * Evalúa un manifiesto contra todas las reglas de alerta activas
 * GET /api/alertas/evaluar/:manifiestoId
 */
export const evaluarManifiesto = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId } = req.params;
        const resultados = await alertaService.evaluarManifiesto(manifiestoId);

        res.json({
            success: true,
            data: {
                manifiestoId,
                advertencias: resultados,
                hayAlertas: resultados.length > 0,
                alertasCriticas: resultados.filter(r => r.severidad === 'CRITICAL').length,
                alertasWarning: resultados.filter(r => r.severidad === 'WARNING').length
            }
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Obtiene advertencias activas para mostrar en UI
 * GET /api/alertas/advertencias
 */
export const getAdvertenciasActivas = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId, evento, severidad } = req.query;

        const advertencias = await alertaService.obtenerAdvertenciasActivas({
            manifiestoId: manifiestoId as string,
            evento: evento as EventoAlerta,
            severidad: severidad as string
        });

        res.json({
            success: true,
            data: advertencias,
            total: advertencias.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Evalúa tiempos excesivos en manifiestos activos
 * GET /api/alertas/evaluar-tiempos
 */
export const evaluarTiemposExcesivos = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resultados = await alertaService.evaluarTiempoExcesivo();

        res.json({
            success: true,
            data: resultados,
            total: resultados.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Evalúa vencimientos próximos
 * GET /api/alertas/evaluar-vencimientos
 */
export const evaluarVencimientos = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const resultados = await alertaService.evaluarVencimientos();

        res.json({
            success: true,
            data: resultados,
            total: resultados.length
        });
    } catch (error) {
        next(error);
    }
};

/**
 * Notifica cambio de estado y genera alertas correspondientes
 * POST /api/alertas/notificar-cambio-estado
 */
export const notificarCambioEstado = async (req: Request, res: Response, next: NextFunction) => {
    try {
        const { manifiestoId, estadoAnterior, estadoNuevo } = req.body;
        const usuarioId = (req as any).user.id;

        const resultados = await alertaService.evaluarCambioEstado(
            manifiestoId,
            estadoAnterior,
            estadoNuevo,
            usuarioId
        );

        res.json({
            success: true,
            data: resultados,
            alertasGeneradas: resultados.length
        });
    } catch (error) {
        next(error);
    }
};
