import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { PassThrough } from 'stream';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { demoEvidenceIds, demoInspection, demoPhotoCaption, DemoVariant } from '../../../scripts/generate-inspection-pdf-demos';
import { streamInspectionTechnicalReportPdf } from '../../services/inspectionActPdf.service';
import { streamInspectionActPdf } from '../../services/inspectionFieldActPdf.service';

type PdfRenderer = typeof streamInspectionActPdf;
type Inspection = ReturnType<typeof demoInspection>;
type ExtractedPdf = { pages: string[]; text: string };

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');
const temporaryDirectories: string[] = [];
const documents = new Map<string, ExtractedPdf>();
const normalize = (text: string) => text.replace(/\s+/g, ' ').trim();
const ref = (id: string) => `E-${id}`;

afterAll(() => {
  temporaryDirectories.forEach((directory) => fs.rmSync(directory, { recursive: true, force: true }));
});

async function renderAndExtract(renderer: PdfRenderer, inspection: Inspection): Promise<ExtractedPdf> {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-presentation-'));
  temporaryDirectories.push(directory);
  const imagePath = path.join(directory, 'synthetic.png');
  fs.writeFileSync(imagePath, pixelPng);
  const response = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
  response.setHeader = () => undefined;
  const chunks: Buffer[] = [];
  response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<void>((resolve, reject) => {
    response.once('finish', resolve);
    response.once('error', reject);
  });
  await renderer(response as any, inspection, () => imagePath);
  await finished;
  const pdfPath = path.join(directory, 'inspection.pdf');
  fs.writeFileSync(pdfPath, Buffer.concat(chunks));

  // This suite intentionally requires Poppler: stream validity alone does not
  // prove which page or section contains the reader-visible evidence text.
  // Raw reading order keeps the two gallery columns separate in the text.
  const extracted = spawnSync('pdftotext', ['-raw', pdfPath, '-'], { encoding: 'utf8' });
  if (extracted.error) throw new Error(`Presentation regression tests require pdftotext: ${extracted.error.message}`);
  expect(extracted.status, extracted.stderr).toBe(0);
  const pages = extracted.stdout.split('\f').map(normalize).filter(Boolean);
  expect(pages.length).toBeGreaterThan(1);
  return { pages, text: normalize(extracted.stdout) };
}

function sectionText(document: ExtractedPdf, heading: string, nextHeading: string): string {
  const start = document.text.indexOf(heading);
  expect(start, `Missing section: ${heading}`).toBeGreaterThanOrEqual(0);
  const end = document.text.indexOf(nextHeading, start + heading.length);
  expect(end, `Missing following section: ${nextHeading}`).toBeGreaterThan(start);
  return document.text.slice(start, end);
}

function documentFor(kind: 'acta' | 'report', variant: DemoVariant): ExtractedPdf {
  const document = documents.get(`${kind}-${variant}`);
  if (!document) throw new Error(`Missing generated fixture ${kind}-${variant}`);
  return document;
}

function expectCompleteText(actual: string, expected: string): void {
  // Continuation pages insert an institutional header, evidence identity and
  // footer. Permit those additions, while requiring every caption word in order.
  const actualWords = normalize(actual).split(' ');
  let cursor = 0;
  for (const word of normalize(expected).split(' ')) {
    const next = actualWords.indexOf(word, cursor);
    expect(next, `Caption word missing after position ${cursor}: ${word}`).toBeGreaterThanOrEqual(cursor);
    cursor = next + 1;
  }
}

beforeAll(async () => {
  for (const variant of ['short', 'long'] as const) {
    const inspection = demoInspection(variant);
    documents.set(`acta-${variant}`, await renderAndExtract(streamInspectionActPdf, inspection));
    documents.set(`report-${variant}`, await renderAndExtract(streamInspectionTechnicalReportPdf, inspection));
  }
}, 30_000);

