interface Requirement {
  tipo: string;
  requiereVigencia: boolean;
  requiereFrenteDorso: boolean;
}
interface Evidence {
  tipo: string;
  archivoId: string | null;
  estado: string;
  estadoScan: string;
  cara?: string | null;
  vigenteDesde?: Date | null;
  vigenteHasta?: Date | null;
}

/** Shared readiness check for submission, review and approval. */
export function satisfiesDocumentRequirement(requirement: Requirement, documents: Evidence[], now = new Date(), approved = true): boolean {
  const valid = documents.filter(doc => doc.tipo === requirement.tipo && !!doc.archivoId
    && doc.estadoScan === 'LIMPIO' && doc.estado !== 'RECHAZADO'
    && (!approved || doc.estado === 'APROBADO')
    && (!doc.vigenteDesde || doc.vigenteDesde <= now)
    && (!doc.vigenteHasta || doc.vigenteHasta > now)
    && (!requirement.requiereVigencia || !!(doc.vigenteDesde && doc.vigenteHasta && doc.vigenteDesde < doc.vigenteHasta)));
  if (!requirement.requiereFrenteDorso) return valid.length > 0;
  return valid.some(front => front.cara === 'FRENTE' && valid.some(back => back.cara === 'DORSO' && back.archivoId !== front.archivoId));
}
