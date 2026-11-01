/**
 * SITREP v6 - Manifiesto Workflow Mutations
 * ==========================================
 * Create, update, and workflow state-change mutations for manifiestos.
 * Queries live in useManifiestos.ts.
 */

import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { manifiestoService } from '../services/manifiesto.service';
import { useAuth } from '../contexts/AuthContext';
import { submitDelivery } from '../services/deliveryCommand';
import { useQueryOwner } from './useQueryOwner';
import { supportRequestContext } from '../utils/supportSession';
import { INCIDENT_COMMAND_CHANGED, incidentCommandKey, readIncidentCommand, retryIncidentCommand, submitIncidentCommand,
  type IncidentCommand, type IncidentContext } from '../services/incidentCommand';
import type {
  CreateManifiestoRequest, FirmarManifiestoRequest,
  ConfirmarRetiroRequest, ConfirmarEntregaRequest, PesajeRequest,
  ConfirmarRecepcionRequest, RegistrarTratamientoRequest,
  RechazarManifiestoRequest, RegistrarIncidenteRequest,
} from '../types/api';

/** Shared query key roots — must match useManifiestos.ts */
const KEYS = {
  all: ['manifiestos'] as const,
  lists: () => [...KEYS.all, 'list'] as const,
  detail: (id: string) => [...KEYS.all, 'detail', id] as const,
};

// These explicit actions are not a persistent offline queue. Always attempt once
// and return failure to the open form, instead of silently waiting for reconnect.
const WORKFLOW_OPTIONS = { networkMode: 'always', retry: false } as const;

export function useCreateManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: (req: CreateManifiestoRequest) => manifiestoService.create(req),
    onSuccess: () => Promise.all([
      qc.invalidateQueries({ queryKey: KEYS.lists() }),
      qc.invalidateQueries({ queryKey: ['training-tasks'] }),
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] }),
    ]),
  });
}

export function useUpdateManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & Partial<CreateManifiestoRequest>) =>
      manifiestoService.update(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useFirmarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & FirmarManifiestoRequest) =>
      manifiestoService.firmar(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useConfirmarRetiro() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarRetiroRequest) =>
      manifiestoService.confirmarRetiro(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useConfirmarEntrega() {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const owner = useQueryOwner();
  const requestContext = useMemo(() => supportRequestContext(), [currentUser, owner]);
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarEntregaRequest) => {
      if (!currentUser?.id) throw new Error('Sesión no disponible. Volvé a ingresar.');
      return submitDelivery(id, req, { userId: currentUser.id, owner, role: currentUser.rol,
        companyScoped: !!currentUser.empresaContexto, requestContext });
    },
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function usePesaje() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & PesajeRequest) =>
      manifiestoService.pesaje(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
    },
  });
}

export function useConfirmarRecepcion() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & ConfirmarRecepcionRequest) =>
      manifiestoService.confirmarRecepcion(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useConfirmarRecepcionInSitu() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id }: { id: string }) =>
      manifiestoService.confirmarRecepcionInSitu(id),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRegistrarTratamiento() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & RegistrarTratamientoRequest) =>
      manifiestoService.registrarTratamiento(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRechazarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & RechazarManifiestoRequest) =>
      manifiestoService.rechazar(id, req),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRegistrarIncidente(manifestId?: string) {
  const qc = useQueryClient();
  const { currentUser } = useAuth();
  const owner = useQueryOwner();
  const requestContext = useMemo(() => supportRequestContext(), [currentUser, owner]);
  const context = useMemo<IncidentContext | null>(() => currentUser?.id && owner && requestContext
    ? { userId: String(currentUser.id), owner, requestContext } : null, [currentUser?.id, owner, requestContext]);
  const key = context && manifestId ? incidentCommandKey(manifestId, context) : '';
  const [saved, setSaved] = useState<{ key: string; pending: IncidentCommand | null; error: string } | null>(null);
  const refresh = useCallback(() => {
    if (!context || !manifestId || !key) return;
    try { setSaved({ key, pending: readIncidentCommand(manifestId, context), error: '' }); }
    catch { setSaved({ key, pending: null, error: 'No se pudo revisar la copia del incidente. Conservá este dispositivo y consultá a soporte.' }); }
  }, [context, manifestId, key]);
  useEffect(() => {
    refresh();
    const onStorage = (event: StorageEvent) => { if (event.key === key) refresh(); };
    window.addEventListener('storage', onStorage);
    window.addEventListener(INCIDENT_COMMAND_CHANGED, refresh);
    window.addEventListener('focus', refresh);
    return () => { window.removeEventListener('storage', onStorage); window.removeEventListener(INCIDENT_COMMAND_CHANGED, refresh); window.removeEventListener('focus', refresh); };
  }, [key, refresh]);
  const invalidate = (id: string) => {
    qc.invalidateQueries({ queryKey: KEYS.detail(id) });
    qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
    qc.invalidateQueries({ queryKey: ['training-tasks'] });
    qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
    qc.invalidateQueries({ queryKey: KEYS.lists() });
  };
  const mutation = useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, ...req }: { id: string } & RegistrarIncidenteRequest) => {
      if (!context || id !== manifestId) throw new Error('La cuenta o el viaje cambiaron. Volvé a abrir el manifiesto.');
      return submitIncidentCommand(id, context, req);
    },
    onSuccess: (_, { id }) => invalidate(id),
    onSettled: refresh,
  });
  const retry = useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: () => {
      if (!context || !manifestId) throw new Error('La cuenta o el viaje cambiaron. Volvé a abrir el manifiesto.');
      return retryIncidentCommand(manifestId, context);
    },
    onSuccess: () => { if (manifestId) invalidate(manifestId); },
    onSettled: refresh,
  });
  const state = saved?.key === key ? saved : null;
  return { ...mutation, isPending: mutation.isPending || retry.isPending, pendingIncident: state?.pending || null,
    incidentStorageError: !key ? 'Ingresá nuevamente para revisar el envío del incidente.' : state?.error || '',
    checkingIncident: !!key && !state, retryIncident: retry.mutateAsync, refreshIncident: refresh };
}

export function useCerrarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: (id: string) => manifiestoService.cerrar(id),
    onSuccess: (_, id) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useCancelarManifiesto() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, motivo }: { id: string; motivo?: string }) =>
      manifiestoService.cancelar(id, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useRevertirEstado() {
  const qc = useQueryClient();
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: ({ id, estadoNuevo, motivo }: { id: string; estadoNuevo: string; motivo?: string }) =>
      manifiestoService.revertirEstado(id, estadoNuevo, motivo),
    onSuccess: (_, { id }) => {
      qc.invalidateQueries({ queryKey: KEYS.detail(id) });
      qc.invalidateQueries({ queryKey: ['manifest-proposal'] });
      qc.invalidateQueries({ queryKey: ['training-tasks'] });
      qc.invalidateQueries({ queryKey: ['manifest-agenda'] });
      qc.invalidateQueries({ queryKey: KEYS.lists() });
    },
  });
}

export function useValidarQR() {
  return useMutation({
    ...WORKFLOW_OPTIONS,
    mutationFn: (code: string) => manifiestoService.validarQR(code),
  });
}
