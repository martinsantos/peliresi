import crypto from 'crypto';

export type InspectionDossierReadiness = {
  ready: boolean;
  completed: number;
  total: number;
  missing: string[];
};

function actorOf(inspection: any) {
  return inspection.generador || inspection.transportista || inspection.operador || null;
}

function hasText(value: unknown): boolean {
  return typeof value === 'string' && value.trim().length > 0;
}

function article44Formalities(act: any) {
  return {
    damages: act.danosEstado === 'NO_OBSERVADOS'
      || (act.danosEstado === 'OBSERVADOS' && hasText(act.danosDetalle)),
    witnesses: act.tercerosTestigosEstado === 'NO_IDENTIFICADOS'
      || (act.tercerosTestigosEstado === 'IDENTIFICADOS' && hasText(act.tercerosTestigosDetalle)),
    operationsBook: Boolean(
      act.libroOperacionesEstado
      && act.libroOperacionesEstado !== 'NO_VERIFICADO'
      && hasText(act.libroOperacionesDetalle),
    ),
    signature: act.firmaIntervinienteEstado === 'FIRMADA'
      || (Boolean(act.firmaIntervinienteEstado)
        && act.firmaIntervinienteEstado !== 'PENDIENTE'
        && hasText(act.firmaIntervinienteDetalle)),
    copyDelivery: Boolean(
      act.copiaActaEstado
      && act.copiaActaEstado !== 'PENDIENTE'
      && hasText(act.copiaActaDetalle),
    ),
    notification: Boolean(
      act.notificacionEstado
      && act.notificacionEstado !== 'PENDIENTE'
      && hasText(act.domicilioLegal)
      && hasText(act.notificacionDetalle),
    ),
  };
}

function canonicalize(value: any): any {
  if (value == null) return null;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'bigint') return value.toString();
  if (Array.isArray(value)) return value.map(canonicalize);
  if (typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .filter(([, entry]) => entry !== undefined)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, canonicalize(entry)]),
    );
  }
  return value;
}

function sortById<T extends { id?: string }>(rows: T[] | null | undefined): T[] {
  return [...(rows || [])].sort((left, right) => String(left.id || '').localeCompare(String(right.id || '')));
}

function actorFingerprint(actor: any) {
  return actor ? {
    id: actor.id,
    razonSocial: actor.razonSocial,
    cuit: actor.cuit,
    domicilio: actor.domicilio,
    telefono: actor.telefono,
    email: actor.email,
    representanteLegalNombre: actor.representanteLegalNombre,
    representanteLegalDNI: actor.representanteLegalDNI,
  } : null;
}

function inspectorFingerprint(inspector: any) {
  return inspector ? {
    id: inspector.id,
    nombre: inspector.nombre,
    apellido: inspector.apellido,
    email: inspector.email,
  } : null;
}

/**
 * Fingerprint of the field act as frozen when it leaves EN_CAMPO. Later
 * technical reports, exchanges and decisions deliberately do not modify it.
 */
