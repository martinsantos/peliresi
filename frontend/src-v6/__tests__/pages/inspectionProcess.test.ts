import { describe, expect, it } from 'vitest';
import { INSPECTION_PHASES, inspectionPhaseOf, inspectionExchangeNextStep, inspectionExchangeDeadline, inspectionFollowUpFromEntries, inspectionFollowUpStatus, inspectionDeadlineStatus, inspectionDeadlineDate, inspectionDeadlineInput, inspectionDeadlineFromInput, inspectionReplyDeadline } from '../../pages/inspecciones/inspectionProcess';
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


describe('PSIP: per-request dates and pending responsibility', () => {
  const now = Date.parse('2026-10-20T15:00:00Z');
  it('prioritizes an older expired request over a newer future request, then undated work', () => {
    const entries = [{ ...requirement('future', 3), plazoRespuestaAt: '2030-01-01T12:00:00Z' }, { ...requirement('expired', 1), plazoRespuestaAt: '2020-01-01T12:00:00Z' }, requirement('undated', 4)];
    const view = inspectionFollowUpStatus(inspectionFollowUpFromEntries('EN_DESCARGO', entries), now);
    expect(view.pending.map(entry => entry.id)).toEqual(['expired', 'future', 'undated']);
    expect(view.overdue).toBe(1); expect(view.responsible).toBe('Inspeccionado');
    expect(inspectionExchangeNextStep('EN_DESCARGO', entries, true, now).pending[0].id).toBe('expired');
  });
  it('stops absence after a linked answer, while authority review remains due', () => {
    const view = inspectionFollowUpStatus(inspectionFollowUpFromEntries('EN_DESCARGO', [{ ...requirement('old', 1), plazoRespuestaAt: '2020-01-01T12:00:00Z' }, response('old')]), now);
    expect(view).toMatchObject({ overdue: 0, responsible: 'Autoridad', label: 'Autoridad: revisar presentación', pending: [] });
  });
  it('does not invent a deadline or let an authority message answer an outstanding request', () => {
    const view = inspectionFollowUpStatus(inspectionFollowUpFromEntries('NOTIFICADA', [requirement('a', 1), response('a', 'AUTORIDAD')]), now);
    expect(view.overdue).toBe(0); expect(view.pending).toHaveLength(1);
    expect(inspectionDeadlineStatus(null, now)).toBe('Sin plazo registrado');
    expect(inspectionDeadlineStatus('invalid', now)).toBe('Sin plazo registrado');
  });
  it('keeps the exact deadline inclusive and expires immediately after it, without a day rollover', () => {
    const due = '2026-10-20T15:00:00Z';
    expect(inspectionDeadlineStatus(due, now)).toBe('Vence hoy');
    expect(inspectionDeadlineStatus(due, now + 1)).toBe('Vencido');
    expect(inspectionDeadlineStatus('2026-10-21T02:59:00Z', now)).toBe('Vence hoy');
    expect(inspectionDeadlineStatus('2026-10-21T03:00:00Z', now)).toBe('En plazo');
  });
  it('shows and submits Mendoza time, independently of the browser time zone', () => {
    expect(inspectionDeadlineDate('2026-10-20T19:30:00Z')).toBe('20/10/26, 16:30');
    expect(inspectionDeadlineInput('2026-10-21T02:59:00Z')).toBe('2026-10-20T23:59');
    expect(inspectionDeadlineFromInput('2026-10-20T16:30')).toBe('2026-10-20T19:30:00.000Z');
    expect(inspectionDeadlineFromInput('2026-10-20T00:00')).toBe('2026-10-20T03:00:00.000Z');
    expect(() => inspectionDeadlineFromInput('2026-02-31T16:30')).toThrow();
  });
  it('resolves the original requirement through the same thread and rejects cyclic ancestry', () => {
    const entries = [{ ...requirement('a', 1), plazoRespuestaAt: '2020-01-01T12:00:00Z' }, { ...response('a'), id: 'b', secuencia: 2 }, { ...response('b', 'AUTORIDAD'), id: 'c', secuencia: 3 }];
    expect(inspectionReplyDeadline(entries, 'c')).toBe('2020-01-01T12:00:00Z');
    expect(inspectionReplyDeadline([{ ...entries[2], respondeAId: 'c' }], 'c')).toBeNull();
    expect(inspectionReplyDeadline([requirement('undated', 1)], 'undated')).toBeNull();
  });
});
