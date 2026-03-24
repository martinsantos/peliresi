import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { generadorFiscalService, operadorFiscalService, type PagoTEF, type DeclaracionJurada } from '../services/generador-fiscal.service';

const KEYS = {
  pagos: (genId: string) => ['generador-pagos', genId] as const,
  ddjj: (genId: string) => ['generador-ddjj', genId] as const,
  documentos: (genId: string) => ['generador-documentos', genId] as const,
};

// ===== PAGOS TEF =====
export function usePagosTEF(generadorId: string) {
  return useQuery({
    queryKey: KEYS.pagos(generadorId),
    queryFn: () => generadorFiscalService.getPagos(generadorId),
    enabled: !!generadorId,
  });
}

export function useCreatePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, data }: { generadorId: string; data: Partial<PagoTEF> }) =>
      generadorFiscalService.createPago(generadorId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.pagos(vars.generadorId) }),
  });
}

export function useUpdatePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, pagoId, data }: { generadorId: string; pagoId: string; data: Partial<PagoTEF> }) =>
      generadorFiscalService.updatePago(generadorId, pagoId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.pagos(vars.generadorId) }),
  });
}

export function useDeletePago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, pagoId }: { generadorId: string; pagoId: string }) =>
      generadorFiscalService.deletePago(generadorId, pagoId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.pagos(vars.generadorId) }),
  });
}

// ===== DDJJ =====
export function useDDJJ(generadorId: string) {
  return useQuery({
    queryKey: KEYS.ddjj(generadorId),
    queryFn: () => generadorFiscalService.getDDJJ(generadorId),
    enabled: !!generadorId,
  });
}

export function useCreateDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, data }: { generadorId: string; data: Partial<DeclaracionJurada> }) =>
      generadorFiscalService.createDDJJ(generadorId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.ddjj(vars.generadorId) }),
  });
}

export function useUpdateDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, ddjjId, data }: { generadorId: string; ddjjId: string; data: Partial<DeclaracionJurada> }) =>
      generadorFiscalService.updateDDJJ(generadorId, ddjjId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.ddjj(vars.generadorId) }),
  });
}

export function useDeleteDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, ddjjId }: { generadorId: string; ddjjId: string }) =>
      generadorFiscalService.deleteDDJJ(generadorId, ddjjId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.ddjj(vars.generadorId) }),
  });
}

// ===== DOCUMENTOS =====
export function useDocumentos(generadorId: string) {
  return useQuery({
    queryKey: KEYS.documentos(generadorId),
    queryFn: () => generadorFiscalService.getDocumentos(generadorId),
    enabled: !!generadorId,
  });
}

export function useUploadDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ generadorId, file, tipo, anio, observaciones }: {
      generadorId: string; file: File; tipo: string; anio?: number; observaciones?: string;
    }) => generadorFiscalService.uploadDocumento(generadorId, file, tipo, anio, observaciones),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.documentos(vars.generadorId) }),
  });
}

export function useRevisarDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, estado, observaciones, generadorId }: {
      docId: string; estado: 'APROBADO' | 'RECHAZADO'; observaciones?: string; generadorId: string;
    }) => generadorFiscalService.revisarDocumento(docId, estado, observaciones),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.documentos(vars.generadorId) }),
  });
}

export function useDeleteDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ docId, generadorId }: { docId: string; generadorId: string }) =>
      generadorFiscalService.deleteDocumento(docId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: KEYS.documentos(vars.generadorId) }),
  });
}

// ===== OPERADOR FISCAL HOOKS =====

const OP_KEYS = {
  pagos: (opId: string) => ['operador-pagos', opId] as const,
  ddjj: (opId: string) => ['operador-ddjj', opId] as const,
  documentos: (opId: string) => ['operador-documentos', opId] as const,
};

export function useOperadorPagosTEF(operadorId: string) {
  return useQuery({
    queryKey: OP_KEYS.pagos(operadorId),
    queryFn: () => operadorFiscalService.getPagos(operadorId),
    enabled: !!operadorId,
  });
}

export function useCreateOperadorPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, data }: { operadorId: string; data: Partial<PagoTEF> }) =>
      operadorFiscalService.createPago(operadorId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.pagos(vars.operadorId) }),
  });
}

export function useUpdateOperadorPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, pagoId, data }: { operadorId: string; pagoId: string; data: Partial<PagoTEF> }) =>
      operadorFiscalService.updatePago(operadorId, pagoId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.pagos(vars.operadorId) }),
  });
}

export function useDeleteOperadorPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, pagoId }: { operadorId: string; pagoId: string }) =>
      operadorFiscalService.deletePago(operadorId, pagoId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.pagos(vars.operadorId) }),
  });
}

export function useOperadorDDJJ(operadorId: string) {
  return useQuery({
    queryKey: OP_KEYS.ddjj(operadorId),
    queryFn: () => operadorFiscalService.getDDJJ(operadorId),
    enabled: !!operadorId,
  });
}

export function useCreateOperadorDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, data }: { operadorId: string; data: Partial<DeclaracionJurada> }) =>
      operadorFiscalService.createDDJJ(operadorId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.ddjj(vars.operadorId) }),
  });
}

export function useUpdateOperadorDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, ddjjId, data }: { operadorId: string; ddjjId: string; data: Partial<DeclaracionJurada> }) =>
      operadorFiscalService.updateDDJJ(operadorId, ddjjId, data),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.ddjj(vars.operadorId) }),
  });
}

export function useDeleteOperadorDDJJ() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, ddjjId }: { operadorId: string; ddjjId: string }) =>
      operadorFiscalService.deleteDDJJ(operadorId, ddjjId),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.ddjj(vars.operadorId) }),
  });
}

export function useOperadorDocumentos(operadorId: string) {
  return useQuery({
    queryKey: OP_KEYS.documentos(operadorId),
    queryFn: () => operadorFiscalService.getDocumentos(operadorId),
    enabled: !!operadorId,
  });
}

export function useUploadOperadorDocumento() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ operadorId, file, tipo, anio, observaciones }: {
      operadorId: string; file: File; tipo: string; anio?: number; observaciones?: string;
    }) => operadorFiscalService.uploadDocumento(operadorId, file, tipo, anio, observaciones),
    onSuccess: (_d, vars) => qc.invalidateQueries({ queryKey: OP_KEYS.documentos(vars.operadorId) }),
  });
}
