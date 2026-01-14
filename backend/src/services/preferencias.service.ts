import prisma from '../lib/prisma';

export interface PreferenciasUsuario {
  mostrarTourInicio: boolean;
  ultimaVersionTour: string | null;
}

class PreferenciasService {
  /**
   * Obtener preferencias del usuario
   */
  async getPreferencias(usuarioId: string): Promise<PreferenciasUsuario> {
    let preferencias = await prisma.preferenciaUsuario.findUnique({
      where: { usuarioId }
    });

    // Si no existen, crear con valores por defecto
    if (!preferencias) {
      preferencias = await prisma.preferenciaUsuario.create({
        data: {
          usuarioId,
          mostrarTourInicio: true,
          ultimaVersionTour: null
        }
      });
    }

    return {
      mostrarTourInicio: preferencias.mostrarTourInicio,
      ultimaVersionTour: preferencias.ultimaVersionTour
    };
  }

  /**
   * Actualizar preferencias del usuario
   */
  async updatePreferencias(
    usuarioId: string,
    data: Partial<PreferenciasUsuario>
  ): Promise<PreferenciasUsuario> {
    const preferencias = await prisma.preferenciaUsuario.upsert({
      where: { usuarioId },
      update: {
        mostrarTourInicio: data.mostrarTourInicio,
        ultimaVersionTour: data.ultimaVersionTour
      },
      create: {
        usuarioId,
        mostrarTourInicio: data.mostrarTourInicio ?? true,
        ultimaVersionTour: data.ultimaVersionTour ?? null
      }
    });

    return {
      mostrarTourInicio: preferencias.mostrarTourInicio,
      ultimaVersionTour: preferencias.ultimaVersionTour
    };
  }

  /**
   * Desactivar el tour de bienvenida
   */
  async skipTour(usuarioId: string, version?: string): Promise<void> {
    await prisma.preferenciaUsuario.upsert({
      where: { usuarioId },
      update: {
        mostrarTourInicio: false,
        ultimaVersionTour: version || '1.0.0'
      },
      create: {
        usuarioId,
        mostrarTourInicio: false,
        ultimaVersionTour: version || '1.0.0'
      }
    });
  }

  /**
   * Reactivar el tour de bienvenida
   */
  async reactivarTour(usuarioId: string): Promise<void> {
    await prisma.preferenciaUsuario.upsert({
      where: { usuarioId },
      update: {
        mostrarTourInicio: true
      },
      create: {
        usuarioId,
        mostrarTourInicio: true
      }
    });
  }
}

export const preferenciasService = new PreferenciasService();
