import { EventEmitter } from 'events';

export type DomainEvent =
  | {
      type: 'MANIFIESTO_ESTADO_CAMBIADO';
      manifiestoId: string;
      estadoAnterior: string;
      estadoNuevo: string;
      numero: string;
      userId: string;
    }
  | {
      type: 'INCIDENTE_REGISTRADO';
      manifiestoId: string;
      tipoIncidente: string;
      descripcion: string;
      userId: string;
      latitud?: number;
      longitud?: number;
    }
  | {
      type: 'RECHAZO_CARGA';
      manifiestoId: string;
      motivo: string;
      numero: string;
      userId: string;
    }
  | {
      type: 'DIFERENCIA_PESO';
      manifiestoId: string;
      pesoDeclarado: number;
      pesoReal: number;
      delta: string;
      userId: string;
    }
  | {
      type: 'ANOMALIA_GPS';
      manifiestoId: string;
      tipoAnomalia: string;
      descripcion: string;
      severidad: string;
      userId: string;
    }
  | {
      type: 'TIEMPO_EXCESIVO';
      manifiestoId: string;
      horasTransito: number;
      numero: string;
      userId: string;
    }
  | {
      type: 'DESVIO_RUTA';
      manifiestoId: string;
      distanciaKm: number;
      numero: string;
      userId: string;
      latActual: number;
      lonActual: number;
    }
  | {
      type: 'VENCIMIENTO_PROXIMO';
      entidad: 'TRANSPORTISTA' | 'VEHICULO' | 'CHOFER';
      entidadId: string;
      nombre: string;
      vencimiento: Date;
      diasRestantes: number;
    };

type Handler = (event: DomainEvent) => Promise<void>;

class DomainEventBus extends EventEmitter {
  subscribe(handler: Handler): void {
    this.on('event', (e: DomainEvent) =>
      setImmediate(() =>
        handler(e).catch((err: Error) =>
          console.error('[DomainEvent] handler error for', e.type, ':', err.message)
        )
      )
    );
  }

  // Override signature to accept typed DomainEvent instead of generic EventEmitter signature
  emit(event: DomainEvent): boolean;
  emit(eventName: string | symbol, ...args: any[]): boolean;
  emit(eventOrName: DomainEvent | string | symbol, ...args: any[]): boolean {
    if (typeof eventOrName === 'object' && 'type' in eventOrName) {
      return super.emit('event', eventOrName);
    }
    return super.emit(eventOrName, ...args);
  }
}

export const domainEvents = new DomainEventBus();
// Allow many subscribers without Node.js warning
domainEvents.setMaxListeners(20);
