import { Response, NextFunction } from 'express';
import QRCode from 'qrcode';
import { z } from 'zod';
import { AppError } from '../middlewares/errorHandler';
import { AuthRequest } from '../middlewares/auth.middleware';
import prisma from '../lib/prisma';
import { domainEvents } from '../services/domainEvent.service';
import { computeRollingHash, computeClosureHash, hashManifiesto, registrarSello } from '../services/blockchain.service';
import { invalidateGpsCache } from './manifiesto-gps.controller';
import { assertCanAccessManifiesto } from '../utils/roleFilter';
import {
  cancelarManifiestoSchema,
  canRevertManifest,
  confirmarRecepcionSchema,
  hasCompleteCoordinates,
  rechazarCargaSchema,
  registrarIncidenteSchema,
  registrarPesajeSchema,
  registrarTratamientoSchema,
  revertirManifiestoSchema,
  reversionCleanup,
  VALID_MANIFEST_REVERSIONS,
} from '../domain/manifiestoWorkflow';

// Zod schemas
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
    await assertCanAccessManifiesto(prisma, req.user, id);
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar retiros', 403);
    }

    // Guard: IN_SITU manifiestos skip transport entirely
    const pre = await prisma.manifiesto.findUnique({ where: { id }, select: { modalidad: true } });
    if (pre?.modalidad === 'IN_SITU') {
      throw new AppError('Los manifiestos in situ no requieren retiro por transportista', 400);
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

      if (hasCompleteCoordinates(latitud, longitud)) {
        await tx.trackingGPS.create({
          data: {
            manifiestoId: id,
            latitud: latitud!,
            longitud: longitud!
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const { latitud, longitud, observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden confirmar entregas', 403);
    }

    // Guard: IN_SITU manifiestos skip transport entirely
    const pre = await prisma.manifiesto.findUnique({ where: { id }, select: { modalidad: true } });
    if (pre?.modalidad === 'IN_SITU') {
      throw new AppError('Los manifiestos in situ no requieren entrega por transportista', 400);
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = confirmarRecepcionSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { observaciones, pesoReal } = parsed.data;
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

// Confirmar recepcion in situ (operador) — APROBADO → RECIBIDO directly for IN_SITU manifiestos
export const confirmarRecepcionInSitu = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertCanAccessManifiesto(prisma, req.user, id);
    const { observaciones } = req.body;
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden confirmar recepciones in situ', 403);
    }

    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      // Validate manifiesto exists, is APROBADO, and is IN_SITU
      const current = await tx.manifiesto.findUnique({
        where: { id },
        select: { estado: true, modalidad: true },
      });
      if (!current) throw new AppError('Manifiesto no encontrado', 404);
      if (current.modalidad !== 'IN_SITU') {
        throw new AppError('Esta accion solo aplica a manifiestos con modalidad IN_SITU', 400);
      }
      if (current.estado !== 'APROBADO') {
        throw new AppError('El manifiesto debe estar aprobado para confirmar recepcion in situ', 400);
      }

      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'APROBADO' },
          data: {
            estado: 'RECIBIDO',
            fechaRecepcion: new Date(),
          },
          include: {
            generador: true,
            transportista: true,
            operador: true,
            residuos: { include: { tipoResiduo: true } },
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2025') {
          throw new AppError('El manifiesto debe estar aprobado para confirmar recepcion in situ', 400);
        }
        throw err;
      }

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'RECEPCION_IN_SITU',
          descripcion: `Recepcion in situ confirmada por el operador.${observaciones ? ' ' + observaciones : ''}`,
          usuarioId: userId,
        },
      });

      await updateRollingHash(tx, id, 'RECIBIDO', updated.fechaRecepcion!, updated.observaciones, evento.id);

      return updated;
    });

    res.json({
      success: true,
      data: { manifiesto: manifiestoActualizado },
    });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: manifiestoActualizado.id,
      estadoAnterior: 'APROBADO',
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
    await assertCanAccessManifiesto(prisma, req.user, id);
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
          transportistaCuit: fresh.transportista?.cuit ?? '',
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = rechazarCargaSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { motivo, descripcion, cantidadRechazada } = parsed.data;
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = registrarIncidenteSchema.safeParse(req.body);
    if (!parsed.success) {
      throw new AppError(parsed.error.issues[0].message, 400);
    }
    const { tipoIncidente, tipo, descripcion, latitud, longitud } = parsed.data;
    const tipoFinal = (tipoIncidente || tipo)!; // Schema guarantees one is present.
    const userId = req.user.id;

    if (req.user.rol !== 'TRANSPORTISTA' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los transportistas pueden registrar incidentes', 403);
    }

    const evento = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Manifiesto no encontrado', 404);

      const manifiesto = await tx.manifiesto.findUnique({ where: { id } });
      if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
      if (manifiesto.estado !== 'EN_TRANSITO') {
        throw new AppError('Solo se pueden registrar incidentes en transportes activos', 400);
      }

      const created = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'INCIDENTE',
          descripcion: `INCIDENTE: ${tipoFinal}. ${descripcion}`,
          latitud,
          longitud,
          usuarioId: userId,
        },
      });

      const observaciones = `${manifiesto.observaciones || ''} [INCIDENTE: ${tipoFinal}]`.trim();
      await tx.manifiesto.update({ where: { id }, data: { observaciones } });
      await updateRollingHash(tx, id, manifiesto.estado, new Date(), observaciones, created.id);
      return created;
    });

    res.json({
      success: true,
      data: { evento }
    });

    domainEvents.emit({
      type: 'INCIDENTE_REGISTRADO',
      manifiestoId: id,
      tipoIncidente: tipoFinal,
      descripcion,
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = registrarTratamientoSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { metodoTratamiento, metodo, fechaTratamiento, observaciones } = parsed.data;
    const metodoFinal = metodoTratamiento || metodo; // Accept both field names
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar tratamientos', 403);
    }

    // Pre-fetch manifiesto to get operadorId for tratamiento validation
    const manifiestoCheck = await prisma.manifiesto.findUnique({
      where: { id },
      select: { operadorId: true, estado: true },
    });
    if (!manifiestoCheck) {
      throw new AppError('Manifiesto no encontrado', 404);
    }
    if (manifiestoCheck.estado !== 'RECIBIDO') {
      throw new AppError('El manifiesto debe estar recibido para registrar tratamiento', 400);
    }

    // Validate metodo against operador's authorized tratamientos
    const operadorTratamientos = await prisma.tratamientoAutorizado.findMany({
      where: { operadorId: manifiestoCheck.operadorId, activo: true },
      select: { id: true, metodo: true },
    });
    const metodosUnicos = [...new Set(operadorTratamientos.map(t => t.metodo))];
    if (metodosUnicos.length > 0 && metodoFinal && !metodosUnicos.includes(metodoFinal)) {
      throw new AppError(
        `Método "${metodoFinal}" no autorizado para este operador. Métodos válidos: ${metodosUnicos.join(', ')}`,
        400,
      );
    }
    const matchingTratamiento = metodoFinal
      ? operadorTratamientos.find(t => t.metodo === metodoFinal)
      : undefined;

    // Atomic conditional update: prevents double-tap race condition
    const manifiestoActualizado = await prisma.$transaction(async (tx) => {
      let updated;
      try {
        updated = await tx.manifiesto.update({
          where: { id, estado: 'RECIBIDO' },
          data: {
            estado: 'EN_TRATAMIENTO',
            tratamientoMetodo: metodoFinal || null,
            tratamientoAutorizadoId: matchingTratamiento?.id || null,
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
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = revertirManifiestoSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { estadoNuevo, motivo } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Manifiesto no encontrado', 404);

      const manifiesto = await tx.manifiesto.findUnique({ where: { id } });
      if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);

      const estadoAnterior = manifiesto.estado;
      if (!canRevertManifest(estadoAnterior, estadoNuevo)) {
        const validTargets = VALID_MANIFEST_REVERSIONS[estadoAnterior];
        throw new AppError(
          `No se puede revertir de ${estadoAnterior} a ${estadoNuevo}. Transiciones validas: ${validTargets?.join(', ') || 'ninguna'}`,
          400,
        );
      }

      const updated = await tx.manifiesto.update({
        where: { id, estado: estadoAnterior },
        data: { estado: estadoNuevo, ...reversionCleanup(estadoNuevo) },
      });
      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'REVERSION',
          descripcion: `Reversion: ${estadoAnterior} -> ${estadoNuevo}${motivo ? '. Motivo: ' + motivo : ''}`,
          usuarioId: req.user!.id,
        },
      });
      await updateRollingHash(tx, id, estadoNuevo, new Date(), updated.observaciones, evento.id);
      return { updated, estadoAnterior };
    });

    invalidateGpsCache(id);
    res.json({ success: true, data: { manifiesto: result.updated } });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: id,
      estadoAnterior: result.estadoAnterior,
      estadoNuevo,
      numero: result.updated.numero,
      userId: req.user.id,
    });
  } catch (error) {
    next(error);
  }
};

