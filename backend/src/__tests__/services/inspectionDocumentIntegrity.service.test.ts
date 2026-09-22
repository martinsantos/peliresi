import { describe, expect, it } from 'vitest';
import {
  buildInspectionDocumentFingerprint,
  buildInspectionFieldActFingerprint,
  inspectDossierReadiness,
} from '../../services/inspectionDocumentIntegrity.service';

function completeInspection() {
  return {
    id: 'inspection-1',
    numero: 'I-2026-000001',
    numeroActa: 'ACTA-001',
    version: 7,
    tipoActor: 'GENERADOR',
    estado: 'EN_REVISION',
    inspectorId: 'inspector-1',
    fechaProgramada: new Date('2026-09-22T12:00:00Z'),
    iniciadaAt: new Date('2026-09-22T12:05:00Z'),
    cerradaCampoAt: new Date('2026-09-22T13:00:00Z'),
    plazoRespuestaAt: null,
    ubicacion: 'Planta sintética',
    latitud: -32.89,
    longitud: -68.84,
    observaciones: 'Constatación documentada en campo.',
    datosActa: {
      area: 'Fiscalización Ambiental',
      motivoInspeccion: 'Control programado',
      lugarAfectacion: 'Depósito transitorio',
      danosEstado: 'NO_OBSERVADOS',
      tercerosTestigosEstado: 'NO_IDENTIFICADOS',
      libroOperacionesEstado: 'EXHIBIDO',
      libroOperacionesDetalle: 'Libro RP-2026, período enero a septiembre, fojas 1 a 48.',
      firmaIntervinienteEstado: 'FIRMADA',
      copiaActaEstado: 'ENTREGADA',
      copiaActaDetalle: 'Copia entregada a la responsable de planta el 22/09/2026 a las 13:00.',
      domicilioLegal: 'Calle Demo 100, Mendoza',
      notificacionEstado: 'COMUNICADA_EN_ACTA',
      notificacionDetalle: 'Se informó el contenido del acta, el plazo de descargo y el derecho a ofrecer prueba.',
    },
    informeTecnico: {
      expedienteElectronico: 'EX-DEMO-001',
      objetivo: 'Verificar condiciones declaradas.',
      antecedentes: 'Antecedentes documentales de prueba.',
      evaluacion: 'Evaluación técnica fundada.',
      conclusion: 'Se constató una diferencia subsanable.',
      recomendacion: 'Requerir documentación respaldatoria.',
    },
    declaradoSnapshot: { domicilio: 'Calle Demo 100' },
    createdAt: new Date('2026-09-22T11:00:00Z'),
    updatedAt: new Date('2026-09-22T14:00:00Z'),
    inspector: { id: 'inspector-1', nombre: 'Inspectora', apellido: 'QA', email: 'inspector@example.invalid' },
    generador: { id: 'actor-1', razonSocial: 'Actor sintético', cuit: '30-00000000-0', domicilio: 'Calle Demo 100' },
    comparaciones: [{ id: 'comparison-1', codigo: 'DOM-01', etiqueta: 'Domicilio', valorDeclarado: 'Calle Demo 100', valorObservado: 'Calle Demo 100', resultado: 'COINCIDE', observacion: null, evidencias: [] }],
    items: [{ id: 'item-1', codigo: 'HAB-01', categoria: 'Habilitación', etiqueta: 'Habilitación vigente', obligatorio: true, resultado: 'CUMPLE', observacion: null, evidencias: [] }],
    evidencias: [{ id: 'evidence-1', tipo: 'FOTO', nombreOriginal: 'foto.png', sha256: 'a'.repeat(64), bytes: 100, createdAt: new Date('2026-09-22T12:30:00Z') }],
    eventos: [{ id: 'event-1', tipo: 'CAMBIO_ESTADO', titulo: 'En revisión', detalle: null, usuarioId: 'inspector-1', createdAt: new Date('2026-09-22T13:00:00Z'), adjuntos: [] }],
  };
}

