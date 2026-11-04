import { spawnSync } from 'node:child_process';
import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { streamInspectionActPdf } from '../../services/inspectionFieldActPdf.service';

const para = (marker: string, count: number) =>
  `${marker}INICIO ${'Constatación artificial y seguimiento documentado para comprobar el contenido completo. '.repeat(count)} ${marker}FINAL`;
const popplerAvailable = spawnSync('pdftotext', ['-v']).status === 0;

async function pdfWithLongFields(motivoLength = 7) {
  const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
  const chunks: Buffer[] = [];
  stream.setHeader = () => {};
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<void>((resolve, reject) => { stream.once('finish', resolve); stream.once('error', reject); });
  await streamInspectionActPdf(stream as any, {
    id: 'qa-long-act', numero: 'QA-INSPECCION-LARGA', numeroActa: 'QA-ACTA-LARGA', version: 2,
    tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'qa-inspector',
    inspector: { nombre: 'Inspectora', apellido: 'Prueba' },
    generador: { id: 'qa-generator', razonSocial: 'QA Empresa de prueba', cuit: '30-00000000-0',
      domicilio: 'QA Calle 100', telefono: '0000000', email: 'pdf@night-qa.invalid' },
    fechaProgramada: new Date('2026-10-20T12:00:00Z'), iniciadaAt: new Date('2026-10-20T12:05:00Z'),
    createdAt: new Date('2026-10-20T11:00:00Z'), updatedAt: new Date('2026-10-20T14:00:00Z'),
    observaciones: para('QAOBS', 38),
    datosActa: { departamento: 'Godoy Cruz', calle: 'Calle de prueba', numeroDomicilio: '100',
      atendidoPor: 'Responsable de prueba', area: 'Residuos Peligrosos', lugarAfectacion: 'Depósito',
      motivoInspeccion: para('QAMOTIVO', motivoLength), requerimientos: para('QAREQUERIMIENTO', 8),
      infraestructura: 'SI', estadoInfraestructura: 'Requiere adecuación', plazoDescargoDias: 5,
      danosEstado: 'NO_OBSERVADOS', tercerosTestigosEstado: 'NO_IDENTIFICADOS', libroOperacionesEstado: 'EXHIBIDO',
      firmaIntervinienteEstado: 'NEGATIVA', firmaIntervinienteDetalle: 'Negativa de prueba.',
      copiaActaEstado: 'PENDIENTE', domicilioLegal: 'QA Calle legal 123', notificacionEstado: 'NO_REALIZADA',
      notificacionDetalle: 'No se realizó comunicación en esta prueba.' },
    comparaciones: [], items: [], evidencias: [], eventos: [],
  }, () => { throw new Error('Unexpected file access'); });
  await finished;
  return Buffer.concat(chunks);
}

describe('inspection act pagination with extended field values', () => {
  it.skipIf(!popplerAvailable)('keeps long cells, headings and footer separate on numbered pages', async () => {
    const input = await pdfWithLongFields();
    const layout = spawnSync('pdftotext', ['-layout', '-', '-'], { input, encoding: 'utf8', maxBuffer: 20_000_000 });
    const parsed = spawnSync('pdftotext', ['-bbox', '-', '-'], { input, encoding: 'utf8', maxBuffer: 20_000_000 });
    expect(parsed.status, parsed.stderr).toBe(0);
    expect(layout.status, layout.stderr).toBe(0);
    expect((layout.stdout.match(/Constatación\s+artificial/g) || []).length).toBeGreaterThanOrEqual(53);
    const detailHeading = layout.stdout.split('\n').find(line => line.includes('DETALLE DE INFRAESTRUCTURA'));
    expect(detailHeading).toBeDefined();
    expect(detailHeading).not.toMatch(/CONT\./);
    expect(layout.stdout).not.toMatch(/Entrega de copia del acta \(continuaci[oó]n\)/i);
    const summaryPage = layout.stdout.split('\f').find(page => page.includes('Pendientes documentales:'));
    expect(summaryPage).toBeDefined();
    expect(summaryPage).toContain('Notificación y domicilio legal');
    const pages = [...parsed.stdout.matchAll(/<page width="([\d.]+)" height="([\d.]+)">([\s\S]*?)<\/page>/g)];
    expect(pages.length).toBeGreaterThanOrEqual(3);
    const text = pages.map(page => page[3].replace(/<[^>]+>/g, ' ')).join(' ');
    for (const marker of ['QAMOTIVOINICIO', 'QAMOTIVOFINAL', 'QAREQUERIMIENTOINICIO', 'QAREQUERIMIENTOFINAL', 'QAOBSFINAL']) {
      expect(text).toContain(marker);
    }
    for (const page of pages) {
      const height = Number(page[2]);
      const words = [...page[3].matchAll(/<word xMin="([\d.]+)" yMin="([\d.]+)" xMax="([\d.]+)" yMax="([\d.]+)">([^<]*)<\/word>/g)]
        .map(match => ({ x1: Number(match[1]), y1: Number(match[2]), x2: Number(match[3]), y2: Number(match[4]), text: match[5] }));
      expect(words.some(word => word.text === 'ACTA' && word.y1 < 140)).toBe(true);
      for (const marker of words.filter(word => /^QA(?:MOTIVO|REQUERIMIENTO)/.test(word.text))) {
        expect(marker.y2, `Field text intrudes into the footer: ${marker.text}`).toBeLessThan(height - 82);
      }
      const body = words.filter(word => word.y1 >= 140 && word.y2 < height - 82);
      const overlaps: string[] = [];
      for (let i = 0; i < body.length; i++) for (let j = i + 1; j < body.length; j++) {
        const a = body[i], b = body[j];
        const overlapX = Math.min(a.x2, b.x2) - Math.max(a.x1, b.x1);
        const overlapY = Math.min(a.y2, b.y2) - Math.max(a.y1, b.y1);
        if (overlapX > 0.5 && overlapY > 1) overlaps.push(`${a.text} / ${b.text}`);
      }
      expect(overlaps.slice(0, 10), 'Overlapping body text').toEqual([]);
    }
  }, 20000);

  it.skipIf(!popplerAvailable)('continues a very long cell on headed pages without losing its final text', async () => {
    const input = await pdfWithLongFields(45);
    const parsed = spawnSync('pdftotext', ['-layout', '-', '-'], { input, encoding: 'utf8', maxBuffer: 20_000_000 });
    expect(parsed.status, parsed.stderr).toBe(0);
    expect(parsed.stdout).toMatch(/MOTIVO DE INSPECCIÓN\s*·\s*CONT\./);
    expect(parsed.stdout).toContain('QAMOTIVOFINAL');
    const pages = parsed.stdout.split('\f').filter(page => page.trim());
    expect(pages.length).toBeGreaterThanOrEqual(4);
    for (const page of pages) expect(page).toContain('ACTA DE INSPECCIÓN / CONSTATACIÓN');
  }, 20000);
});
