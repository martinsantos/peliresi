/**
 * Servicio de Evaluación de Alertas
 * Evalúa manifiestos y operaciones contra reglas de alerta activas
 */

import prisma from '../lib/prisma';
import { EventoAlerta, EstadoManifiesto } from '@prisma/client';

interface CondicionAlerta {
  campo?: string;
  operador?: string;
  valor?: any;
  estadoOrigen?: string;
  estadoDestino?: string;
  tiempoHoras?: number;
  porcentaje?: number;
  tipoResiduo?: string;
  cantidadMinima?: number;
}

interface ResultadoEvaluacion {
  reglaId: string;
  reglaNombre: string;
  evento: EventoAlerta;
  descripcion: string;
  severidad: 'INFO' | 'WARNING' | 'CRITICAL';
  detalles: Record<string, any>;
  accionRequerida?: string;
}

export class AlertaService {
  /**
   * Evalúa un manifiesto contra todas las reglas de alerta activas
   */
  async evaluarManifiesto(manifiestoId: string): Promise<ResultadoEvaluacion[]> {
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: {
        generador: true,
        transportista: true,
        operador: true,
        residuos: { include: { tipoResiduo: true } },
        eventos: { orderBy: { createdAt: 'desc' }, take: 10 }
      }
    });

    if (!manifiesto) return [];

    const reglasActivas = await prisma.reglaAlerta.findMany({
      where: { activa: true }
    });

    const resultados: ResultadoEvaluacion[] = [];

    for (const regla of reglasActivas) {
      const condicion = this.parseCondicion(regla.condicion);
      const resultado = await this.evaluarRegla(regla, condicion, manifiesto);
      if (resultado) {
        resultados.push(resultado);
      }
    }

    return resultados;
  }

  /**
   * Evalúa un cambio de estado y genera alertas si corresponde
   */
  async evaluarCambioEstado(
    manifiestoId: string,
    estadoAnterior: string,
    estadoNuevo: string,
    usuarioId: string
  ): Promise<ResultadoEvaluacion[]> {
    const reglas = await prisma.reglaAlerta.findMany({
      where: { activa: true, evento: 'CAMBIO_ESTADO' }
    });

    const resultados: ResultadoEvaluacion[] = [];
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId },
      include: { generador: true, transportista: true, operador: true }
    });

    if (!manifiesto) return [];

    for (const regla of reglas) {
      const condicion = this.parseCondicion(regla.condicion);

      // Verificar si la transición de estado coincide
      if (condicion.estadoOrigen && condicion.estadoOrigen !== estadoAnterior) continue;
      if (condicion.estadoDestino && condicion.estadoDestino !== estadoNuevo) continue;

      const resultado: ResultadoEvaluacion = {
        reglaId: regla.id,
        reglaNombre: regla.nombre,
        evento: 'CAMBIO_ESTADO',
        descripcion: `Cambio de estado: ${estadoAnterior} → ${estadoNuevo}`,
        severidad: this.determinarSeveridad(estadoNuevo),
        detalles: {
          manifiestoNumero: manifiesto.numero,
          estadoAnterior,
          estadoNuevo
        }
      };

      resultados.push(resultado);

      // Generar alerta en la base de datos
      await this.generarAlerta(regla.id, manifiestoId, resultado);
    }

    return resultados;
  }

  /**
   * Evalúa si hay tiempo excesivo en un estado
   */
  async evaluarTiempoExcesivo(): Promise<ResultadoEvaluacion[]> {
    const reglas = await prisma.reglaAlerta.findMany({
      where: { activa: true, evento: 'TIEMPO_EXCESIVO' }
    });

    const resultados: ResultadoEvaluacion[] = [];

    for (const regla of reglas) {
      const condicion = this.parseCondicion(regla.condicion);
      const horasLimite = condicion.tiempoHoras || 48;

      // Buscar manifiestos que excedan el tiempo en cierto estado
      const fechaLimite = new Date();
      fechaLimite.setHours(fechaLimite.getHours() - horasLimite);

      const estadoBuscar = (condicion.estadoOrigen || 'EN_TRANSITO') as EstadoManifiesto;
      const manifiestos = await prisma.manifiesto.findMany({
        where: {
          estado: estadoBuscar,
          updatedAt: { lt: fechaLimite }
        },
        include: { generador: true, transportista: true }
      });

      for (const m of manifiestos) {
        const horasTranscurridas = Math.floor(
          (Date.now() - m.updatedAt.getTime()) / (1000 * 60 * 60)
        );

        const resultado: ResultadoEvaluacion = {
          reglaId: regla.id,
          reglaNombre: regla.nombre,
          evento: 'TIEMPO_EXCESIVO',
          descripcion: `Manifiesto ${m.numero} lleva ${horasTranscurridas}h en estado ${m.estado}`,
          severidad: horasTranscurridas > horasLimite * 2 ? 'CRITICAL' : 'WARNING',
          detalles: {
            manifiestoNumero: m.numero,
            horasTranscurridas,
            horasLimite,
            estado: m.estado
          },
          accionRequerida: 'Verificar estado del transporte'
        };

        resultados.push(resultado);
      }
    }

    return resultados;
  }

  /**
   * Evalúa diferencia de peso entre origen y destino
   */
  async evaluarDiferenciaPeso(
    manifiestoId: string,
    pesoOrigen: number,
    pesoDestino: number
  ): Promise<ResultadoEvaluacion[]> {
    const reglas = await prisma.reglaAlerta.findMany({
      where: { activa: true, evento: 'DIFERENCIA_PESO' }
    });

    const resultados: ResultadoEvaluacion[] = [];
    const manifiesto = await prisma.manifiesto.findUnique({
      where: { id: manifiestoId }
    });

    if (!manifiesto) return [];

    for (const regla of reglas) {
      const condicion = this.parseCondicion(regla.condicion);
      const porcentajeMaximo = condicion.porcentaje || 5;

      const diferencia = Math.abs(pesoOrigen - pesoDestino);
      const porcentajeDiferencia = (diferencia / pesoOrigen) * 100;

      if (porcentajeDiferencia > porcentajeMaximo) {
        const resultado: ResultadoEvaluacion = {
          reglaId: regla.id,
          reglaNombre: regla.nombre,
          evento: 'DIFERENCIA_PESO',
          descripcion: `Diferencia de peso: ${porcentajeDiferencia.toFixed(1)}% (máximo permitido: ${porcentajeMaximo}%)`,
          severidad: porcentajeDiferencia > porcentajeMaximo * 2 ? 'CRITICAL' : 'WARNING',
          detalles: {
            manifiestoNumero: manifiesto.numero,
            pesoOrigen,
            pesoDestino,
            diferencia,
            porcentajeDiferencia
          },
          accionRequerida: 'Investigar pérdida de carga'
        };

        resultados.push(resultado);
        await this.generarAlerta(regla.id, manifiestoId, resultado);
      }
    }

    return resultados;
  }

  /**
   * Evalúa vencimientos próximos
   */
  async evaluarVencimientos(): Promise<ResultadoEvaluacion[]> {
    const reglas = await prisma.reglaAlerta.findMany({
      where: { activa: true, evento: 'VENCIMIENTO' }
    });

    const resultados: ResultadoEvaluacion[] = [];

    for (const regla of reglas) {
      const condicion = this.parseCondicion(regla.condicion);
      const diasAnticipacion = condicion.tiempoHoras ? condicion.tiempoHoras / 24 : 7;

      const fechaLimite = new Date();
      fechaLimite.setDate(fechaLimite.getDate() + diasAnticipacion);

      // Buscar vehiculos con habilitacion proxima a vencer
      const vehiculos = await prisma.vehiculo.findMany({
        where: {
          vencimiento: {
            lte: fechaLimite,
            gte: new Date()
          },
          activo: true
        },
        include: { transportista: true }
      });

      for (const vehiculo of vehiculos) {
        const diasRestantes = Math.ceil(
          (vehiculo.vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        resultados.push({
          reglaId: regla.id,
          reglaNombre: regla.nombre,
          evento: 'VENCIMIENTO',
          descripcion: `Habilitacion de vehiculo ${vehiculo.patente} vence en ${diasRestantes} dias`,
          severidad: diasRestantes <= 3 ? 'CRITICAL' : 'WARNING',
          detalles: {
            vehiculoId: vehiculo.id,
            patente: vehiculo.patente,
            transportista: vehiculo.transportista?.razonSocial,
            fechaVencimiento: vehiculo.vencimiento,
            diasRestantes
          },
          accionRequerida: 'Renovar habilitacion del vehiculo'
        });
      }

      // Buscar choferes con licencia proxima a vencer
      const choferes = await prisma.chofer.findMany({
        where: {
          vencimiento: {
            lte: fechaLimite,
            gte: new Date()
          },
          activo: true
        },
        include: { transportista: true }
      });

      for (const chofer of choferes) {
        const diasRestantes = Math.ceil(
          (chofer.vencimiento.getTime() - Date.now()) / (1000 * 60 * 60 * 24)
        );

        resultados.push({
          reglaId: regla.id,
          reglaNombre: regla.nombre,
          evento: 'VENCIMIENTO',
          descripcion: `Licencia de ${chofer.nombre} ${chofer.apellido} vence en ${diasRestantes} dias`,
          severidad: diasRestantes <= 3 ? 'CRITICAL' : 'WARNING',
          detalles: {
            choferId: chofer.id,
            nombre: `${chofer.nombre} ${chofer.apellido}`,
            transportista: chofer.transportista?.razonSocial,
            fechaVencimiento: chofer.vencimiento,
            diasRestantes
          },
          accionRequerida: 'Renovar licencia de conducir'
        });
      }
    }

    return resultados;
  }

  /**
   * Obtiene advertencias activas para mostrar en UI
   */
  async obtenerAdvertenciasActivas(filtros?: {
    manifiestoId?: string;
    evento?: EventoAlerta;
    severidad?: string;
  }): Promise<ResultadoEvaluacion[]> {
    const alertasPendientes = await prisma.alertaGenerada.findMany({
      where: {
        estado: 'PENDIENTE',
        ...(filtros?.manifiestoId && { manifiestoId: filtros.manifiestoId })
      },
      include: {
        regla: true,
        manifiesto: { select: { numero: true, estado: true } }
      },
      orderBy: { createdAt: 'desc' },
      take: 50
    });

    return alertasPendientes.map(alerta => {
      const datos = this.parseDatos(alerta.datos);
      return {
        reglaId: alerta.reglaId,
        reglaNombre: alerta.regla.nombre,
        evento: alerta.regla.evento,
        descripcion: datos.descripcion || alerta.regla.descripcion || '',
        severidad: datos.severidad || 'WARNING',
        detalles: datos.detalles || {},
        accionRequerida: datos.accionRequerida
      };
    });
  }

  /**
   * Evalúa una regla específica contra un manifiesto
   */
  private async evaluarRegla(
    regla: any,
    condicion: CondicionAlerta,
    manifiesto: any
  ): Promise<ResultadoEvaluacion | null> {
    switch (regla.evento as EventoAlerta) {
      case 'VENCIMIENTO':
        // Ya se evalúa en evaluarVencimientos
        return null;

      case 'TIEMPO_EXCESIVO':
        if (condicion.estadoOrigen && manifiesto.estado !== condicion.estadoOrigen) return null;
        const horasEnEstado = Math.floor(
          (Date.now() - new Date(manifiesto.updatedAt).getTime()) / (1000 * 60 * 60)
        );
        if (horasEnEstado > (condicion.tiempoHoras || 48)) {
          return {
            reglaId: regla.id,
            reglaNombre: regla.nombre,
            evento: 'TIEMPO_EXCESIVO',
            descripcion: `Manifiesto en estado ${manifiesto.estado} por ${horasEnEstado} horas`,
            severidad: 'WARNING',
            detalles: { horasEnEstado, estado: manifiesto.estado }
          };
        }
        return null;

      default:
        return null;
    }
  }

  /**
   * Genera una alerta en la base de datos
   */
  private async generarAlerta(
    reglaId: string,
    manifiestoId: string | null,
    resultado: ResultadoEvaluacion
  ) {
    await prisma.alertaGenerada.create({
      data: {
        reglaId,
        manifiestoId,
        datos: JSON.stringify({
          descripcion: resultado.descripcion,
          severidad: resultado.severidad,
          detalles: resultado.detalles,
          accionRequerida: resultado.accionRequerida
        }),
        estado: 'PENDIENTE'
      }
    });
  }

  /**
   * Parsea la condición JSON de una regla
   */
  private parseCondicion(condicionStr: string): CondicionAlerta {
    try {
      let parsed = JSON.parse(condicionStr);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return parsed as CondicionAlerta;
    } catch {
      return {};
    }
  }

  /**
   * Parsea los datos JSON de una alerta generada
   */
  private parseDatos(datosStr: string): any {
    try {
      let parsed = JSON.parse(datosStr);
      if (typeof parsed === 'string') parsed = JSON.parse(parsed);
      return parsed;
    } catch {
      return {};
    }
  }

  /**
   * Determina la severidad basada en el estado
   */
  private determinarSeveridad(estado: string): 'INFO' | 'WARNING' | 'CRITICAL' {
    switch (estado) {
      case 'RECHAZADO':
        return 'CRITICAL';
      case 'EN_TRANSITO':
        return 'INFO';
      case 'RECIBIDO':
      case 'TRATADO':
        return 'INFO';
      default:
        return 'WARNING';
    }
  }
}

export const alertaService = new AlertaService();
