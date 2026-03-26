/**
 * SITREP v6 - Transportista Hooks
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { actoresService } from '../services/actores.service';
import type { ActorFilters, CreateTransportistaRequest } from '../types/api';
import type { Vehiculo, Chofer } from '../types/models';

const KEYS = {
  transportistas: (filters?: ActorFilters) => ['transportistas', filters] as const,
  transportista: (id: string) => ['transportistas', id] as const,
  vehiculos: (tid: string) => ['vehiculos', tid] as const,
  choferes: (tid: string) => ['choferes', tid] as const,
};

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
    mutationFn: ({ transportistaId, data }: { transportistaId: string; data: Partial<Vehiculo> }) =>
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
    mutationFn: ({ transportistaId, data }: { transportistaId: string; data: Partial<Chofer> }) =>
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
    mutationFn: ({ transportistaId, vehiculoId, data }: { transportistaId: string; vehiculoId: string; data: Partial<Vehiculo> }) =>
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
    mutationFn: ({ transportistaId, choferId, data }: { transportistaId: string; choferId: string; data: Partial<Chofer> }) =>
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
