import { describe, expect, it } from 'vitest';
import { EstadoInspeccion, ResultadoComparacionInspeccion, ResultadoItemInspeccion, TipoActorInspeccion } from '@prisma/client';
import {
  CHECKLIST_BY_ACTOR,
  actaDataSchema,
  canAccessInspection,
  canTransitionInspection,
  hasSingleEvidenceTarget,
  inspectionScopeForUser,
  isChecklistReadyForReview,
  isComparisonReadyForReview,
} from '../../controllers/inspeccion.controller';
import {
  hashCanonicalPayload,
  inspectDossierReadiness,
} from '../../services/inspectionDocumentIntegrity.service';

describe('inspection workflow', () => {
  it.each(Object.values(TipoActorInspeccion))('defines a complete versioned checklist for %s', (actorType) => {
    const checklist = CHECKLIST_BY_ACTOR[actorType];
    expect(checklist.length).toBeGreaterThanOrEqual(10);
    expect(new Set(checklist.map((item) => item.codigo)).size).toBe(checklist.length);
    expect(checklist.every((item) => item.categoria && item.etiqueta && item.orden > 0)).toBe(true);
  });

  it('allows the assigned inspector to work only through field submission', () => {
    expect(canTransitionInspection(EstadoInspeccion.BORRADOR, EstadoInspeccion.EN_CAMPO, false)).toBe(true);
    expect(canTransitionInspection(EstadoInspeccion.EN_CAMPO, EstadoInspeccion.EN_REVISION, false)).toBe(true);
    expect(canTransitionInspection(EstadoInspeccion.EN_REVISION, EstadoInspeccion.NOTIFICADA, false)).toBe(false);
    expect(canTransitionInspection(EstadoInspeccion.NOTIFICADA, EstadoInspeccion.DERIVADA_LEGALES, false)).toBe(false);
  });

  it('lets the corresponding administrator review and advance the legal lifecycle', () => {
    expect(canTransitionInspection(EstadoInspeccion.EN_REVISION, EstadoInspeccion.NOTIFICADA, true)).toBe(true);
    expect(canTransitionInspection(EstadoInspeccion.NOTIFICADA, EstadoInspeccion.DERIVADA_LEGALES, true)).toBe(true);
    expect(canTransitionInspection(EstadoInspeccion.EN_TRAMITE_LEGAL, EstadoInspeccion.DERIVADA_ATM, true)).toBe(true);
    expect(canTransitionInspection(EstadoInspeccion.DERIVADA_ATM, EstadoInspeccion.FINALIZADA, true)).toBe(true);
  });

  it('blocks review while a required checklist item remains pending', () => {
    const items = [
      { obligatorio: true, resultado: ResultadoItemInspeccion.CUMPLE },
      { obligatorio: true, resultado: ResultadoItemInspeccion.PENDIENTE },
      { obligatorio: false, resultado: ResultadoItemInspeccion.PENDIENTE },
    ];
    expect(isChecklistReadyForReview(items)).toBe(false);
    expect(isChecklistReadyForReview(items.map((item) => ({ ...item, resultado: ResultadoItemInspeccion.CUMPLE })))).toBe(true);
  });

  it('blocks review until every declared value has a field outcome', () => {
    expect(isComparisonReadyForReview([])).toBe(false);
    expect(isComparisonReadyForReview([
      { resultado: ResultadoComparacionInspeccion.COINCIDE },
      { resultado: ResultadoComparacionInspeccion.PENDIENTE },
    ])).toBe(false);
    expect(isComparisonReadyForReview([
      { resultado: ResultadoComparacionInspeccion.COINCIDE },
      { resultado: ResultadoComparacionInspeccion.NO_VERIFICADO },
      { resultado: ResultadoComparacionInspeccion.DIFIERE },
    ])).toBe(true);
  });

  it('links each evidence to at most one checklist, comparison or timeline target', () => {
    expect(hasSingleEvidenceTarget(['item-1', null, undefined])).toBe(true);
    expect(hasSingleEvidenceTarget([null, 'comparison-1', undefined])).toBe(true);
    expect(hasSingleEvidenceTarget([undefined, null, 'event-1'])).toBe(true);
    expect(hasSingleEvidenceTarget(['item-1', 'comparison-1', null])).toBe(false);
    expect(hasSingleEvidenceTarget(['item-1', null, 'event-1'])).toBe(false);
  });

  it('scopes sector administrators and assigned inspectors without privilege crossover', () => {
    const generatorCase = { inspectorId: 'inspector-1', tipoActor: TipoActorInspeccion.GENERADOR };
    expect(canAccessInspection({ id: 'root', rol: 'ADMIN' }, generatorCase)).toBe(true);
    expect(canAccessInspection({ id: 'sector-g', rol: 'ADMIN_GENERADOR' }, generatorCase)).toBe(true);
    expect(canAccessInspection({ id: 'sector-t', rol: 'ADMIN_TRANSPORTISTA' }, generatorCase)).toBe(false);
    expect(canAccessInspection({ id: 'inspector-1', rol: 'GENERADOR', esInspector: true }, generatorCase)).toBe(true);
    expect(canAccessInspection({ id: 'other', rol: 'GENERADOR', esInspector: true }, generatorCase)).toBe(false);
    // A sector role never gains cross-sector access merely by being assigned.
    expect(canAccessInspection({ id: 'inspector-1', rol: 'ADMIN_TRANSPORTISTA', esInspector: true }, generatorCase)).toBe(false);

    expect(inspectionScopeForUser({ id: 'sector-g', rol: 'ADMIN_GENERADOR' })).toEqual({ tipoActor: 'GENERADOR' });
    expect(inspectionScopeForUser({ id: 'inspector-1', rol: 'GENERADOR', esInspector: true })).toEqual({ inspectorId: 'inspector-1' });
    expect(inspectionScopeForUser({ id: 'root', rol: 'ADMIN' })).toEqual({});
  });

  it('requires a structurally complete dossier before notification', () => {
    const ready = {
      numeroActa: 'ACTA-1',
      cerradaCampoAt: new Date(),
      observaciones: 'Constatación documentada.',
      datosActa: {
        area: 'DGFA',
        motivoInspeccion: 'Control programado',
        lugarAfectacion: 'Planta',
        danosEstado: 'NO_OBSERVADOS',
        tercerosTestigosEstado: 'NO_IDENTIFICADOS',
        libroOperacionesEstado: 'EXHIBIDO',
        libroOperacionesDetalle: 'Libro identificado y verificado en campo.',
        firmaIntervinienteEstado: 'FIRMADA',
        copiaActaEstado: 'ENTREGADA',
        copiaActaDetalle: 'Copia entregada a la persona responsable.',
        domicilioLegal: 'Domicilio legal constituido',
        notificacionEstado: 'COMUNICADA_EN_ACTA',
        notificacionDetalle: 'Contenido, plazo y derechos informados en el acta.',
      },
      informeTecnico: {
        expedienteElectronico: 'EX-2026-1',
        objetivo: 'Verificar condiciones.',
        antecedentes: 'Antecedentes revisados.',
        evaluacion: 'Se evaluó la evidencia.',
        conclusion: 'Conclusión técnica.',
        recomendacion: 'Remitir para revisión.',
      },
      items: [{ obligatorio: true, resultado: ResultadoItemInspeccion.CUMPLE }],
      comparaciones: [{ resultado: ResultadoComparacionInspeccion.COINCIDE }],
    };
    expect(inspectDossierReadiness(ready)).toMatchObject({ ready: true, missing: [] });
    expect(inspectDossierReadiness({ ...ready, numeroActa: null, informeTecnico: {} }).missing).toEqual(expect.arrayContaining([
      'Número de acta', 'Objetivo técnico', 'Evaluación técnica', 'Conclusión técnica', 'Recomendación técnica',
    ]));
  });

  it('accepts the structured article 44 act fields and rejects invented values', () => {
    const parsed = actaDataSchema.parse({
      danosEstado: 'OBSERVADOS',
      danosDetalle: 'Daño material constatado y documentado.',
      tercerosTestigosEstado: 'IDENTIFICADOS',
      tercerosTestigosDetalle: 'Persona identificada en el acta.',
      libroOperacionesEstado: 'SECUESTRADO',
      libroOperacionesDetalle: 'Medida dispuesta por autoridad competente.',
      firmaIntervinienteEstado: 'NEGATIVA',
      firmaIntervinienteDetalle: 'Negativa asentada por el inspector.',
      copiaActaEstado: 'NEGATIVA_RECEPCION',
      copiaActaDetalle: 'Negativa a recibir la copia asentada en campo.',
      domicilioLegal: 'Calle Legal 123, Mendoza',
      notificacionEstado: 'CONSTANCIA_FORMAL',
      notificacionDetalle: 'Constancia incorporada al expediente.',
    });
    expect(parsed.libroOperacionesEstado).toBe('SECUESTRADO');
    expect(() => actaDataSchema.parse({ firmaIntervinienteEstado: 'FIRMA_DIGITAL' })).toThrow();
    expect(() => actaDataSchema.parse({ campoNoRegulado: true })).toThrow();
  });

  it('hashes canonical inspection payloads independently of object key order', () => {
    expect(hashCanonicalPayload({ b: 2, a: { d: 4, c: 3 } })).toBe(
      hashCanonicalPayload({ a: { c: 3, d: 4 }, b: 2 }),
    );
    expect(hashCanonicalPayload({ text: 'original' })).not.toBe(hashCanonicalPayload({ text: 'alterado' }));
  });
});
