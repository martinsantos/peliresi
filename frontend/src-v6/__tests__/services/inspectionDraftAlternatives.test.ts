import { domSubtleCrypto } from '../helpers/domSubtleCrypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { loadDraftAlternatives, preserveDraftAlternative, retireSentAlternatives } from '../../services/inspectionDraftAlternatives';
import { removeOfflineExchangeDraftRevision } from '../../services/inspectionOfflineExchange';
import { inspectionContextKey } from '../../utils/inspectionWorkspace';
import type { ExchangeCommand } from '../../services/inspectionExchangeCommand';
const records = vi.hoisted(() => new Map<string, any>());
vi.mock('../../services/indexeddb', () => ({
  getOffline: async (_store: string, id: string) => records.get(id),
  updateOffline: async (_store: string, id: string, update: (value: any) => any) => { const next = update(records.get(id) || null); if (next) records.set(id, next); else records.delete(id); return next; },
}));
const scope = { userId: 'actor', inspectionId: 'case', owner: 'G' };
const draft = { tipo: 'DESCARGO' as const, asunto: 'Respuesta', cuerpo: 'Versión alternativa.', respondeAId: 'request', plazoRespuestaAt: '' };
const files = () => [new File(['archivo'], 'constancia.pdf', { type: 'application/pdf' })];
const command = (): ExchangeCommand => ({ id: 'key', scope, savedAt: '', status: 'confirmed', kind: 'presentation',
  input: { ...draft, cuerpo: 'Versión enviada.', version: 3, clienteId: 'send-1', files: files() } });
describe('alternative drafts at send acknowledgement', () => {
  beforeEach(() => { records.clear(); Object.defineProperty(crypto, 'subtle', { configurable: true, value: domSubtleCrypto }); });
  it('retains concurrent distinct versions and deduplicates the same content', async () => {
    await Promise.all([preserveDraftAlternative(scope, draft, files(), command()), preserveDraftAlternative(scope, { ...draft, cuerpo: 'Segunda pestaña.' }, files(), command())]);
    await preserveDraftAlternative(scope, draft, files(), command());
    const restored = await loadDraftAlternatives(scope);
    expect(restored).toHaveLength(2);
    expect(restored.map(item => item.draft.cuerpo)).toContain('Segunda pestaña.');
    expect(restored[0].files[0].name).toBe('constancia.pdf');
    expect(restored[0].files[0].size).toBe(7);
    expect(await loadDraftAlternatives({ ...scope, owner: 'O' })).toEqual([]);
    expect(await loadDraftAlternatives({ ...scope, userId: 'other' })).toEqual([]);
  });
  it('only retires the exact sent content, preserving another file with the same name', async () => {
    const sent = { ...draft, cuerpo: 'Versión enviada.' };
    await preserveDraftAlternative(scope, sent, files());
    await preserveDraftAlternative(scope, sent, [new File(['distinto'], 'constancia.pdf')]);
    await preserveDraftAlternative(scope, draft, files());
    await retireSentAlternatives(scope, command());
    expect(await loadDraftAlternatives(scope)).toHaveLength(2);
  });
  it('never archives the same confirmed content as an unsent alternative', async () => {
    await preserveDraftAlternative(scope, { ...draft, cuerpo: ' Versión enviada. ' }, files(), command());
    expect(await loadDraftAlternatives(scope)).toEqual([]);
  });
  it('does not erase a shared draft changed after the acknowledgement read', async () => {
    const id = inspectionContextKey(scope.userId, scope.owner, scope.inspectionId);
    records.set(id, { id, ...scope, revision: 'newer', draft, files: [] });
    await removeOfflineExchangeDraftRevision(scope.userId, scope.inspectionId, scope.owner, 'older');
    expect(records.has(id)).toBe(true);
    await removeOfflineExchangeDraftRevision(scope.userId, scope.inspectionId, scope.owner, 'newer');
    expect(records.has(id)).toBe(false);
  });
});
