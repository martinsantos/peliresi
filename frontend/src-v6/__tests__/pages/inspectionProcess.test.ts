import { describe, expect, it } from 'vitest';
import { INSPECTION_PHASES, inspectionPhaseOf, inspectionExchangeNextStep, inspectionExchangeDeadline } from '../../pages/inspecciones/inspectionProcess';
import { INSPECTION_STATE_LABELS } from '../../pages/inspecciones/inspectionPresentation';
import type { InspectionExchange } from '../../types/inspection';

const requirement = (id: string, sequence: number) => ({ id, secuencia: sequence, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD' }) as InspectionExchange;
const response = (parent: string, party = 'INSPECCIONADO') => ({ id: 'r-' + parent, respondeAId: parent, secuencia: 4, tipo: 'RESPUESTA', parte: party }) as InspectionExchange;

describe('PSIP: navigation and next actor, without changing the workflow', () => {
  it('retrieves the last deadline from the immutable requirements after closing clears the active field', () => {
    const entries = [{ ...requirement('new', 3), plazoRespuestaAt: '2030-01-02T12:00:00Z' }, { ...requirement('old', 1), plazoRespuestaAt: '2030-01-01T12:00:00Z' }];
    expect(inspectionExchangeDeadline('CERRADA_CONFORME', null, entries)).toBe('2030-01-02T12:00:00Z');
    expect(entries[0].id).toBe('new');
  });
  it('does not resurrect a historical deadline as an active deadline in an open case', () => {
    expect(inspectionExchangeDeadline('EN_DESCARGO', null, [{ ...requirement('old', 1), plazoRespuestaAt: '2020-01-01T12:00:00Z' }])).toBeNull();
  });
  it('places every existing state in exactly one phase', () => {
    const states = Object.values(INSPECTION_PHASES).flatMap((phase) => phase.states);
    expect(states.sort()).toEqual(Object.keys(INSPECTION_STATE_LABELS).sort());
    expect(new Set(states).size).toBe(states.length);
    expect(inspectionPhaseOf('CERRADA_CONFORME')).toBe('CERRADAS');
  });
  it('does not invent observations from the Notificada state', () => {
    expect(inspectionExchangeNextStep('NOTIFICADA', [], true).title).toBe('La autoridad debe publicar las observaciones');
    expect(inspectionExchangeNextStep('NOTIFICADA', [], false).title).toBe('Falta publicar el requerimiento');
  });
  it('counts pending requirements individually and offers the newest one', () => {
    const result = inspectionExchangeNextStep('REQUIERE_SUBSANACION', [requirement('a', 1), requirement('b', 2), requirement('c', 3), response('a'), response('b', 'AUTORIDAD')], true);
    expect(result.pending.map((entry) => entry.id)).toEqual(['c', 'b']);
    expect(result.title).toBe('Tenés requerimientos por responder');
  });
  it('points to authority review after a linked response, without automatic acceptance', () => {
    const entries = [requirement('a', 1), response('a')];
    expect(inspectionExchangeNextStep('EN_DESCARGO', entries, false).title).toBe('Revisar las presentaciones recibidas');
    expect(inspectionExchangeNextStep('EN_DESCARGO', entries, true).detail).toContain('no implica conformidad');
  });
  it.each(['CERRADA_CONFORME', 'FINALIZADA', 'CANCELADA', 'DERIVADA_LEGALES', 'EN_TRAMITE_LEGAL', 'DERIVADA_ATM'] as const)('does not turn %s into unanswered work', (state) => {
    const result = inspectionExchangeNextStep(state, [requirement('a', 1)], true);
    expect(result.pending).toEqual([]);
    expect(result.detail).toContain('No se admiten nuevas presentaciones');
  });
});
