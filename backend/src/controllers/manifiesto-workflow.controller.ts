import { Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { domainEvents } from '../services/domainEvent.service';
import { computeRollingHash, computeClosureHash, hashManifiesto, registrarSello } from '../services/blockchain.service';
import { invalidateGpsCache } from './manifiesto-gps.controller';

// Zod schemas
const registrarIncidenteSchema = z.object({
  tipoIncidente: z.string().optional(),
  tipo: z.string().optional(),
  descripcion: z.string().min(1, 'La descripcion es requerida').max(1000),
  latitud: z.number().optional(),
  longitud: z.number().optional(),
});

const cerrarManifiestoSchema = z.object({
  metodoTratamiento: z.string().optional(),
  observaciones: z.string().max(1000).optional(),
});

/**
 * Compute rolling hash and save it on the manifiesto + evento inside a $transaction.
 * `tx` is the Prisma transaction client.
 */
async function updateRollingHash(
  tx: Parameters<Parameters<typeof prisma.$transaction>[0]>[0],
  manifiestoId: string,
  estado: string,
  fecha: Date,
  observaciones: string | null,
  eventoId: string,
) {
  // Fetch current rolling hash + genesis blockchain timestamp
  const current = await tx.manifiesto.findUnique({
    where: { id: manifiestoId },
    select: { rollingHash: true, blockchainTimestamp: true },
  });
  const eventCount = await tx.eventoManifiesto.count({ where: { manifiestoId } });

  const newRollingHash = computeRollingHash({
    previousHash: current?.rollingHash ?? null,
    genesisBlockchainTimestamp: current?.blockchainTimestamp?.toISOString() ?? null,
    estado,
    fecha: fecha.toISOString(),
    eventCount,
    observaciones,
  });

  await tx.manifiesto.update({
    where: { id: manifiestoId },
    data: { rollingHash: newRollingHash },
  });

  await tx.eventoManifiesto.update({
    where: { id: eventoId },
    data: { integrityHash: newRollingHash },
  });

  return newRollingHash;
}

// Firmar manifiesto
export const firmarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const userId = req.user.id;

    // Generate QR before transaction (async, no DB write)
    // We need manifiesto.numero first — fetch outside tx to avoid holding tx open during QR generation
    const manifiestoPreview = await prisma.manifiesto.findUnique({
      where: { id },
      select: { id: true, numero: true, estado: true },
    });

    if (!manifiestoPreview) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiestoPreview.estado !== 'BORRADOR') {
      throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);
    }

    const qrData = JSON.stringify({
      numero: manifiestoPreview.numero,
      id: manifiestoPreview.id,
      timestamp: new Date().toISOString()
    });
    const qrCode = await QRCode.toDataURL(qrData);

    // Atomic conditional update: WHERE { id, estado: 'BORRADOR' } ensures only one
    // concurrent request can transition the state. If the manifest was already signed
    // by a concurrent request, Prisma throws P2025 (record not found matching WHERE).
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'BORRADOR' },
          data: {
            estado: 'APROBADO',
            fechaFirma: new Date(),
            qrCode
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('Solo se pueden firmar manifiestos en estado borrador', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'FIRMA',
          descripcion: 'Manifiesto firmado digitalmente por el generador',
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'APROBADO', updated.fechaFirma!, updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'APROBADO',
      numero: manifiestoActualizado.numero,
      userId,
    });

    // Sello GENESIS — fire-and-forget
    setImmediate(() => {
      const hash = hashManifiesto(manifiestoActualizado);
      registrarSello(id, 'GENESIS', hash).catch(() => {});
    });

  } catch (error) {
    next(error);
  }
};

// Confirmar retiro (transportista)
export const confirmarRetiro = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar retiros', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'APROBADO' },
          data: {
            estado: 'EN_TRANSITO',
            fechaRetiro: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar aprobado para confirmar retiro', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RETIRO',
          descripcion: observaciones || 'Carga retirada del generador',
          latitud,
          longitud,
          usuarioId: userId
        }
      });

      if (latitud && longitud) {
        await tx.trackingGPS.create({
          data: {
            manifiestoId: id,
            latitud,
            longitud
          }
        });
      }

      await updateRollingHash(tx, id, 'EN_TRANSITO', updated.fechaRetiro!, updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'APROBADO',
      estadoNuevo: 'EN_TRANSITO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Confirmar entrega (transportista)
export const confirmarEntrega = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar entregas', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'EN_TRANSITO' },
          data: {
            estado: 'ENTREGADO',
            fechaEntrega: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar en transito', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'ENTREGA',
          descripcion: observaciones || 'Carga entregada en planta de tratamiento',
          latitud,
          longitud,
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'ENTREGADO', updated.fechaEntrega!, updated.observaciones, evento.id);

      return updated;
    });

    // Invalidate GPS cache — trip is no longer EN_TRANSITO
    invalidateGpsCache(id);

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'EN_TRANSITO',
      estadoNuevo: 'ENTREGADO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Confirmar recepcion (operador)
