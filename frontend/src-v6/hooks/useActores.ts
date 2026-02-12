/**
 * SITREP v6 - Actores Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actoresService } from '../services/actores.service';
import type { ActorFilters, CreateGeneradorRequest, CreateTransportistaRequest, CreateOperadorRequest } from '../types/api';

const KEYS = {
  generadores: (filters?: ActorFilters) => ['generadores', filters] as const,
  generador: (id: string) => ['generadores', id] as const,
  transportistas: (filters?: ActorFilters) => ['transportistas', filters] as const,
  transportista: (id: string) => ['transportistas', id] as const,
  operadores: (filters?: ActorFilters) => ['operadores', filters] as const,
  operador: (id: string) => ['operadores', id] as const,
  vehiculos: (tid: string) => ['vehiculos', tid] as const,
  choferes: (tid: string) => ['choferes', tid] as const,
};

// Generadores
export function useGeneradores(filters?: ActorFilters) {
  return useQuery({
    queryKey: KEYS.generadores(filters),
    queryFn: () => actoresService.listGeneradores(filters),
  });
}

export function useGenerador(id: string) {
  return useQuery({
    queryKey: KEYS.generador(id),
    queryFn: () => actoresService.getGenerador(id),
    enabled: !!id,
  });
}

export function useCreateGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateGeneradorRequest) => actoresService.createGenerador(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

export function useUpdateGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateGeneradorRequest> }) =>
      actoresService.updateGenerador(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

export function useDeleteGenerador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actoresService.deleteGenerador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['generadores'] }),
  });
}

// Transportistas
export function useTransportistas(filters?: ActorFilters) {
  return useQuery({
    queryKey: KEYS.transportistas(filters),
    queryFn: () => actoresService.listTransportistas(filters),
  });
}

export function useTransportista(id: string) {
  return useQuery({
    queryKey: KEYS.transportista(id),
    queryFn: () => actoresService.getTransportista(id),
    enabled: !!id,
  });
}

export function useCreateTransportista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateTransportistaRequest) => actoresService.createTransportista(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  });
}

export function useUpdateTransportista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateTransportistaRequest> }) =>
      actoresService.updateTransportista(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  });
}

export function useDeleteTransportista() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actoresService.deleteTransportista(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['transportistas'] }),
  });
}

// Operadores
export function useOperadores(filters?: ActorFilters) {
  return useQuery({
    queryKey: KEYS.operadores(filters),
    queryFn: () => actoresService.listOperadores(filters),
  });
}

export function useOperador(id: string) {
  return useQuery({
    queryKey: KEYS.operador(id),
    queryFn: () => actoresService.getOperador(id),
    enabled: !!id,
  });
}

export function useCreateOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (req: CreateOperadorRequest) => actoresService.createOperador(req),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

export function useUpdateOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Partial<CreateOperadorRequest> }) =>
      actoresService.updateOperador(id, data),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

export function useDeleteOperador() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => actoresService.deleteOperador(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['operadores'] }),
  });
}

// Vehiculos & Choferes
export function useVehiculos(transportistaId: string) {
  return useQuery({
    queryKey: KEYS.vehiculos(transportistaId),
    queryFn: () => actoresService.listVehiculos(transportistaId),
    enabled: !!transportistaId,
  });
}

export function useChoferes(transportistaId: string) {
  return useQuery({
    queryKey: KEYS.choferes(transportistaId),
    queryFn: () => actoresService.listChoferes(transportistaId),
    enabled: !!transportistaId,
  });
}

export function useCreateVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, data }: { transportistaId: string; data: Partial<import('../types/models').Vehiculo> }) =>
      actoresService.createVehiculo(transportistaId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vehiculos', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}

export function useCreateChofer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, data }: { transportistaId: string; data: Partial<import('../types/models').Chofer> }) =>
      actoresService.createChofer(transportistaId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['choferes', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}

export function useUpdateVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, vehiculoId, data }: { transportistaId: string; vehiculoId: string; data: Partial<import('../types/models').Vehiculo> }) =>
      actoresService.updateVehiculo(transportistaId, vehiculoId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vehiculos', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}

export function useDeleteVehiculo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, vehiculoId }: { transportistaId: string; vehiculoId: string }) =>
      actoresService.deleteVehiculo(transportistaId, vehiculoId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['vehiculos', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}

export function useUpdateChofer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, choferId, data }: { transportistaId: string; choferId: string; data: Partial<import('../types/models').Chofer> }) =>
      actoresService.updateChofer(transportistaId, choferId, data),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['choferes', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}

export function useDeleteChofer() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ transportistaId, choferId }: { transportistaId: string; choferId: string }) =>
      actoresService.deleteChofer(transportistaId, choferId),
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ['choferes', vars.transportistaId] });
      qc.invalidateQueries({ queryKey: ['transportistas'] });
    },
  });
}
