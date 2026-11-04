import { beforeEach, describe, expect, it, vi } from 'vitest';
import { domSubtleCrypto } from '../helpers/domSubtleCrypto';
const db = vi.hoisted(() => ({ read: vi.fn() }));
vi.mock('../../services/indexeddb', () => ({ getOffline: db.read }));
import { legacyExchangeBlocker, readLegacyExchangeCopies, type LegacyExchangeCopy } from '../../services/inspectionLegacyExchange';
import type { InspectionExchangeTimeline } from '../../types/inspection';
import { exchangeFileIdentity } from '../../services/inspectionCommandReceipt';
const draft = { tipo: 'DESCARGO' as const, asunto: 'Respuesta antigua', cuerpo: 'Contenido preservado del dispositivo.', respondeAId: 'pedido', plazoRespuestaAt: '' };
const file = () => new File(['original'], 'constancia.pdf', { type: 'application/pdf', lastModified: 1 });
const record = () => ({ id: 'user:case', userId: 'user', inspectionId: 'case', savedAt: '2026-10-24T12:00:00Z', draft, files: [{ name: 'constancia.pdf', type: 'application/pdf', lastModified: 1, blob: file() }] });
const timeline = () => ({ inspeccion: { id: 'case', estado: 'NOTIFICADA' }, parteActual: 'INSPECCIONADO', intercambios: [{ id: 'pedido', parte: 'AUTORIDAD', tipo: 'REQUERIMIENTO', adjuntos: [] }] } as unknown as InspectionExchangeTimeline);
const copy = (): LegacyExchangeCopy => ({ id: 'checkpoint', raw: JSON.stringify(draft), draft, files: [file()], savedAt: '', unreadableFiles: false });
describe('explicit legacy exchange recovery', () => {
  beforeEach(() => { localStorage.clear(); db.read.mockResolvedValue(record()); Object.defineProperty(crypto, 'subtle', { configurable: true, value: domSubtleCrypto }); });
  it('keeps complete checkpoint and distinct last text, leaving old storage untouched', async () => {
    const raw = JSON.stringify({ ...draft, cuerpo: 'Otro texto todavía no enviado.' });
    localStorage.setItem('sitrep_exchange_draft_user_case', raw);
    const copies = await readLegacyExchangeCopies('user', 'case');
    expect(copies).toHaveLength(2); expect(copies[0].files[0].size).toBe(8); expect(copies[1].files).toHaveLength(0);
    expect(localStorage.getItem('sitrep_exchange_draft_user_case')).toBe(raw);
  });
  it('does not create a text-only duplicate when the journal matches the complete copy', async () => {
    localStorage.setItem('sitrep_exchange_draft_user_case', JSON.stringify({ cuerpo: draft.cuerpo, tipo: draft.tipo, asunto: draft.asunto, plazoRespuestaAt: '', respondeAId: 'pedido' }));
    expect(await readLegacyExchangeCopies('user', 'case')).toHaveLength(1);
  });
  it.each([{ userId: 'other' }, { inspectionId: 'other' }, { id: 'other:case' }, { owner: 'another-context' }])('does not expose mismatched/scoped record %j', async overrides => {
    db.read.mockResolvedValue({ ...record(), ...overrides }); expect(await readLegacyExchangeCopies('user', 'case')).toEqual([]);
  });
  it('preserves malformed journal bytes for download instead of replacing them', async () => {
    db.read.mockResolvedValue(null); localStorage.setItem('sitrep_exchange_draft_user_case', '{broken');
    expect((await readLegacyExchangeCopies('user', 'case'))[0]).toMatchObject({ raw: '{broken', draft: null });
  });
  it('blocks incomplete attachment copies while keeping readable attachments', async () => {
    db.read.mockResolvedValue({ ...record(), files: [...record().files, { name: 'missing.pdf' }] });
    const found = (await readLegacyExchangeCopies('user', 'case'))[0]; expect(found.files).toHaveLength(1);
    expect(await legacyExchangeBlocker(found, timeline(), 'user')).toContain('recuperar completa');
  });
  it('accepts only the matching kind of act and an authorized opposite-party antecedent', async () => {
    expect(await legacyExchangeBlocker(copy(), timeline(), 'user')).toBeNull();
    expect(await legacyExchangeBlocker({ ...copy(), draft: { ...draft, tipo: 'REQUERIMIENTO' } }, timeline(), 'user')).toContain('actividad actual');
    expect(await legacyExchangeBlocker({ ...copy(), draft: { ...draft, respondeAId: 'foreign' } }, timeline(), 'user')).toContain('antecedente autorizado');
    const own = timeline(); own.intercambios[0].parte = 'INSPECCIONADO';
    expect(await legacyExchangeBlocker(copy(), own, 'user')).toContain('antecedente autorizado');
  });
  it('permits download but not a new presentation after closure', async () => {
    const closed = timeline(); closed.inspeccion.estado = 'CERRADA_CONFORME';
    expect(await legacyExchangeBlocker(copy(), closed, 'user')).toContain('ya no admite');
  });
  it('recognizes a previously registered response only with matching author and file bytes', async () => {
    const found = copy(), current = timeline(), identity = (await exchangeFileIdentity(found.files))[0];
    current.intercambios.push({ ...draft, id: 'sent', autorId: 'user', secuencia: 2, parte: 'INSPECCIONADO', plazoRespuestaAt: null, adjuntos: [{ nombreOriginal: identity[0], bytes: identity[1], sha256: identity[2] }] } as any);
    expect(await legacyExchangeBlocker(found, current, 'user')).toContain('actuación #2');
    expect(await legacyExchangeBlocker(found, current, 'other')).toBeNull();
    found.files = [new File(['replaced'], 'constancia.pdf')];
    expect(await legacyExchangeBlocker(found, current, 'user')).toBeNull();
  });
});