describe('inspection document integrity', () => {
  it('is deterministic even when related rows arrive in a different order', () => {
    const first = completeInspection();
    const second = completeInspection();
    const extra = { ...first.evidencias[0], id: 'evidence-0', sha256: 'b'.repeat(64) };
    first.evidencias = [first.evidencias[0], extra];
    second.evidencias = [extra, second.evidencias[0]];

    expect(buildInspectionDocumentFingerprint(first)).toBe(buildInspectionDocumentFingerprint(second));
  });

  it.each([
    ['technical report narrative', (inspection: any) => { inspection.informeTecnico.conclusion = 'Conclusión materialmente distinta.'; }],
    ['field act data', (inspection: any) => { inspection.datosActa.motivoInspeccion = 'Denuncia'; }],
    ['checklist result', (inspection: any) => { inspection.items[0].resultado = 'NO_CUMPLE'; }],
    ['evidence digest', (inspection: any) => { inspection.evidencias[0].sha256 = 'c'.repeat(64); }],
    ['trace detail', (inspection: any) => { inspection.eventos[0].detalle = 'Cambio documentado'; }],
  ])('changes when %s changes', (_label, mutate) => {
    const baseline = completeInspection();
    const changed = completeInspection();
    mutate(changed);
    expect(buildInspectionDocumentFingerprint(changed)).not.toBe(buildInspectionDocumentFingerprint(baseline));
  });

  it('keeps the frozen field-act fingerprint stable when the later report or exchange changes', () => {
    const baseline = completeInspection() as any;
    const later = completeInspection() as any;
    later.informeTecnico.conclusion = 'Nueva conclusión posterior a la constatación.';
    later.intercambios = [{
      id: 'exchange-1', secuencia: 1, tipo: 'RESPUESTA', parte: 'INSPECCIONADO',
      asunto: 'Descargo', cuerpo: 'Presentación posterior', hashCadena: 'd'.repeat(64), adjuntos: [],
    }];
    later.evidencias.push({
      id: 'exchange-file', tipo: 'DOCUMENTO', nombreOriginal: 'descargo.pdf', sha256: 'e'.repeat(64),
      intercambioId: 'exchange-1', createdAt: new Date('2026-09-23T12:00:00Z'),
    });

    expect(buildInspectionFieldActFingerprint(later)).toBe(buildInspectionFieldActFingerprint(baseline));
    expect(buildInspectionDocumentFingerprint(later)).not.toBe(buildInspectionDocumentFingerprint(baseline));
  });

  it('changes the field-act fingerprint when a field finding changes', () => {
    const baseline = completeInspection();
    const changed = completeInspection();
    changed.items[0].observacion = 'Hallazgo material documentado en campo.';
    expect(buildInspectionFieldActFingerprint(changed)).not.toBe(buildInspectionFieldActFingerprint(baseline));
  });

  it('reports a complete dossier only when every critical control is satisfied', () => {
    const readiness = inspectDossierReadiness(completeInspection());
    expect(readiness).toEqual({ ready: true, completed: readiness.total, total: 20, missing: [] });
  });

  it('requires explicit article 44 formalities and contextual detail where the outcome demands it', () => {
    const inspection = completeInspection();
    inspection.datosActa.danosEstado = 'OBSERVADOS';
    inspection.datosActa.danosDetalle = '';
    inspection.datosActa.tercerosTestigosEstado = 'IDENTIFICADOS';
    inspection.datosActa.tercerosTestigosDetalle = '';
    inspection.datosActa.firmaIntervinienteEstado = 'NEGATIVA';
    inspection.datosActa.firmaIntervinienteDetalle = '';
    inspection.datosActa.notificacionEstado = 'PENDIENTE';

    const readiness = inspectDossierReadiness(inspection);
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(expect.arrayContaining([
      'Daños a personas o bienes',
      'Terceros y testigos',
      'Firma o constancia de negativa/imposibilidad',
      'Notificación y domicilio legal',
    ]));
  });

  it('returns explicit missing controls instead of treating an empty dossier as final', () => {
    const inspection = completeInspection();
    inspection.numeroActa = '';
    inspection.informeTecnico.conclusion = '';
    inspection.items[0].resultado = 'PENDIENTE';
    inspection.comparaciones[0].resultado = 'PENDIENTE';

    const readiness = inspectDossierReadiness(inspection);
    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(expect.arrayContaining([
      'Número de acta',
      'Conclusión técnica',
      'Checklist obligatorio completo',
      'Comparativa declarado/verificado completa',
    ]));
  });

  it('does not accept an expediente with empty control collections', () => {
    const inspection = completeInspection();
    inspection.items = [];
    inspection.comparaciones = [];
    const readiness = inspectDossierReadiness(inspection);

    expect(readiness.ready).toBe(false);
    expect(readiness.missing).toEqual(expect.arrayContaining([
      'Checklist obligatorio completo',
      'Comparativa declarado/verificado completa',
    ]));
  });
});