export const confirmarRecepcion = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { observaciones, pesoReal } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden confirmar recepciones', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'ENTREGADO' },
          data: {
            estado: 'RECIBIDO',
            fechaRecepcion: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar en estado entregado', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RECEPCION',
          descripcion: `Carga recibida. ${pesoReal ? `Peso registrado: ${pesoReal} kg` : ''} ${observaciones || ''}`,
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'RECIBIDO', updated.fechaRecepcion!, updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'ENTREGADO',
      estadoNuevo: 'RECIBIDO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento y cerrar manifiesto
export const cerrarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = cerrarManifiestoSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { metodoTratamiento, observaciones } = parsed.data;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden cerrar manifiestos', 403);
    }

    // Atomic conditional update: accepts RECIBIDO or EN_TRATAMIENTO as valid source states
    const { manifiesto: manifiestoActualizado, estadoAnterior } = await prisma.$transaction(async (tx) => {
      // First verify it exists and is in a valid state
      const current = await tx.manifiesto.findUnique({ where: { id }, select: { estado: true } });
      if (!current) throw new AppError('Manifiesto no encontrado', 404);
      if (current.estado !== 'RECIBIDO' && current.estado !== 'EN_TRATAMIENTO') {
        throw new AppError('El manifiesto debe estar recibido o en tratamiento', 400);
      }

      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: current.estado },
          data: {
            estado: 'TRATADO',
            fechaCierre: new Date()
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: {
              include: {
                tipoResiduo: true
              }
            }
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar recibido o en tratamiento', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'CIERRE',
          descripcion: `Manifiesto cerrado${metodoTratamiento ? `. Tratamiento: ${metodoTratamiento}` : ''}${observaciones ? `. ${observaciones}` : ''}`,
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'TRATADO', updated.fechaCierre!, updated.observaciones, evento.id);

      return { manifiesto: updated, estadoAnterior: current.estado };
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior,
      estadoNuevo: 'TRATADO',
      numero: manifiestoActualizado.numero,
      userId,
    });

    // Sello CIERRE — fire-and-forget
    setImmediate(async () => {
      try {
        const fresh = await prisma.manifiesto.findUnique({
          where: { id },
          include: {
            generador: { select: { cuit: true } },
            transportista: { select: { cuit: true } },
            operador: { select: { cuit: true } },
            residuos: { select: { tipoResiduoId: true, cantidad: true, unidad: true } },
            sellosBlockchain: { where: { tipo: 'GENESIS' } },
          },
        });
        if (!fresh || !fresh.rollingHash || !fresh.fechaCierre) return;
        const genesisSello = fresh.sellosBlockchain[0];
        if (!genesisSello) return;

        const eventCount = await prisma.eventoManifiesto.count({ where: { manifiestoId: id } });
        const closureHash = computeClosureHash({
          genesisHash: genesisSello.hash,
          rollingHash: fresh.rollingHash,
          numero: fresh.numero,
          generadorCuit: fresh.generador.cuit,
          transportistaCuit: fresh.transportista.cuit,
          operadorCuit: fresh.operador.cuit,
          residuos: fresh.residuos,
          fechaFirma: fresh.fechaFirma?.toISOString() ?? '',
          fechaRetiro: fresh.fechaRetiro?.toISOString() ?? null,
          fechaEntrega: fresh.fechaEntrega?.toISOString() ?? null,
          fechaRecepcion: fresh.fechaRecepcion?.toISOString() ?? null,
          fechaCierre: fresh.fechaCierre.toISOString(),
          eventCount,
        });
        await registrarSello(id, 'CIERRE', closureHash);
      } catch { /* fire-and-forget */ }
    });
  } catch (error) {
    next(error);
  }
};