// Registrar pesaje (operador) - CU-O04
export const registrarPesaje = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertCanAccessManifiesto(prisma, req.user, id);
    const userId = req.user.id;

    if (req.user.rol !== 'OPERADOR' && req.user.rol !== 'ADMIN') {
      throw new AppError('Solo los operadores pueden registrar pesajes', 403);
    }

    const parsed = registrarPesajeSchema.safeParse(req.body);
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { items, observaciones } = parsed.data;

    const result = await prisma.$transaction(async (tx) => {
      const locked = await tx.$queryRaw<Array<{ id: string }>>`
        SELECT id FROM manifiestos WHERE id = ${id} FOR UPDATE
      `;
      if (locked.length === 0) throw new AppError('Manifiesto no encontrado', 404);

      const manifiesto = await tx.manifiesto.findUnique({ where: { id }, include: { residuos: true } });
      if (!manifiesto) throw new AppError('Manifiesto no encontrado', 404);
      if (manifiesto.estado !== 'ENTREGADO' && manifiesto.estado !== 'RECIBIDO') {
        throw new AppError('El manifiesto debe estar entregado o recibido para registrar pesaje', 400);
      }

      let pesoDeclaradoTotal = 0;
      let pesoRealTotal = 0;
      for (const item of items) {
        const residuoOriginal = manifiesto.residuos.find((residuo) => residuo.id === item.id);
        if (!residuoOriginal) throw new AppError(`Residuo con ID ${item.id} no encontrado en el manifiesto`, 400);

        pesoDeclaradoTotal += residuoOriginal.cantidad;
        pesoRealTotal += item.pesoReal;
        const tipoDiferencia = item.pesoReal > residuoOriginal.cantidad
          ? 'EXCEDENTE'
          : item.pesoReal < residuoOriginal.cantidad ? 'FALTANTE' : 'NINGUNA';

        await tx.manifiestoResiduo.update({
          where: { id: item.id },
          data: { cantidadRecibida: item.pesoReal, tipoDiferencia, estado: 'pesado' },
        });
      }

      const diferencia = pesoRealTotal - pesoDeclaradoTotal;
      const porcentajeDif = pesoDeclaradoTotal > 0 ? (diferencia / pesoDeclaradoTotal) * 100 : 0;
      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'PESAJE',
          descripcion: `Pesaje realizado. Declarado Total: ${pesoDeclaradoTotal}, Real Total: ${pesoRealTotal}. Diferencia: ${porcentajeDif.toFixed(2)}%. ${observaciones || ''}`,
          usuarioId: userId,
        },
      });
      await updateRollingHash(tx, id, manifiesto.estado, new Date(), manifiesto.observaciones, evento.id);

      const hasSignificantDifference = Math.abs(porcentajeDif) > 5;
      if (hasSignificantDifference) {
        const anomaly = await tx.eventoManifiesto.create({
          data: {
            manifiestoId: id,
            tipo: 'INCIDENTE',
            descripcion: `Diferencia de peso significativa detectada (${porcentajeDif.toFixed(2)}%)`,
            usuarioId: userId,
          },
        });
        await updateRollingHash(tx, id, manifiesto.estado, new Date(), manifiesto.observaciones, anomaly.id);
      }

      return { pesoDeclaradoTotal, pesoRealTotal, diferencia, porcentajeDif, hasSignificantDifference };
    });

    if (result.hasSignificantDifference) {
      domainEvents.emit({
        type: 'DIFERENCIA_PESO',
        manifiestoId: id,
        pesoDeclarado: result.pesoDeclaradoTotal,
        pesoReal: result.pesoRealTotal,
        delta: `${result.porcentajeDif.toFixed(2)}%`,
        userId,
      });
    }

    res.json({
      success: true,
      data: {
        pesoDeclarado: result.pesoDeclaradoTotal,
        pesoReal: result.pesoRealTotal,
        diferencia: result.diferencia,
        porcentajeDif: result.porcentajeDif,
      }
    });
  } catch (error) {
    next(error);
  }
};

