import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { solicitudService } from '../services/solicitud.service';
import type { SolicitudFilters, IniciarSolicitudRequest, UpdateSolicitudRequest } from '../types/api';
import { useAdmissionContext } from './useAdmissionContext';

const KEYS = {
  solicitudes: (filters?: SolicitudFilters) => ['solicitudes', filters] as const,
  solicitud: (id: string) => ['solicitudes', id] as const,
  misSolicitudes: ['solicitudes', 'mis'] as const,
  mensajes: (id: string) => ['solicitudes', id, 'mensajes'] as const,
};

export function useSolicitudes(filters?: SolicitudFilters) {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.solicitudes(filters), owner],
    queryFn: () => solicitudService.list(filters),
    enabled: ready,
  });
}

export function useSolicitud(id: string) {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.solicitud(id), owner],
    queryFn: () => solicitudService.getById(id),
    enabled: !!id && ready,
    staleTime: 0,
  });
}

export function useMisSolicitudes() {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.misSolicitudes, owner],
    enabled: ready,
    queryFn: () => solicitudService.misSolicitudes(),
  });
}

export function useMensajesSolicitud(id: string) {
  const { owner, ready } = useAdmissionContext();
  return useQuery({
    queryKey: [...KEYS.mensajes(id), owner],
    queryFn: () => solicitudService.getMensajes(id),
    enabled: !!id && ready,
    staleTime: 0,
    refetchInterval: 30000,
  });
}

export function useIniciarSolicitud() {
  return useMutation({
    mutationFn: (req: IniciarSolicitudRequest) => solicitudService.iniciar(req),
  });
}

export function useUpdateSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: UpdateSolicitudRequest }) =>
      solicitudService.update(id, data),
    onSuccess: (_, { id }) => qc.invalidateQueries({ queryKey: KEYS.solicitud(id) }),
  });
}

export function useEnviarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => solicitudService.enviar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useUploadDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, file, tipo }: { solicitudId: string; file: File; tipo: string }) =>
      solicitudService.uploadDocumento(solicitudId, file, tipo),
    onSuccess: (_, { solicitudId }) => qc.invalidateQueries({ queryKey: KEYS.solicitud(solicitudId) }),
  });
}

export function useDeleteDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, docId }: { solicitudId: string; docId: string }) =>
      solicitudService.deleteDocumento(solicitudId, docId),
    onSuccess: (_, { solicitudId }) => qc.invalidateQueries({ queryKey: KEYS.solicitud(solicitudId) }),
  });
}

export function useEnviarMensaje() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, contenido, clientMessageId }: { solicitudId: string; contenido: string; clientMessageId?: string }) =>
      solicitudService.enviarMensaje(solicitudId, contenido, clientMessageId),
    onSuccess: (_, { solicitudId }) => qc.invalidateQueries({ queryKey: KEYS.mensajes(solicitudId) }),
  });
}

export function useRevisarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedUpdatedAt }: { id: string; expectedUpdatedAt?: string }) => solicitudService.revisar(id, expectedUpdatedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useObservarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mensaje, expectedUpdatedAt }: { id: string; mensaje: string; expectedUpdatedAt?: string }) =>
      solicitudService.observar(id, mensaje, expectedUpdatedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useAprobarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, expectedUpdatedAt }: { id: string; expectedUpdatedAt?: string }) => solicitudService.aprobar(id, expectedUpdatedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useRechazarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivoRechazo, expectedUpdatedAt }: { id: string; motivoRechazo: string; expectedUpdatedAt?: string }) =>
      solicitudService.rechazar(id, motivoRechazo, expectedUpdatedAt),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useRevisarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ solicitudId, docId, estado, observaciones }: {
      solicitudId: string; docId: string; estado: 'APROBADO' | 'RECHAZADO'; observaciones?: string;
    }) => solicitudService.revisarDocumento(solicitudId, docId, estado, observaciones),
    onSuccess: (_, { solicitudId }) => qc.invalidateQueries({ queryKey: KEYS.solicitud(solicitudId) }),
  });
}
