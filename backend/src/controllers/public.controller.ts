import { Request, Response, NextFunction } from 'express';
import prisma from '../lib/prisma';

export const verificarManifiestoPublico = async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: {
        id: true,
        numero: true,
        estado: true,
        createdAt: true,
        fechaFirma: true,
        fechaRetiro: true,
        fechaEntrega: true,
        fechaRecepcion: true,
        fechaCierre: true,
        firmaDigital: true,
        generador: { select: { razonSocial: true, cuit: true } },
        transportista: { select: { razonSocial: true, cuit: true } },
        operador: { select: { razonSocial: true, cuit: true } },
        residuos: {
          select: {
            cantidad: true,
            unidad: true,
            tipoResiduo: { select: { nombre: true, codigo: true } }
          }
        },
        eventos: {
          select: { tipo: true, descripcion: true, createdAt: true },
          orderBy: { createdAt: 'desc' },
          take: 10
        }
      }
    });

    if (!manifiesto) {
      return res.status(404).json({ success: false, error: 'Manifiesto no encontrado' });
    }

    // Determinar estado de firma digital
    let firmaDigitalStatus = 'SIN FIRMAR';
    if (manifiesto.firmaDigital) {
      firmaDigitalStatus = 'FIRMADO DIGITALMENTE';
    } else if (manifiesto.fechaFirma) {
      firmaDigitalStatus = 'FIRMADO';
    }

    res.json({
      success: true,
      verificacion: {
        manifiestoId: manifiesto.id,
        numero: manifiesto.numero,
        estado: manifiesto.estado,
        cadenaResponsabilidad: {
          generador: manifiesto.generador?.razonSocial || 'No asignado',
          transportista: manifiesto.transportista?.razonSocial || 'No asignado',
          operador: manifiesto.operador?.razonSocial || 'No asignado'
        },
        timeline: {
          creacion: manifiesto.createdAt?.toISOString() || null,
          firma: manifiesto.fechaFirma?.toISOString() || null,
          retiro: manifiesto.fechaRetiro?.toISOString() || null,
          entrega: manifiesto.fechaEntrega?.toISOString() || null,
          recepcion: manifiesto.fechaRecepcion?.toISOString() || null,
          cierre: manifiesto.fechaCierre?.toISOString() || null
        },
        firmaDigital: firmaDigitalStatus,
        residuos: manifiesto.residuos.map(r => ({
          tipo: r.tipoResiduo?.nombre || 'Desconocido',
          codigo: r.tipoResiduo?.codigo || '-',
          cantidad: r.cantidad,
          unidad: r.unidad
        })),
        eventos: manifiesto.eventos,
        verificadoEn: new Date().toISOString()
      }
    });
  } catch (error) {
    next(error);
  }
};