export function buildInspectionFieldActFingerprint(inspection: any): string {
  const payload = {
    inspection: {
      id: inspection.id,
      numero: inspection.numero,
      numeroActa: inspection.numeroActa,
      tipoActor: inspection.tipoActor,
      inspectorId: inspection.inspectorId,
      fechaProgramada: inspection.fechaProgramada,
      iniciadaAt: inspection.iniciadaAt,
      cerradaCampoAt: inspection.cerradaCampoAt,
      ubicacion: inspection.ubicacion,
      latitud: inspection.latitud,
      longitud: inspection.longitud,
      observaciones: inspection.observaciones,
      datosActa: inspection.datosActa,
      declaradoSnapshot: inspection.declaradoSnapshot,
      createdAt: inspection.createdAt,
    },
    actor: actorFingerprint(actorOf(inspection)),
    inspector: inspectorFingerprint(inspection.inspector),
    comparisons: sortById(inspection.comparaciones).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      etiqueta: row.etiqueta,
      valorDeclarado: row.valorDeclarado,
      valorObservado: row.valorObservado,
      resultado: row.resultado,
      observacion: row.observacion,
    })),
    checklist: sortById(inspection.items).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      categoria: row.categoria,
      etiqueta: row.etiqueta,
      obligatorio: row.obligatorio,
      resultado: row.resultado,
      observacion: row.observacion,
    })),
    evidence: sortById(inspection.evidencias)
      .filter((item: any) => !item.intercambioId)
      .map((item: any) => ({
        id: item.id,
        clienteId: item.clienteId,
        itemId: item.itemId,
        comparacionId: item.comparacionId,
        eventoId: item.eventoId,
        tipo: item.tipo,
        nombreOriginal: item.nombreOriginal,
        mimeDetectado: item.mimeDetectado,
        bytes: item.bytes,
        sha256: item.sha256,
        descripcion: item.descripcion,
        transcripcion: item.transcripcion,
        capturadaAt: item.capturadaAt,
        createdAt: item.createdAt,
        creadoPorId: item.creadoPorId,
        latitud: item.latitud,
        longitud: item.longitud,
        anuladaAt: item.anuladaAt,
        anuladaPorId: item.anuladaPorId,
        motivoAnulacion: item.motivoAnulacion,
      })),
  };
  return hashCanonicalPayload(payload);
}

export function hashCanonicalPayload(payload: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(canonicalize(payload))).digest('hex');
}

/**
 * Builds the deterministic content fingerprint shown in exported documents.
 * It deliberately covers the complete act/report narrative and evidence ledger;
 * it is an internal integrity control, not a digital signature.
 */
export function buildInspectionDocumentFingerprint(inspection: any): string {
  const actor = actorOf(inspection);
  const payload = {
    inspection: {
      id: inspection.id,
      numero: inspection.numero,
      numeroActa: inspection.numeroActa,
      version: inspection.version,
      tipoActor: inspection.tipoActor,
      estado: inspection.estado,
      inspectorId: inspection.inspectorId,
      fechaProgramada: inspection.fechaProgramada,
      iniciadaAt: inspection.iniciadaAt,
      cerradaCampoAt: inspection.cerradaCampoAt,
      plazoRespuestaAt: inspection.plazoRespuestaAt,
      ubicacion: inspection.ubicacion,
      latitud: inspection.latitud,
      longitud: inspection.longitud,
      observaciones: inspection.observaciones,
      datosActa: inspection.datosActa,
      informeTecnico: inspection.informeTecnico,
      declaradoSnapshot: inspection.declaradoSnapshot,
      createdAt: inspection.createdAt,
      updatedAt: inspection.updatedAt,
    },
    actor: actorFingerprint(actor),
    inspector: inspectorFingerprint(inspection.inspector),
    comparisons: sortById(inspection.comparaciones).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      etiqueta: row.etiqueta,
      valorDeclarado: row.valorDeclarado,
      valorObservado: row.valorObservado,
      resultado: row.resultado,
      observacion: row.observacion,
      evidencias: sortById(row.evidencias).map((evidence: any) => evidence.id),
    })),
    checklist: sortById(inspection.items).map((row: any) => ({
      id: row.id,
      codigo: row.codigo,
      categoria: row.categoria,
      etiqueta: row.etiqueta,
      obligatorio: row.obligatorio,
      resultado: row.resultado,
      observacion: row.observacion,
      evidencias: sortById(row.evidencias).map((evidence: any) => evidence.id),
    })),
    evidence: sortById(inspection.evidencias).map((item: any) => ({
      id: item.id,
      clienteId: item.clienteId,
      itemId: item.itemId,
      comparacionId: item.comparacionId,
      eventoId: item.eventoId,
      intercambioId: item.intercambioId,
      tipo: item.tipo,
      nombreOriginal: item.nombreOriginal,
      mimeDetectado: item.mimeDetectado,
      bytes: item.bytes,
      sha256: item.sha256,
      descripcion: item.descripcion,
      transcripcion: item.transcripcion,
      capturadaAt: item.capturadaAt,
      createdAt: item.createdAt,
      creadoPorId: item.creadoPorId,
      latitud: item.latitud,
      longitud: item.longitud,
      anuladaAt: item.anuladaAt,
      anuladaPorId: item.anuladaPorId,
      motivoAnulacion: item.motivoAnulacion,
    })),
    trace: sortById(inspection.eventos).map((event: any) => ({
      id: event.id,
      tipo: event.tipo,
      titulo: event.titulo,
      detalle: event.detalle,
      usuarioId: event.usuarioId,
      visibleActor: event.visibleActor,
      canal: event.canal,
      estadoEntrega: event.estadoEntrega,
      destinatario: event.destinatario,
      estadoDesde: event.estadoDesde,
      estadoHasta: event.estadoHasta,
      metadata: event.metadata,
      createdAt: event.createdAt,
      adjuntos: sortById(event.adjuntos).map((item: any) => ({ id: item.id, sha256: item.sha256 })),
    })),
    exchanges: [...(inspection.intercambios || [])]
      .sort((left: any, right: any) => Number(left.secuencia || 0) - Number(right.secuencia || 0))
      .map((entry: any) => ({
        id: entry.id,
        secuencia: entry.secuencia,
        respondeAId: entry.respondeAId,
        tipo: entry.tipo,
        parte: entry.parte,
        asunto: entry.asunto,
        cuerpo: entry.cuerpo,
        plazoRespuestaAt: entry.plazoRespuestaAt,
        presentadoFueraDePlazo: entry.presentadoFueraDePlazo,
        canal: entry.canal,
        versionExpediente: entry.versionExpediente,
        contenidoSha256: entry.contenidoSha256,
        hashAnterior: entry.hashAnterior,
        hashCadena: entry.hashCadena,
        autorId: entry.autorId,
        createdAt: entry.createdAt,
        adjuntos: sortById(entry.adjuntos).map((item: any) => ({ id: item.id, sha256: item.sha256 })),
      })),
  };
  return hashCanonicalPayload(payload);
}

