/**
 * useCurrentActor - Hook para cargar datos del actor asociado al usuario logueado
 * Detecta automáticamente el tipo de actor según el rol del usuario
 * y carga sus datos completos incluyendo categorías parseadas
 */

import { useState, useEffect, useCallback } from 'react';
import api from '../services/api';
import { useAuth } from '../context/AuthContext';
import type { Generador, Transportista, Operador } from '../types';
import { parseCategorias, getCategoriasValidas } from '../utils/categorias';
import type { CategoriaYCode } from '../data/categorias-residuos';

// Tipos extendidos con categorías parseadas
export interface GeneradorConCategorias extends Generador {
  categoriasParsed: string[];
  categoriasInfo: CategoriaYCode[];
}

export interface TransportistaExtendido extends Transportista {
  vehiculosActivos: number;
  choferesActivos: number;
}

export interface OperadorConCategorias extends Operador {
  categoriasParsed: string[];
  categoriasInfo: CategoriaYCode[];
  tratamientosActivos: number;
}

export type ActorData = GeneradorConCategorias | TransportistaExtendido | OperadorConCategorias | null;

export interface ActorStats {
  manifiestosTotales: number;
  manifestosMes: number;
  manifestosActivos: number;
}

export interface UseCurrentActorResult {
  actor: ActorData;
  tipoActor: 'generador' | 'transportista' | 'operador' | null;
  loading: boolean;
  error: string | null;
  stats: ActorStats | null;
  refetch: () => Promise<void>;
}

export function useCurrentActor(): UseCurrentActorResult {
  const { user, effectiveRole } = useAuth();
  const [actor, setActor] = useState<ActorData>(null);
  const [tipoActor, setTipoActor] = useState<'generador' | 'transportista' | 'operador' | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [stats, setStats] = useState<ActorStats | null>(null);

  const fetchActorData = useCallback(async () => {
    if (!user) {
      setLoading(false);
      return;
    }

    // Determinar tipo de actor según rol efectivo
    const rol = effectiveRole || user.rol;
    let tipo: 'generador' | 'transportista' | 'operador' | null = null;

    switch (rol) {
      case 'GENERADOR':
      case 'ADMIN_GENERADORES':
        tipo = 'generador';
        break;
      case 'TRANSPORTISTA':
      case 'ADMIN_TRANSPORTISTAS':
        tipo = 'transportista';
        break;
      case 'OPERADOR':
      case 'ADMIN_OPERADORES':
        tipo = 'operador';
        break;
      case 'ADMIN':
        // Admin puede tener stats globales, intentar cargar
        tipo = null;
        break;
      default:
        setLoading(false);
        return;
    }

    setTipoActor(tipo);
    setLoading(true);
    setError(null);

    try {
      // Intentar cargar desde el endpoint mi-perfil primero
      const response = await api.get(`/actores/mi-perfil`);
      const data = response.data.data;

      // Siempre establecer stats si están disponibles (incluso para ADMIN)
      if (data.stats) {
        setStats(data.stats);
      }

      // Actualizar tipoActor desde la respuesta del backend si viene
      if (data.tipoActor && data.tipoActor !== 'admin') {
        setTipoActor(data.tipoActor);
        tipo = data.tipoActor;
      }

      if (data.actor) {
        // Procesar según tipo de actor
        let processedActor: ActorData = null;

        if (tipo === 'generador' && data.actor) {
          const gen = data.actor as Generador;
          processedActor = {
            ...gen,
            categoriasParsed: parseCategorias(gen.categoria),
            categoriasInfo: getCategoriasValidas(gen.categoria),
          } as GeneradorConCategorias;
        } else if (tipo === 'transportista' && data.actor) {
          const trans = data.actor as Transportista;
          processedActor = {
            ...trans,
            vehiculosActivos: trans.vehiculos?.filter(v => v.activo).length || 0,
            choferesActivos: trans.choferes?.filter(c => c.activo).length || 0,
          } as TransportistaExtendido;
        } else if (tipo === 'operador' && data.actor) {
          const op = data.actor as Operador;
          processedActor = {
            ...op,
            categoriasParsed: parseCategorias(op.categoria),
            categoriasInfo: getCategoriasValidas(op.categoria),
            tratamientosActivos: op.tratamientos?.filter(t => t.activo).length || 0,
          } as OperadorConCategorias;
        }

        setActor(processedActor);
      }
    } catch (err: any) {
      console.error('Error loading actor data:', err);

      // Fallback: intentar cargar desde el usuario directamente
      try {
        if (tipo === 'generador' && user.generador) {
          const gen = user.generador;
          setActor({
            ...gen,
            categoriasParsed: parseCategorias(gen.categoria),
            categoriasInfo: getCategoriasValidas(gen.categoria),
          } as GeneradorConCategorias);
        } else if (tipo === 'transportista' && user.transportista) {
          const trans = user.transportista;
          setActor({
            ...trans,
            vehiculosActivos: trans.vehiculos?.filter(v => v.activo).length || 0,
            choferesActivos: trans.choferes?.filter(c => c.activo).length || 0,
          } as TransportistaExtendido);
        } else if (tipo === 'operador' && user.operador) {
          const op = user.operador;
          setActor({
            ...op,
            categoriasParsed: parseCategorias(op.categoria),
            categoriasInfo: getCategoriasValidas(op.categoria),
            tratamientosActivos: op.tratamientos?.filter(t => t.activo).length || 0,
          } as OperadorConCategorias);
        } else if (rol !== 'ADMIN') {
          // Solo mostrar error si no es admin
          setError('No se encontraron datos del actor asociado');
        }
      } catch (fallbackErr) {
        if (rol !== 'ADMIN') {
          setError(err.response?.data?.message || 'Error al cargar datos del perfil');
        }
      }
    } finally {
      setLoading(false);
    }
  }, [user, effectiveRole]);

  useEffect(() => {
    fetchActorData();
  }, [fetchActorData]);

  return {
    actor,
    tipoActor,
    loading,
    error,
    stats,
    refetch: fetchActorData,
  };
}

// Hook específico para generadores
export function useGeneradorActual() {
  const result = useCurrentActor();
  return {
    ...result,
    generador: result.tipoActor === 'generador' ? result.actor as GeneradorConCategorias : null,
  };
}

// Hook específico para transportistas
export function useTransportistaActual() {
  const result = useCurrentActor();
  return {
    ...result,
    transportista: result.tipoActor === 'transportista' ? result.actor as TransportistaExtendido : null,
  };
}

// Hook específico para operadores
export function useOperadorActual() {
  const result = useCurrentActor();
  return {
    ...result,
    operador: result.tipoActor === 'operador' ? result.actor as OperadorConCategorias : null,
  };
}

export default useCurrentActor;
