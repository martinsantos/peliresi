/**
 * React Query Client Configuration
 * Optimizado para escalabilidad y rendimiento
 */
import { QueryClient } from '@tanstack/react-query';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Datos considerados frescos por 30 segundos
      staleTime: 30 * 1000,
      // Datos en caché por 5 minutos
      gcTime: 5 * 60 * 1000,
      // 2 reintentos con backoff exponencial
      retry: 2,
      retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 30000),
      // No refetch automático al enfocar ventana (reduce requests)
      refetchOnWindowFocus: false,
      // No refetch al reconectar (manejamos manualmente)
      refetchOnReconnect: false,
    },
    mutations: {
      // Reintentos para mutaciones
      retry: 1,
    },
  },
});

// Keys de queries para consistencia
export const queryKeys = {
  // Dashboard
  dashboardStats: (role: string) => ['dashboard', 'stats', role] as const,

  // Manifiestos
  manifiestos: (filters?: object) => ['manifiestos', filters] as const,
  manifiesto: (id: string) => ['manifiestos', id] as const,

  // Viajes
  viajes: () => ['viajes'] as const,
  viajesActivos: () => ['viajes', 'activos'] as const,
  viaje: (id: string) => ['viajes', id] as const,

  // Catálogos (largo cache)
  tiposResiduos: () => ['catalogos', 'tiposResiduos'] as const,
  generadores: () => ['catalogos', 'generadores'] as const,
  transportistas: () => ['catalogos', 'transportistas'] as const,
  operadores: () => ['catalogos', 'operadores'] as const,

  // Admin
  usuarios: (filters?: object) => ['admin', 'usuarios', filters] as const,
  estadisticas: () => ['admin', 'estadisticas'] as const,

  // Notificaciones
  notificaciones: (userId: string) => ['notificaciones', userId] as const,
} as const;

export default queryClient;
