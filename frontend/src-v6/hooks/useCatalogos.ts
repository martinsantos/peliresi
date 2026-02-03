/**
 * SITREP v6 - Catalogos Hooks
 */

import { useQuery } from '@tanstack/react-query';
import { catalogoService } from '../services/catalogo.service';

const STALE_TIME = 10 * 60 * 1000; // 10 min cache for catalogos

export function useTiposResiduo() {
  return useQuery({
    queryKey: ['catalogos', 'tipos-residuo'],
    queryFn: () => catalogoService.tiposResiduo(),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoGeneradores() {
  return useQuery({
    queryKey: ['catalogos', 'generadores'],
    queryFn: () => catalogoService.generadores(),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoTransportistas() {
  return useQuery({
    queryKey: ['catalogos', 'transportistas'],
    queryFn: () => catalogoService.transportistas(),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoOperadores() {
  return useQuery({
    queryKey: ['catalogos', 'operadores'],
    queryFn: () => catalogoService.operadores(),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoVehiculos() {
  return useQuery({
    queryKey: ['catalogos', 'vehiculos'],
    queryFn: () => catalogoService.vehiculos(),
    staleTime: STALE_TIME,
  });
}

export function useCatalogoChoferes() {
  return useQuery({
    queryKey: ['catalogos', 'choferes'],
    queryFn: () => catalogoService.choferes(),
    staleTime: STALE_TIME,
  });
}
