import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({ post: vi.fn() }));
vi.mock('../../services/api', () => ({ default: { post: mocks.post } }));

import { inspeccionService } from '../../services/inspeccion.service';

describe('inspeccionService evidence upload', () => {
  beforeEach(() => {
    mocks.post.mockReset();
    mocks.post.mockResolvedValue({ data: { data: { id: 'evidence-1' } } });
  });

  it('sends the checklist item and comment context with the image', async () => {
    const file = new File(['image-bytes'], 'hallazgo.png', { type: 'image/png' });

    await inspeccionService.uploadEvidence('inspection-1', file, {
      itemId: 'item-1',
      descripcion: 'Falta la señalización reglamentaria',
    });

    expect(mocks.post).toHaveBeenCalledTimes(1);
    const [url, form, config] = mocks.post.mock.calls[0] as [string, FormData, unknown];
    expect(url).toBe('/inspecciones/inspection-1/evidencias');
    expect(form.get('file')).toBe(file);
    expect(form.get('itemId')).toBe('item-1');
    expect(form.get('descripcion')).toBe('Falta la señalización reglamentaria');
    expect(config).toBeUndefined();
  });

  it('submits one auditable exchange with all attachments and no manual multipart header', async () => {
    const photo = new File(['image-bytes'], 'hallazgo.png', { type: 'image/png' });
    const document = new File(['%PDF'], 'descargo.pdf', { type: 'application/pdf' });

    await inspeccionService.presentExchange('inspection-1', {
      version: 9,
      clienteId: 'response_12345678',
      tipo: 'DESCARGO',
      asunto: 'Descargo y documentación respaldatoria',
      cuerpo: 'Se acompaña la constancia requerida y evidencia fotográfica.',
      respondeAId: 'exchange-authority-1',
      files: [photo, document],
    });

    const [url, form, config] = mocks.post.mock.calls[0] as [string, FormData, unknown];
    expect(url).toBe('/inspecciones/inspection-1/intercambios');
    expect(form.get('version')).toBe('9');
    expect(form.get('clienteId')).toBe('response_12345678');
    expect(form.get('tipo')).toBe('DESCARGO');
    expect(form.get('respondeAId')).toBe('exchange-authority-1');
    expect(form.getAll('files')).toEqual([photo, document]);
    expect(config).toBeUndefined();
  });

  it('submits the final decision and its supporting document as one multipart act', async () => {
    const opinion = new File(['%PDF'], 'dictamen-tecnico.pdf', { type: 'application/pdf' });
    await inspeccionService.decideExchange('inspection-1', {
      version: 12,
      clienteId: 'decision_12345678',
      decision: 'DERIVADA_LEGALES',
      fundamento: 'Persisten incumplimientos documentados que requieren dictamen jurídico.',
      expedienteLegal: 'EX-2026-000099',
      files: [opinion],
    });

    const [url, form, config] = mocks.post.mock.calls[0] as [string, FormData, unknown];
    expect(url).toBe('/inspecciones/inspection-1/intercambios/decision');
    expect(form.get('version')).toBe('12');
    expect(form.get('decision')).toBe('DERIVADA_LEGALES');
    expect(form.get('expedienteLegal')).toBe('EX-2026-000099');
    expect(form.getAll('files')).toEqual([opinion]);
    expect(config).toBeUndefined();
  });
});
