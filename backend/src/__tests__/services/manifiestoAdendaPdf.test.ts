import { mkdtempSync, writeFileSync, rmSync, mkdirSync } from 'fs';
import os from 'os';
import path from 'path';
import { execFileSync } from 'child_process';
import { afterAll, expect, it } from 'vitest';
import { addendumDocument } from '../../domain/manifiestoAdendaDocument';
import { renderAddendumPdf } from '../../services/manifiestoAdendaPdf.service';

const temporary = mkdtempSync(path.join(os.tmpdir(), 'sitrep-adenda-pdf-'));
afterAll(() => rmSync(temporary, { recursive: true, force: true }));
const record = {
  id: '00000000-0000-4000-8000-000000000001', manifiestoId: 'qa-manifest', creadoPorId: 'qa-carrier',
  impersonadoPorId: null, createdAt: new Date('2026-10-15T10:00:00Z'),
  motivo: 'Diferencia constatada en recepción', rectificaId: null, version: 1,
  declaracion: { numero: 'QA-ANEXO-001', residuos: [{ corriente: 'Y1', cantidad: 10, unidad: 'kg' }] },
  residuos: [{ corriente: 'Y2', cantidad: 12, unidad: 'kg' }],
  revisiones: [{ id: 'qa-review', autorId: 'qa-reviewer', fecha: '2026-10-15T11:00:00Z', version: 0, decision: 'RECHAZADA', nota: 'Evidencia insuficiente; conservar hechos.' }],
};
async function render(value: typeof record, version: number, name: string) {
  const pdf = await renderAddendumPdf(addendumDocument(value, version));
  const file = path.join(temporary, name + '.pdf'); writeFileSync(file, pdf);
  const raw = execFileSync('pdftotext', ['-raw', file, '-'], { encoding: 'utf8' });
  return { pdf, file, text: raw.replace(/\s+/g, ' '), pages: raw.split('\f').filter(p => p.trim()) };
}
it('exports facts separately, with rejected conformity visible and no invented certification', async () => {
  const result = await render(record, 1, 'current');
  expect(result.text).toContain('CONFORMIDAD RECHAZADA');
  expect(result.text).toContain('Y1 | 10 kg');
  expect(result.text).toContain('Y2 | 12 kg');
  expect(result.text).toContain('No reemplaza el manifiesto ni el certificado original.');
  expect(result.text).toContain('No es una firma digital.');
  expect(result.text).toContain('qa-reviewer');
  expect(result.text).toContain(addendumDocument(record, 1).huella);
});
it('reproduces historical PDF bytes after later reviews without leaking the later decision', async () => {
  const before = await render({ ...record, version: 0, revisiones: [] }, 0, 'before');
  const after = await render(record, 0, 'after');
  expect(after.pdf).toEqual(before.pdf);
  expect(after.text).toContain('PENDIENTE DE REVISIÓN');
  expect(after.text).not.toContain('Evidencia insuficiente');
  expect(after.text).not.toContain('CONFORMIDAD RECHAZADA');
});
it('paginates maximum observed load and long notes without clipping or losing the last review', async () => {
  const long = { ...record, version: 12, motivo: 'M'.repeat(500),
    residuos: Array.from({ length: 50 }, (_, i) => ({ corriente: 'Y' + (i + 1), cantidad: i + 1, unidad: 'kg' })),
    revisiones: Array.from({ length: 12 }, (_, i) => ({ ...record.revisiones[0], id: 'qa-review-' + i, version: i, nota: 'Revisión ' + i + ': ' + 'evidencia '.repeat(48) + 'FIN-' + i })) };
  const result = await render(long, 12, 'long');
  expect(result.pages.length).toBeGreaterThan(2);
  expect(result.text).toContain('Y50 | 50 kg');
  expect(result.text).toContain('FIN-11');
  for (let i = 0; i < result.pages.length; i++) {
    expect(result.pages[i]).toContain('SITREP');
    expect(result.pages[i]).toContain('Página ' + (i + 1));
    if (i) expect(result.pages[i]).toContain('(continuación)');
  }
  const bbox = execFileSync('pdftotext', ['-bbox', result.file, '-'], { encoding: 'utf8' });
  const words = [...bbox.matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)"/g)];
  expect(words.length).toBeGreaterThan(200);
  for (const [, xMin, yMin, xMax, yMax] of words) {
    expect(Number(xMin)).toBeGreaterThanOrEqual(43);
    expect(Number(xMax)).toBeLessThanOrEqual(552);
    expect(Number(yMin)).toBeGreaterThanOrEqual(20);
    expect(Number(yMax)).toBeLessThan(825);
  }
  if (process.env.QA_ARTIFACTS) {
    const directory = path.join(process.env.QA_ARTIFACTS, 'annex-presentation');
    mkdirSync(directory, { recursive: true });
    const file = path.join(directory, 'long-annex.pdf'); writeFileSync(file, result.pdf);
    execFileSync('pdftoppm', ['-scale-to', '1100', '-png', file, path.join(directory, 'page')]);
  }
});