// Rechazar carga (operador) - CU-O06
export const rechazarCarga = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { motivo, descripcion, cantidadRechazada } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden rechazar cargas', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'ENTREGADO' },
          data: {
            estado: 'RECHAZADO',
            observaciones: `RECHAZADO: ${motivo}. ${descripcion || ''}`
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('Solo se pueden rechazar cargas en estado entregado', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RECHAZO',
          descripcion: `Carga rechazada. Motivo: ${motivo}. ${cantidadRechazada ? `Cantidad rechazada: ${cantidadRechazada}` : ''} ${descripcion || ''}`,
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'RECHAZADO', new Date(), updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'RECHAZO_CARGA',
      manifiestoId: manifiestoActualizado.id,
      motivo,
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar incidente (transportista) - CU-T06
export const registrarIncidente = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const parsed = registrarIncidenteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { tipoIncidente, tipo, descripcion, latitud, longitud } = parsed.data;
    const tipoFinal = tipoIncidente || tipo; // Accept both field names
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden registrar incidentes', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    if (manifiesto.estado !== 'EN_TRANSITO') {
      throw new AppError('Solo se pueden registrar incidentes en transportes activos', 400);
    }

    // Registrar evento de incidente
    const evento = await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'INCIDENTE',
        descripcion: `INCIDENTE: ${tipoFinal}. ${descripcion}`,
        latitud,
        longitud,
        usuarioId: userId
      }
    });

    // Marcar manifiesto con incidente
    await prisma.manifiesto.update({
      where: { id },
      data: {
        observaciones: `${manifiesto.observaciones || ''} [INCIDENTE: ${tipoFinal}]`
      }
    });

    res.json({
      success: true,
      data: { evento }
    });

    domainEvents.emit({
      type: 'INCIDENTE_REGISTRADO',
      manifiestoId: id,
      tipoIncidente: tipoFinal ?? '',
      descripcion: descripcion ?? '',
      userId,
      latitud,
      longitud,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar tratamiento (operador) - CU-O08
export const registrarTratamiento = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { metodoTratamiento, metodo, fechaTratamiento, observaciones } = req.body;
    const metodoFinal = metodoTratamiento || metodo; // Accept both field names
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar tratamientos', 403);
    }

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'RECIBIDO' },
          data: {
            estado: 'EN_TRATAMIENTO'
          },
          include: {
            generador: true,
            transportista: true,
            operador: true
          }
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar recibido para registrar tratamiento', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'TRATAMIENTO',
          descripcion: `Tratamiento iniciado: ${metodoFinal}. Fecha: ${fechaTratamiento || new Date().toISOString()}. ${observaciones || ''}`,
          usuarioId: userId
        }
      });

      await updateRollingHash(tx, id, 'EN_TRATAMIENTO', new Date(), updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado }
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'RECIBIDO',
      estadoNuevo: 'EN_TRATAMIENTO',
      numero: manifiestoActualizado.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};

// Revertir estado (solo ADMIN)
export const revertirEstado = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { estadoNuevo, motivo } = req.body;

    const manifiesto = await prisma.manifiesto.findUnique({ where: { id } });
    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    const estadosValidos = ['BORRADOR', 'PENDIENTE_APROBACION', 'APROBADO', 'EN_TRANSITO',
                            'ENTREGADO', 'RECIBIDO', 'EN_TRATAMIENTO', 'TRATADO'];
    if (!estadosValidos.includes(estadoNuevo)) {
      throw new AppError('Estado destino no valido', 400);
    }

    // Valid state reversions (current state -> allowed target states)
    const VALID_REVERSIONS: Record<string, string[]> = {
      'APROBADO': ['BORRADOR'],
      'EN_TRANSITO': ['APROBADO'],
      'ENTREGADO': ['EN_TRANSITO'],
      'RECIBIDO': ['ENTREGADO'],
      'EN_TRATAMIENTO': ['RECIBIDO'],
      'TRATADO': ['EN_TRATAMIENTO', 'RECIBIDO'],
      'RECHAZADO': ['ENTREGADO'],
    };

    const currentEstado = manifiesto.estado;
    const validTargets = VALID_REVERSIONS[currentEstado];
    if (!validTargets || !validTargets.includes(estadoNuevo)) {
      throw new AppError(
        `No se puede revertir de ${currentEstado} a ${estadoNuevo}. Transiciones validas: ${validTargets?.join(', ') || 'ninguna'}`,
        400
      );
    }

    const estadoAnterior = manifiesto.estado;
    const updated = await prisma.manifiesto.update({
      where: { id },
      data: { estado: estadoNuevo },
    });

    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'REVERSION',
        descripcion: `Reversion: ${estadoAnterior} -> ${estadoNuevo}${motivo ? '. Motivo: ' + motivo : ''}`,
        usuarioId: req.user!.id,
      },
    });

    res.json({ success: true, data: { manifiesto: updated } });
  } catch (error) {
    next(error);
  }
};

