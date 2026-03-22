import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { solicitudService } from '../services/solicitud.service';
import type { SolicitudFilters, IniciarSolicitudRequest, UpdateSolicitudRequest } from '../types/api';

const KEYS = {
  solicitudes: (filters?: SolicitudFilters) => ['solicitudes', filters] as const,
  solicitud: (id: string) => ['solicitudes', id] as const,
  misSolicitudes: ['solicitudes', 'mis'] as const,
  mensajes: (id: string) => ['solicitudes', id, 'mensajes'] as const,
};

export function useSolicitudes(filters?: SolicitudFilters) {
  return useQuery({
    queryKey: KEYS.solicitudes(filters),
    queryFn: () => solicitudService.list(filters),
  });
}

export function useSolicitud(id: string) {
  return useQuery({
    queryKey: KEYS.solicitud(id),
    queryFn: () => solicitudService.getById(id),
    enabled: !!id,
  });
}

export function useMisSolicitudes() {
  return useQuery({
    queryKey: KEYS.misSolicitudes,
    queryFn: () => solicitudService.misSolicitudes(),
  });
}

export function useMensajesSolicitud(id: string) {
  return useQuery({
    queryKey: KEYS.mensajes(id),
    queryFn: () => solicitudService.getMensajes(id),
    enabled: !!id,
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
    mutationFn: ({ solicitudId, contenido }: { solicitudId: string; contenido: string }) =>
      solicitudService.enviarMensaje(solicitudId, contenido),
    onSuccess: (_, { solicitudId }) => qc.invalidateQueries({ queryKey: KEYS.mensajes(solicitudId) }),
  });
}

export function useRevisarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => solicitudService.revisar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useObservarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, mensaje }: { id: string; mensaje: string }) =>
      solicitudService.observar(id, mensaje),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useAprobarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => solicitudService.aprobar(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ['solicitudes'] }),
  });
}

export function useRechazarSolicitud() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, motivoRechazo }: { id: string; motivoRechazo: string }) =>
      solicitudService.rechazar(id, motivoRechazo),
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
