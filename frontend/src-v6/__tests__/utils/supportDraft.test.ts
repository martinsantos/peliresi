import { beforeEach, describe, expect, it, vi } from 'vitest';
import { readSupportDraft, writeSupportDraft, clearSupportDraft } from '../../utils/supportDraft';

const draft = { asunto: 'No puedo abrir el manifiesto', descripcion: 'El detalle aparece en blanco después de ingresar.', categoria: 'MANIFIESTOS' as const };
describe('owner-scoped support draft', () => {
  beforeEach(() => { localStorage.clear(); vi.restoreAllMocks(); });
  it('restores only the authenticated owner draft', () => {
    expect(writeSupportDraft('actor-a', draft)).toBe(true);
    expect(readSupportDraft('actor-a')).toEqual(draft);
    expect(readSupportDraft('actor-b')).toBeNull();
    clearSupportDraft('actor-b'); expect(readSupportDraft('actor-a')).toEqual(draft);
    clearSupportDraft('actor-a'); expect(readSupportDraft('actor-a')).toBeNull();
  });
  it('preserves the exact unresolved request and key after reload', () => {
    const pending = { ...draft, pendiente: { key: 'same-request-123', input: { ...draft, contexto: { ruta: '/manifiestos/one', ancho: 360, alto: 800 } }, files: [{ nombre: 'evidencia.png', sha256: 'a'.repeat(64) }] } };
    writeSupportDraft('actor-a', pending);
    expect(readSupportDraft('actor-a')).toEqual(pending);
  });
  it('reports a failed persistence rather than calling it saved', () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => { throw new Error('quota'); });
    expect(writeSupportDraft('actor-a', draft)).toBe(false);
  });
  it('does not restore malformed, excessive or anonymous drafts', () => {
    expect(writeSupportDraft('', draft)).toBe(false); expect(readSupportDraft('')).toBeNull();
    localStorage.setItem('sitrep-soporte:v1:actor-a', 'not-json'); expect(readSupportDraft('actor-a')).toBeNull();
    localStorage.setItem('sitrep-soporte:v1:actor-a', JSON.stringify({ ...draft, descripcion: 'x'.repeat(8001) })); expect(readSupportDraft('actor-a')).toBeNull();
    localStorage.setItem('sitrep-soporte:v1:actor-a', JSON.stringify({ ...draft, categoria: 'invented' })); expect(readSupportDraft('actor-a')).toBeNull();
  });
});
