import axios from 'axios';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3010/api';

export interface PreferenciasUsuario {
  mostrarTourInicio: boolean;
  ultimaVersionTour: string | null;
}

class PreferenciasService {
  private getHeaders() {
    const token = localStorage.getItem('token');
    return {
      'Content-Type': 'application/json',
      Authorization: token ? `Bearer ${token}` : ''
    };
  }

  /**
   * Obtener preferencias del usuario actual
   */
  async getMisPreferencias(): Promise<PreferenciasUsuario> {
    try {
      const response = await axios.get(`${API_URL}/preferencias/mis-preferencias`, {
        headers: this.getHeaders()
      });
      return response.data.data.preferencias;
    } catch (error) {
      console.error('Error obteniendo preferencias:', error);
      // Devolver valores por defecto si hay error - NO mostrar tour por defecto
      return {
        mostrarTourInicio: false,
        ultimaVersionTour: null
      };
    }
  }

  /**
   * Actualizar preferencias del usuario actual
   */
  async updateMisPreferencias(preferencias: Partial<PreferenciasUsuario>): Promise<PreferenciasUsuario> {
    const response = await axios.put(`${API_URL}/preferencias/mis-preferencias`, preferencias, {
      headers: this.getHeaders()
    });
    return response.data.data.preferencias;
  }

  /**
   * Desactivar el tour de bienvenida
   */
  async skipTour(version?: string): Promise<void> {
    await axios.post(`${API_URL}/preferencias/skip-tour`, { version }, {
      headers: this.getHeaders()
    });
  }

  /**
   * Reactivar el tour de bienvenida
   */
  async reactivarTour(): Promise<void> {
    await axios.post(`${API_URL}/preferencias/reactivar-tour`, {}, {
      headers: this.getHeaders()
    });
  }
}

export const preferenciasService = new PreferenciasService();
