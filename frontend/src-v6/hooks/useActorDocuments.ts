import { useQuery, type QueryClient } from '@tanstack/react-query';
import { useAuth, type User } from '../contexts/AuthContext';
import { companyCacheScope } from '../services/companyContext';
import { generadorFiscalService, operadorFiscalService, transportistaDocumentoService } from '../services/generador-fiscal.service';

export type DocumentActorType = 'GENERADOR' | 'OPERADOR' | 'TRANSPORTISTA';

/** Keep the actor prefix so every document mutation invalidates all authorized views. */
export const actorDocumentsKey = (type: DocumentActorType, actorId: string) =>
  [`${type.toLowerCase()}-documentos`, actorId] as const;

export function actorDocumentScope(user: User | null) {
  return [
    user?.id ?? null, user?.rol ?? null, user?.actorId ?? null,
    companyCacheScope(user?.empresaContexto ?? null),
    user?.empresaContexto?.autorizacionId ?? null,
    user?.empresaContexto?.revision ?? null,
    !!user?.esInspector, !!user?.training,
  ] as const;
}

/** Certificates and attachments are two views of the same authenticated response. */
export function useActorDocuments(type: DocumentActorType, actorId: string) {
  const { currentUser } = useAuth();
  return useQuery({
    queryKey: [...actorDocumentsKey(type, actorId), ...actorDocumentScope(currentUser)],
    enabled: Boolean(currentUser?.id && actorId),
    retry: false,
    queryFn: () => {
      if (type === 'GENERADOR') return generadorFiscalService.getDocumentos(actorId);
      if (type === 'OPERADOR') return operadorFiscalService.getDocumentos(actorId);
      return transportistaDocumentoService.getDocumentos(actorId);
    },
  });
}

export async function refreshActorDocuments(client: QueryClient, type: DocumentActorType, actorId: string) {
  await Promise.all([
    client.invalidateQueries({ queryKey: actorDocumentsKey(type, actorId) }),
    client.invalidateQueries({ queryKey: ['historial-actor', type, actorId] }),
  ]);
}