export function inspectDossierReadiness(inspection: any): InspectionDossierReadiness {
  const act = inspection.datosActa && typeof inspection.datosActa === 'object' ? inspection.datosActa : {};
  const report = inspection.informeTecnico && typeof inspection.informeTecnico === 'object' ? inspection.informeTecnico : {};
  const formalities = article44Formalities(act);
  const checks: Array<[boolean, string]> = [
    [hasText(inspection.numeroActa), 'Número de acta'],
    [Boolean(inspection.cerradaCampoAt), 'Cierre de campo confirmado'],
    [hasText(inspection.observaciones), 'Observaciones generales'],
    [hasText(act.area), 'Área interviniente'],
    [hasText(act.motivoInspeccion), 'Motivo de inspección'],
    [hasText(act.lugarAfectacion), 'Lugar de afectación'],
    [formalities.damages, 'Daños a personas o bienes'],
    [formalities.witnesses, 'Terceros y testigos'],
    [formalities.operationsBook, 'Libro de Registro de Operaciones'],
    [formalities.signature, 'Firma o constancia de negativa/imposibilidad'],
    [formalities.copyDelivery, 'Entrega de copia del acta'],
    [formalities.notification, 'Notificación y domicilio legal'],
    [hasText(report.expedienteElectronico), 'Expediente electrónico'],
    [hasText(report.objetivo), 'Objetivo técnico'],
    [hasText(report.antecedentes), 'Antecedentes'],
    [hasText(report.evaluacion), 'Evaluación técnica'],
    [hasText(report.conclusion), 'Conclusión técnica'],
    [hasText(report.recomendacion), 'Recomendación técnica'],
    [Array.isArray(inspection.items) && inspection.items.length > 0 && inspection.items.filter((item: any) => item.obligatorio).every((item: any) => item.resultado !== 'PENDIENTE'), 'Checklist obligatorio completo'],
    [Array.isArray(inspection.comparaciones) && inspection.comparaciones.length > 0 && inspection.comparaciones.every((row: any) => row.resultado !== 'PENDIENTE'), 'Comparativa declarado/verificado completa'],
  ];
  const missing = checks.filter(([passed]) => !passed).map(([, label]) => label);
  return { ready: missing.length === 0, completed: checks.length - missing.length, total: checks.length, missing };
}