// Registrar pesaje (operador) - CU-O04
export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    const { residuosPesados, residuos, observaciones } = req.body; // Accept both formats
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar pesajes', 403);
    }

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      include: {
        residuos: true
      }
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }

    // Accept pesaje in both ENTREGADO and RECIBIDO states
    if (manifiesto.estado !== 'ENTREGADO' && manifiesto.estado !== 'RECIBIDO') {
      throw new AppError('El manifiesto debe estar entregado o recibido para registrar pesaje', 400);
    }

    // Normalize input: accept both {residuosPesados: [{id, pesoReal}]} and {residuos: [{id, cantidadRecibida}]}
    const normalizedResiduos = residuosPesados || (residuos ? residuos.map((r: any) => ({ id: r.id, pesoReal: r.cantidadRecibida })) : null);
    if (!normalizedResiduos || !Array.isArray(normalizedResiduos)) {
      throw new AppError('Formato de residuos incorrecto', 400);
    }

    let pesoDeclaradoTotal = 0;
    let pesoRealTotal = 0;

    // Actualizar cada residuo en una transaccion
    await prisma.$transaction(
      normalizedResiduos.map((item: any) => {
        const residuoOriginal = manifiesto.residuos.find(r => r.id === item.id);
        if (!residuoOriginal) throw new AppError(`Residuo con ID ${item.id} no encontrado en el manifiesto`, 400);

        pesoDeclaradoTotal += residuoOriginal.cantidad;
        pesoRealTotal += Number(item.pesoReal);

        let tipoDiferencia: 'NINGUNA' | 'FALTANTE' | 'EXCEDENTE' = 'NINGUNA';
        if (Number(item.pesoReal) > residuoOriginal.cantidad) tipoDiferencia = 'EXCEDENTE';
        if (Number(item.pesoReal) < residuoOriginal.cantidad) tipoDiferencia = 'FALTANTE';

        return prisma.manifiestoResiduo.update({
          where: { id: item.id },
          data: {
            cantidadRecibida: Number(item.pesoReal),
            tipoDiferencia,
            estado: 'pesado'
          }
        });
      })
    );

    const diferencia = pesoRealTotal - pesoDeclaradoTotal;
    const porcentajeDif = pesoDeclaradoTotal > 0 ? ((diferencia / pesoDeclaradoTotal) * 100).toFixed(2) : '0';

    // Registrar evento de pesaje
    await prisma.eventoManifiesto.create({
      data: {
        manifiestoId: id,
        tipo: 'PESAJE',
        descripcion: `Pesaje realizado. Declarado Total: ${pesoDeclaradoTotal}, Real Total: ${pesoRealTotal}. Diferencia: ${porcentajeDif}%. ${observaciones || ''}`,
        usuarioId: userId
      }
    });

    // Generate anomalies if needed (Logic for CU-O05 could be here or separate)
    if (Math.abs(Number(porcentajeDif)) > 5) { // 5% tolerance
      await prisma.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'INCIDENTE',
          descripcion: `Diferencia de peso significativa detectada (${porcentajeDif}%)`,
          usuarioId: userId
        }
      });
      domainEvents.emit({
        type: 'DIFERENCIA_PESO',
        manifiestoId: id,
        pesoDeclarado: pesoDeclaradoTotal,
        pesoReal: pesoRealTotal,
        delta: `${porcentajeDif}%`,
        userId,
      });
    }

    res.json({
      success: true,
      data: {
        pesoDeclarado: pesoDeclaradoTotal,
        pesoReal: pesoRealTotal,
        diferencia,
        porcentajeDif: parseFloat(porcentajeDif as string)
      }
    });
  } catch (error) {
    next(error);
  }
};