describe('inspection PDF presentation regressions', () => {
  it('never promotes field observations into an absent executive conclusion', () => {
    const report = documentFor('report', 'short');
    const summary = sectionText(report, 'TÉCNICA · EXTRACTO', 'RECOMENDACIÓN');
    expect(summary).toContain('No se registró una conclusión técnica');
    expect(summary).not.toContain('OBSERVACION-DE-CAMPO-SIN-CONCLUSION');
    expect(sectionText(report, '4. Conclusión técnica', '5. Recomendación técnica'))
      .toContain('No se registró una conclusión técnica');
    // The observation still belongs in the factual evaluation.
    expect(sectionText(report, '3. Evaluación técnica', '4. Conclusión técnica'))
      .toContain('OBSERVACION-DE-CAMPO-SIN-CONCLUSION');
  });

  it.each(['', '   \n '])('treats an empty or whitespace-only conclusion (%j) as absent even when the technical report object exists', async (conclusion) => {
    const inspection = demoInspection('short');
    inspection.informeTecnico = { ...demoInspection('long').informeTecnico!, conclusion };
    const report = await renderAndExtract(streamInspectionTechnicalReportPdf, inspection);
    const summary = sectionText(report, 'TÉCNICA · EXTRACTO', 'RECOMENDACIÓN');
    expect(summary).toContain('No se registró una conclusión técnica');
    expect(summary).not.toContain('OBSERVACION-DE-CAMPO-SIN-CONCLUSION');
  });

  it('uses the recorded professional conclusion in both the summary and its full section', () => {
    const report = documentFor('report', 'long');
    const conclusion = demoInspection('long').informeTecnico!.conclusion;
    expect(sectionText(report, 'TÉCNICA · EXTRACTO', 'RECOMENDACIÓN')).toContain(conclusion);
    expect(sectionText(report, '4. Conclusión técnica', '5. Recomendación técnica')).toContain(conclusion);
  });

  it('uses the full stable evidence identity across every report context and the field-act photos', () => {
    const report = documentFor('report', 'short');
    const priorityFindings = sectionText(report, 'Hallazgos prioritarios', '1. Objetivo');
    expect(priorityFindings).toContain(`[ANULADA] ${ref(demoEvidenceIds.annulled)}`);
    const checklist = sectionText(report, 'Checklist de inspección', 'Evidencia fotográfica');
    expect(checklist).toContain(ref(demoEvidenceIds.firstPhoto));
    expect(checklist).toContain(ref(demoEvidenceIds.annulled));
    const gallery = sectionText(report, 'Evidencia fotográfica', 'Inventario de evidencias');
    for (const id of [demoEvidenceIds.firstPhoto, demoEvidenceIds.secondPhoto]) expect(gallery).toContain(ref(id));
    for (const id of [demoEvidenceIds.document, demoEvidenceIds.annulled]) expect(gallery).not.toContain(ref(id));
    for (const [heading, next] of [
      ['Inventario de evidencias', 'Trazabilidad operativa'],
      ['Integridad y cadena de custodia', 'Control documental y remisión'],
    ]) {
      const section = sectionText(report, heading, next);
      for (const id of Object.values(demoEvidenceIds)) expect(section).toContain(ref(id));
      expect(section).toContain('ANULADA');
    }
    expect(sectionText(report, 'Trazabilidad operativa', 'Intercambio formal y contradicción'))
      .toContain(ref(demoEvidenceIds.secondPhoto));
    expect(sectionText(report, 'Intercambio formal y contradicción', 'Integridad y cadena de custodia'))
      .toContain(ref(demoEvidenceIds.document));
    const acta = documentFor('acta', 'short');
    const annex = acta.text.slice(acta.text.indexOf('ANEXO FOTOGRÁFICO'));
    for (const id of [demoEvidenceIds.firstPhoto, demoEvidenceIds.secondPhoto]) expect(annex).toContain(ref(id));
    expect(annex).not.toContain(ref(demoEvidenceIds.annulled));
    expect(annex).not.toContain(ref(demoEvidenceIds.document));
  });

  it('preserves the full short caption next to its photo even when an item link is present', () => {
    const report = documentFor('report', 'short');
    const gallery = sectionText(report, 'Evidencia fotográfica', 'Inventario de evidencias');
    expectCompleteText(gallery, demoPhotoCaption('short'));
    expect(gallery).toContain('Señalización visible');
    const acta = documentFor('acta', 'short');
    const photoPage = acta.pages.find((page) => page.includes('INICIO-DESCRIPCION-FOTOGRAFICA'));
    expect(photoPage).toBeDefined();
    expectCompleteText(photoPage!, demoPhotoCaption('short'));
    expect(photoPage).toContain('Señalización visible');
  });

  it.each(['acta', 'report'] as const)('preserves every word of a caption spanning pages inside the %s photo section', (kind) => {
    const document = documentFor(kind, 'long');
    const photoSection = kind === 'report'
      ? sectionText(document, 'Evidencia fotográfica', 'Inventario de evidencias')
      : document.text.slice(document.text.indexOf('ANEXO FOTOGRÁFICO'));
    expectCompleteText(photoSection, demoPhotoCaption('long'));
    const firstPage = document.pages.findIndex((page) => page.includes('INICIO-DESCRIPCION-FOTOGRAFICA'));
    const lastPage = document.pages.findIndex((page) => page.includes('FIN-DESCRIPCION-FOTOGRAFICA'));
    expect(firstPage).toBeGreaterThanOrEqual(0);
    expect(lastPage).toBeGreaterThan(firstPage);
    expect(document.pages[lastPage]).toContain(ref(demoEvidenceIds.firstPhoto));
  });

  it.each(['short', 'long'] as const)('keeps the photographic heading and the first image caption on the same report page (%s)', (variant) => {
    const report = documentFor('report', variant);
    const page = report.pages.find((candidate) => candidate.includes('Evidencia fotográfica'));
    expect(page).toBeDefined();
    expect(page).toContain(ref(demoEvidenceIds.firstPhoto));
    expect(page).toContain('INICIO-DESCRIPCION-FOTOGRAFICA');
  });

  it.each(['short', 'long'] as const)('keeps institutional signature fields with their validation context on the same report page (%s)', (variant) => {
    const report = documentFor('report', variant);
    const page = report.pages.find((candidate) => candidate.includes('Revisión / aprobación institucional'));
    expect(page).toBeDefined();
    expect(page).toContain('Validación profesional y revisión institucional');
    expect(page).toContain('Su ausencia en esta exportación');
  });

  it.each([0, 12, 24, 36])('keeps a compact formality and its final completeness line together after %s preceding lines', async (precedingLines) => {
    const inspection = demoInspection('short');
    inspection.evidencias = [];
    inspection.datosActa.danosDetalle = Array.from({ length: Math.max(1, precedingLines) }, (_, index) => `Constancia sintética de daño ${index + 1}.`).join('\n');
    inspection.datosActa.libroOperacionesDetalle = '';
    const acta = await renderAndExtract(streamInspectionActPdf, inspection);
    const finalLine = 'Control de completitud: Falta la constancia circunstanciada del libro.';
    const page = acta.pages.find((candidate) => candidate.includes(finalLine));
    expect(page).toBeDefined();
    expect(page).toContain('Libro de Registro de Operaciones');
    expect(page).toContain('Sin constancia circunstanciada consignada.');
    expect(page).not.toContain('Libro de Registro de Operaciones (continuación)');
  });
});