// Cancelar manifiesto (generador o admin)
export const cancelarManifiesto = async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.params;
    await assertCanAccessManifiesto(prisma, req.user, id);
    const parsed = cancelarManifiestoSchema.safeParse(req.body || {});
    if (!parsed.success) throw new AppError(parsed.error.issues[0].message, 400);
    const { motivo } = parsed.data;
    const userId = req.user.id;

    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id },
      select: { id: true, estado: true, numero: true },
    });

    if (!manifiesto) {
      throw new AppError('Manifiesto no encontrado', 404);
    }
    if (manifiesto.estado === 'CANCELADO') {
      throw new AppError('El manifiesto ya está cancelado', 400);
    }
    if (manifiesto.estado === 'TRATADO') {
      throw new AppError('No se puede cancelar un manifiesto ya tratado', 400);
    }

    const estadoAnterior = manifiesto.estado;

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.manifiesto.update({
        where: { id, estado: estadoAnterior },
        data: { estado: 'CANCELADO' },
        include: {
          generador: true,
          transportista: true,
          operador: true,
        },
      });

      const evento = await tx.eventoManifiesto.create({
        data: {
          manifiestoId: id,
          tipo: 'CANCELACION',
          descripcion: `Manifiesto cancelado${motivo ? ': ' + motivo : ''}`,
          usuarioId: userId,
        },
      });

      await updateRollingHash(tx, id, 'CANCELADO', new Date(), motivo || null, evento.id);

      return updated;
    });

    invalidateGpsCache(id);

    res.json({ success: true, data: { manifiesto: result } });

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: result.id,
      estadoAnterior,
      estadoNuevo: 'CANCELADO',
      numero: result.numero,
      userId,
    });
  } catch (error) {
    next(error);
  }
};
