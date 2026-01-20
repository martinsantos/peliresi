/**
 * Servicio para funciones de DEMO
 * Permite cambio de perfiles sin re-login
 */
import api from './api';

export interface DemoActor {
  id: string;
  name: string;
  cuit: string;
  detail: string;
}

export interface DemoRole {
  role: string;
  name: string;
  description: string;
  actors: DemoActor[];
}

export interface DemoProfile {
  role: string;
  roleName?: string;
  actorId?: string;
  actorName?: string;
}

export interface DemoProfilesResponse {
  currentProfile: {
    id: string;
    email: string;
    rol: string;
    rolName: string;
    actor: any;
  };
  demoProfile: {
    enabled: boolean;
    originalRole: string;
    impersonatedRole: string;
    impersonatedActorId?: string;
    impersonatedActorName?: string;
  } | null;
  availableRoles: DemoRole[];
}

const DEMO_PROFILE_KEY = 'sitrep_demo_profile';

class DemoService {
  /**
   * Verificar si el modo demo está habilitado
   */
  async getStatus(): Promise<{ demoEnabled: boolean; currentUser: any; demoProfile: any }> {
    const response = await api.get('/demo/status');
    return response.data.data;
  }

  /**
   * Obtener perfiles disponibles para cambio
   */
  async getAvailableProfiles(): Promise<DemoProfilesResponse> {
    const response = await api.get('/demo/profiles');
    return response.data.data;
  }

  /**
   * Validar un perfil antes de usarlo
   */
  async validateProfile(role: string, actorId?: string): Promise<any> {
    const response = await api.post('/demo/profiles/validate', { role, actorId });
    return response.data.data;
  }

  /**
   * Establecer perfil demo activo
   * Se guarda en localStorage y se envía en cada request
   */
  setActiveProfile(profile: DemoProfile | null): void {
    if (profile) {
      localStorage.setItem(DEMO_PROFILE_KEY, JSON.stringify(profile));
    } else {
      localStorage.removeItem(DEMO_PROFILE_KEY);
    }
    // Disparar evento para que otros componentes se enteren
    window.dispatchEvent(new CustomEvent('demoProfileChanged', { detail: profile }));
  }

  /**
   * Obtener perfil demo activo
   */
  getActiveProfile(): DemoProfile | null {
    const stored = localStorage.getItem(DEMO_PROFILE_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch {
        return null;
      }
    }
    return null;
  }

  /**
   * Limpiar perfil demo (volver al perfil real)
   */
  clearProfile(): void {
    this.setActiveProfile(null);
  }

  /**
   * Obtener el header para enviar en requests
   */
  getProfileHeader(): string | null {
    const profile = this.getActiveProfile();
    if (profile) {
      return JSON.stringify(profile);
    }
    return null;
  }
}

export const demoService = new DemoService();
