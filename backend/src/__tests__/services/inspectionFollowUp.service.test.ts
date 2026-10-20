import { describe, expect, it } from 'vitest';
import { inspectionFollowUp } from '../../services/inspectionFollowUp.service';

const request = (id: string, secuencia: number, due: string | null = null) => ({ id, secuencia, tipo: 'REQUERIMIENTO' as const, parte: 'AUTORIDAD' as const, destinatario: 'INSPECCIONADO' as const, respondeAId: null, plazoRespuestaAt: due ? new Date(due) : null });
const reply = (id: string, parent: string, parte = 'INSPECCIONADO', tipo = 'RESPUESTA') => ({ ...request(id, 5), parte, tipo, respondeAId: parent }) as ReturnType<typeof request>;

describe('PSIP follow-up list projection', () => {
  it('keeps the older unanswered request even when another one received an actor reply', () => {
    const entries = [request('old', 1, '2020-01-01T12:00:00Z'), request('new', 2, '2030-01-01T12:00:00Z'), reply('answer', 'new')];
    expect(inspectionFollowUp('EN_DESCARGO', entries)).toEqual({ paso: 'RESPONDER', pendientes: [{ id: 'old', secuencia: 1, plazoRespuestaAt: new Date('2020-01-01T12:00:00Z') }] });
  });
  it.each(['RESPUESTA', 'DESCARGO', 'SUBSANACION'])('a linked %s removes absence, without accepting compliance', tipo => {
    expect(inspectionFollowUp('EN_DESCARGO', [request('a', 1), reply('b', 'a', 'INSPECCIONADO', tipo)])).toEqual({ paso: 'REVISAR', pendientes: [] });
  });
  it('opening, an unrelated reply or an authority message does not answer the request', () => {
    expect(inspectionFollowUp('REQUIERE_SUBSANACION', [request('a', 1), reply('b', 'a', 'AUTORIDAD'), reply('c', 'other')]).pendientes).toEqual([{ id: 'a', secuencia: 1, plazoRespuestaAt: null }]);
  });
  it('does not invent a request from the Notificada state', () => {
    expect(inspectionFollowUp('NOTIFICADA', [])).toEqual({ paso: 'PUBLICAR', pendientes: [] });
  });
  it.each(['CERRADA_CONFORME', 'DERIVADA_LEGALES', 'EN_TRAMITE_LEGAL', 'DERIVADA_ATM', 'FINALIZADA', 'CANCELADA'] as const)('does not demand an actor response in %s', state => {
    expect(inspectionFollowUp(state, [request('a', 1)])).toEqual({ paso: 'CERRADO', pendientes: [] });
  });
  it('serializes only identifiers, sequence and registered date for pending requests', () => {
    const pending = inspectionFollowUp('NOTIFICADA', [{ ...request('a', 1), cuerpo: 'Private presentation', autorId: 'private-author' } as ReturnType<typeof request>]).pendientes[0];
    expect(Object.keys(pending).sort()).toEqual(['id', 'plazoRespuestaAt', 'secuencia']);
  });
});
