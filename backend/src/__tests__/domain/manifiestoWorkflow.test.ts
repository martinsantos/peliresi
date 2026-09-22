import { describe, expect, it } from 'vitest';
import { EstadoManifiesto } from '@prisma/client';
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
} from '../../domain/manifiestoWorkflow';

describe('manifest workflow domain rules', () => {
  it('requires a classified incident and validates coordinates', () => {
    expect(registrarIncidenteSchema.safeParse({ descripcion: 'Derrame controlado' }).success).toBe(false);
    expect(registrarIncidenteSchema.safeParse({
      tipo: 'DERRAME',
      descripcion: 'Derrame controlado',
      latitud: -32.89,
      longitud: -68.84,
    }).success).toBe(true);
    expect(registrarIncidenteSchema.safeParse({
      tipo: 'DERRAME',
      descripcion: 'Fuera de rango',
      latitud: 100,
      longitud: -68.84,
    }).success).toBe(false);
  });

  it('accepts zero coordinates as complete values', () => {
    expect(hasCompleteCoordinates(0, 0)).toBe(true);
    expect(hasCompleteCoordinates(undefined, 0)).toBe(false);
  });

  it('normalizes both weighing payload formats and rejects invalid weights', () => {
    const modern = registrarPesajeSchema.parse({ residuos: [{ id: 'r-1', cantidadRecibida: '12.5' }] });
    expect(modern.items).toEqual([{ id: 'r-1', pesoReal: 12.5 }]);

    const legacy = registrarPesajeSchema.parse({ residuosPesados: [{ id: 'r-1', pesoReal: 10 }] });
    expect(legacy.items).toEqual([{ id: 'r-1', pesoReal: 10 }]);

    expect(registrarPesajeSchema.safeParse({ residuos: [{ id: 'r-1', cantidadRecibida: -1 }] }).success).toBe(false);
    expect(registrarPesajeSchema.safeParse({
      residuosPesados: [{ id: 'r-1', pesoReal: 1 }, { id: 'r-1', pesoReal: 2 }],
    }).success).toBe(false);
  });

  it('only permits one-step administrative reversions', () => {
    expect(canRevertManifest(EstadoManifiesto.ENTREGADO, EstadoManifiesto.EN_TRANSITO)).toBe(true);
    expect(canRevertManifest(EstadoManifiesto.ENTREGADO, EstadoManifiesto.BORRADOR)).toBe(false);
    expect(canRevertManifest(EstadoManifiesto.TRATADO, EstadoManifiesto.RECIBIDO)).toBe(true);
    expect(revertirManifiestoSchema.safeParse({ estadoNuevo: 'NO_EXISTE' }).success).toBe(false);
  });

  it('clears timestamps and treatment metadata that belong to later states', () => {
    expect(reversionCleanup(EstadoManifiesto.APROBADO)).toMatchObject({
      fechaRetiro: null,
      fechaEntrega: null,
      fechaRecepcion: null,
      fechaCierre: null,
      tratamientoMetodo: null,
      tratamientoAutorizadoId: null,
    });
    expect(reversionCleanup(EstadoManifiesto.EN_TRATAMIENTO)).toEqual({ fechaCierre: null });
  });

  it('validates reception, rejection, treatment and cancellation payloads', () => {
    expect(confirmarRecepcionSchema.parse({ pesoReal: '0' }).pesoReal).toBe(0);
    expect(confirmarRecepcionSchema.safeParse({ pesoReal: -1 }).success).toBe(false);
    expect(rechazarCargaSchema.safeParse({ motivo: '' }).success).toBe(false);
    expect(rechazarCargaSchema.safeParse({ motivo: 'Envase dañado', cantidadRechazada: 12 }).success).toBe(true);
    expect(registrarTratamientoSchema.safeParse({ observaciones: 'Sin método' }).success).toBe(false);
    expect(registrarTratamientoSchema.safeParse({ metodo: 'Incineración' }).success).toBe(true);
    expect(cancelarManifiestoSchema.safeParse({ motivo: 'x' }).success).toBe(false);
  });
});
