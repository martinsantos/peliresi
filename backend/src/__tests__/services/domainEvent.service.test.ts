import { describe, it, expect, vi, beforeEach } from 'vitest';

vi.mock('../../utils/logger', () => ({
  __esModule: true,
  default: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
  logger: { error: vi.fn(), warn: vi.fn(), info: vi.fn(), debug: vi.fn() },
}));

import { domainEvents } from '../../services/domainEvent.service';

describe('DomainEventBus', () => {
  beforeEach(() => {
    // Remove all listeners between tests
    domainEvents.removeAllListeners();
  });

  it('should be importable', () => {
    expect(domainEvents).toBeDefined();
  });

  it('subscribe is a function', () => {
    expect(typeof domainEvents.subscribe).toBe('function');
  });

  it('emit is a function', () => {
    expect(typeof domainEvents.emit).toBe('function');
  });

  it('emits an event and calls subscribed handler', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'MANIFIESTO_ESTADO_CAMBIADO',
      manifiestoId: 'man-1',
      estadoAnterior: 'BORRADOR',
      estadoNuevo: 'APROBADO',
      numero: 'MAN-001',
      userId: 'user-1',
    });

    // Handler is called via setImmediate, so wait a tick
    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'MANIFIESTO_ESTADO_CAMBIADO',
          manifiestoId: 'man-1',
          estadoNuevo: 'APROBADO',
        })
      );
      done();
    }, 10);
  }));

  it('emits INCIDENTE_REGISTRADO event with coordinates', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'INCIDENTE_REGISTRADO',
      manifiestoId: 'man-1',
      tipoIncidente: 'DERRAME',
      descripcion: 'Derrame de residuos',
      userId: 'user-1',
      latitud: -32.89,
      longitud: -68.84,
    });

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'INCIDENTE_REGISTRADO',
          tipoIncidente: 'DERRAME',
          latitud: -32.89,
        })
      );
      done();
    }, 10);
  }));

  it('emits DIFERENCIA_PESO event with weight values', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'DIFERENCIA_PESO',
      manifiestoId: 'man-1',
      pesoDeclarado: 100,
      pesoReal: 120,
      delta: '20%',
      userId: 'user-1',
    });

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DIFERENCIA_PESO',
          pesoDeclarado: 100,
          pesoReal: 120,
        })
      );
      done();
    }, 10);
  }));

  it('emits ANOMALIA_GPS event', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'ANOMALIA_GPS',
      manifiestoId: 'man-1',
      tipoAnomalia: 'SIN_SENIAL',
      descripcion: 'Perdida de senial GPS',
      severidad: 'ALTA',
      userId: 'user-1',
    });

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'ANOMALIA_GPS',
          severidad: 'ALTA',
        })
      );
      done();
    }, 10);
  }));

  it('emits VENCIMIENTO_PROXIMO event', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'VENCIMIENTO_PROXIMO',
      entidad: 'CHOFER',
      entidadId: 'chofer-1',
      nombre: 'Juan Perez',
      vencimiento: new Date('2025-07-01'),
      diasRestantes: 15,
    });

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'VENCIMIENTO_PROXIMO',
          entidad: 'CHOFER',
          diasRestantes: 15,
        })
      );
      done();
    }, 10);
  }));

  it('allows multiple subscribers', () => new Promise<void>((done) => {
    const handler1 = vi.fn().mockResolvedValue(undefined);
    const handler2 = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler1);
    domainEvents.subscribe(handler2);

    domainEvents.emit({
      type: 'RECHAZO_CARGA',
      manifiestoId: 'man-1',
      motivo: 'Residuo no autorizado',
      numero: 'MAN-001',
      userId: 'user-1',
    });

    setTimeout(() => {
      expect(handler1).toHaveBeenCalled();
      expect(handler2).toHaveBeenCalled();
      done();
    }, 10);
  }));

  it('handles handler errors gracefully in setImmediate', () => new Promise<void>((done) => {
    const throwingHandler = vi.fn().mockRejectedValue(new Error('Handler failed'));
    domainEvents.subscribe(throwingHandler);

    domainEvents.emit({
      type: 'TIEMPO_EXCESIVO',
      manifiestoId: 'man-1',
      horasTransito: 72,
      numero: 'MAN-001',
      userId: 'user-1',
    });

    // Should not throw - error is caught in domainEventBus.subscribe
    setTimeout(() => {
      expect(throwingHandler).toHaveBeenCalled();
      done();
    }, 10);
  }));

  it('supports DESVIO_RUTA event type', () => new Promise<void>((done) => {
    const handler = vi.fn().mockResolvedValue(undefined);
    domainEvents.subscribe(handler);

    domainEvents.emit({
      type: 'DESVIO_RUTA',
      manifiestoId: 'man-1',
      distanciaKm: 15.5,
      numero: 'MAN-001',
      userId: 'user-1',
      latActual: -32.90,
      lonActual: -68.85,
    });

    setTimeout(() => {
      expect(handler).toHaveBeenCalledWith(
        expect.objectContaining({
          type: 'DESVIO_RUTA',
          distanciaKm: 15.5,
        })
      );
      done();
    }, 10);
  }));
});
