import { describe, expect, it } from 'vitest';
import { EstadoInspeccion, ResultadoComparacionInspeccion, ResultadoItemInspeccion, TipoActorInspeccion } from '@prisma/client';
import {
  CHECKLIST_BY_ACTOR,
  canTransitionInspection,
  hasSingleEvidenceTarget,
  isChecklistReadyForReview,
  isComparisonReadyForReview,
} from '../../controllers/inspeccion.controller';

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
});
