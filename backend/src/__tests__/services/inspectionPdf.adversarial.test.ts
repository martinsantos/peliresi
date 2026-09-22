import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { PassThrough } from 'stream';
import { afterEach, describe, expect, it } from 'vitest';
import { streamInspectionTechnicalReportPdf } from '../../services/inspectionActPdf.service';
import { streamInspectionActPdf } from '../../services/inspectionFieldActPdf.service';

const pixelPng = Buffer.from(
  'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
  'base64',
);

type PdfRenderer = (
  response: any,
  inspection: any,
  resolveEvidence: (storageKey: string) => string,
) => Promise<void>;

type CapturedPdf = {
  body: Buffer;
  headers: Map<string, string>;
};

const temporaryDirectories: string[] = [];

afterEach(() => {
  temporaryDirectories.splice(0).forEach((directory) => {
    fs.rmSync(directory, { recursive: true, force: true });
  });
});

function temporaryEvidenceFiles() {
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-adversarial-'));
  temporaryDirectories.push(directory);
  const valid = path.join(directory, 'valid.png');
  const corrupt = path.join(directory, 'corrupt.png');
  const missing = path.join(directory, 'missing.png');
  fs.writeFileSync(valid, pixelPng);
  fs.writeFileSync(corrupt, Buffer.from('this is deliberately not a PNG'));
  return { directory, valid, corrupt, missing };
}

function baseInspection(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inspection-adversarial',
    numero: 'I-QA-ADVERSARIAL',
    version: 1,
    tipoActor: 'GENERADOR',
    estado: 'BORRADOR',
    inspectorId: 'inspector-qa',
    inspector: { nombre: 'Inspectora', apellido: 'QA' },
    comparaciones: [],
    items: [],
    evidencias: [],
    eventos: [],
    ...overrides,
  };
}

function photo(index: number, storageKey: string) {
  return {
    id: `photo-${index}`,
    tipo: 'FOTO',
    nombreOriginal: `evidencia-${index}.png`,
    storageKey,
    mimeDetectado: 'image/png',
    bytes: pixelPng.length,
    sha256: String(index).repeat(64).slice(0, 64),
    capturadaAt: new Date(`2026-09-22T12:${String(index).padStart(2, '0')}:00Z`),
    createdAt: new Date(`2026-09-22T12:${String(index + 1).padStart(2, '0')}:00Z`),
    creadoPorId: 'inspector-qa',
    creadoPor: { nombre: 'Inspectora', apellido: 'QA' },
    anuladaAt: null,
    descripcion: `Registro fotográfico adversarial ${index}`,
  };
}

async function capturePdf(
  renderer: PdfRenderer,
  inspection: any,
  resolveEvidence: (storageKey: string) => string = () => '/definitely/missing/evidence.png',
): Promise<CapturedPdf> {
  const response = new PassThrough() as PassThrough & {
    setHeader: (name: string, value: string) => void;
  };
  const headers = new Map<string, string>();
  const chunks: Buffer[] = [];
  response.setHeader = (name, value) => { headers.set(name, String(value)); };
  response.on('data', (chunk) => chunks.push(Buffer.from(chunk)));

  let timeout: NodeJS.Timeout | undefined;
  const finished = Promise.race([
    new Promise<void>((resolve, reject) => {
      response.once('finish', resolve);
      response.once('error', reject);
    }),
    new Promise<void>((_resolve, reject) => {
      timeout = setTimeout(() => reject(new Error('PDF stream did not finish within 10 seconds')), 10_000);
    }),
  ]);

  try {
    await renderer(response as any, inspection, resolveEvidence);
    await finished;
  } finally {
    if (timeout) clearTimeout(timeout);
  }

  expect(response.writableEnded).toBe(true);
  return { body: Buffer.concat(chunks), headers };
}

function assertStructurallyValidPdf(pdf: CapturedPdf, minimumPages = 1) {
  expect(pdf.headers.get('Content-Type')).toBe('application/pdf');
  expect(pdf.headers.get('Content-Disposition')).toMatch(/^attachment; filename=.+\.pdf$/);
  expect(pdf.body.subarray(0, 5).toString('latin1')).toBe('%PDF-');
  expect(pdf.body.length).toBeGreaterThan(1_500);

  const source = pdf.body.toString('latin1');
  expect(source.trimEnd().endsWith('%%EOF')).toBe(true);
  const startXrefMatches = [...source.matchAll(/startxref\s+(\d+)/g)];
  expect(startXrefMatches.length).toBeGreaterThan(0);
  const xrefOffset = Number(startXrefMatches.at(-1)?.[1]);
  expect(Number.isSafeInteger(xrefOffset)).toBe(true);
  expect(pdf.body.subarray(xrefOffset, xrefOffset + 4).toString('latin1')).toBe('xref');

  const rootReference = source.match(/\/Root\s+(\d+)\s+0\s+R/);
  expect(rootReference).not.toBeNull();
  expect(source).toContain(`${rootReference?.[1]} 0 obj`);
  const pageObjects = source.match(/\/Type\s*\/Page\b/g) || [];
  expect(pageObjects.length).toBeGreaterThanOrEqual(minimumPages);

  // Poppler supplies an independent parser when present locally. The structural
  // assertions above remain the portable CI contract when that binary is absent.
  const directory = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-validation-'));
  temporaryDirectories.push(directory);
  const file = path.join(directory, 'document.pdf');
  fs.writeFileSync(file, pdf.body);
  const parsed = spawnSync('pdfinfo', [file], { encoding: 'utf8' });
  if (!parsed.error) {
    expect(parsed.status, parsed.stderr).toBe(0);
    expect(parsed.stdout).toMatch(/Pages:\s+\d+/);
    expect(parsed.stdout).toContain('Page size:');
  } else {
    expect((parsed.error as NodeJS.ErrnoException).code).toBe('ENOENT');
  }
}

const renderers: Array<{ name: string; render: PdfRenderer }> = [
  { name: 'acta de campo', render: streamInspectionActPdf },
  { name: 'informe técnico', render: streamInspectionTechnicalReportPdf },
];

describe.each(renderers)('PDF adversarial: $name', ({ render }) => {
  it('terminates and emits a valid PDF when optional fields and every photo are absent', async () => {
    const pdf = await capturePdf(render, baseInspection());

    assertStructurallyValidPdf(pdf, 1);
  });

  it('terminates and emits a valid PDF with exactly one valid photo', async () => {
    const files = temporaryEvidenceFiles();
    const evidence = photo(1, 'valid.png');
    const inspection = baseInspection({
      numeroActa: 'ACTA-QA-1',
      generador: { id: 'actor-qa', razonSocial: 'Entidad QA', cuit: '30-00000000-0' },
      observaciones: 'Una constatación breve.',
      evidencias: [evidence],
    });

    const pdf = await capturePdf(render, inspection, () => files.valid);

    assertStructurallyValidPdf(pdf, 2);
  });

  it('paginates very long content and many mixed photos without hanging or truncating the stream', async () => {
    const files = temporaryEvidenceFiles();
    const longParagraph = `${'Constatación técnica documentada con precisión y trazabilidad. '.repeat(180)}${'X'.repeat(512)}`;
    const evidences = Array.from({ length: 9 }, (_, index) => photo(index + 1, `${index % 3 === 0 ? 'valid' : index % 3 === 1 ? 'corrupt' : 'missing'}.png`));
    const inspection = baseInspection({
      numeroActa: 'ACTA-QA-LONG',
      generador: {
        id: 'actor-qa',
        razonSocial: `Entidad de razón social extensa ${'con denominación adicional '.repeat(15)}`,
        cuit: '30-00000000-0',
        domicilio: longParagraph,
      },
      observaciones: longParagraph,
      datosActa: {
        departamento: 'Luján de Cuyo',
        calle: longParagraph,
        motivoInspeccion: longParagraph,
        requerimientos: longParagraph,
      },
      informeTecnico: {
        objetivo: longParagraph,
        antecedentes: longParagraph,
        evaluacion: longParagraph,
        conclusion: longParagraph,
        recomendacion: longParagraph,
      },
      comparaciones: Array.from({ length: 12 }, (_, index) => ({
        id: `comparison-${index}`,
        codigo: `CMP-${index}`,
        etiqueta: `Concepto comparado ${index} ${'detallado '.repeat(8)}`,
        valorDeclarado: longParagraph.slice(0, 900),
        valorObservado: longParagraph.slice(0, 900),
        resultado: index % 2 ? 'DIFIERE' : 'COINCIDE',
        observacion: longParagraph.slice(0, 700),
      })),
      items: Array.from({ length: 18 }, (_, index) => ({
        id: `item-${index}`,
        codigo: `CHK-${index}`,
        etiqueta: `Control de campo ${index} ${'específico '.repeat(8)}`,
        resultado: index % 2 ? 'NO_CUMPLE' : 'CUMPLE',
        observacion: longParagraph.slice(0, 700),
        evidencias: [],
      })),
      evidencias: evidences,
      eventos: Array.from({ length: 8 }, (_, index) => ({
        id: `event-${index}`,
        tipo: 'OBSERVACION',
        titulo: `Evento de trazabilidad ${index}`,
        detalle: longParagraph.slice(0, 900),
        canal: null,
        estadoEntrega: null,
        destinatario: null,
        createdAt: new Date(`2026-09-22T14:${String(index).padStart(2, '0')}:00Z`),
        usuarioId: 'inspector-qa',
        usuario: { nombre: 'Inspectora', apellido: 'QA' },
        adjuntos: [],
      })),
    });
    const paths: Record<string, string> = {
      'valid.png': files.valid,
      'corrupt.png': files.corrupt,
      'missing.png': files.missing,
    };

    const pdf = await capturePdf(render, inspection, (storageKey) => paths[storageKey]);

    assertStructurallyValidPdf(pdf, 5);
    expect(pdf.body.length).toBeLessThan(8_000_000);
  }, 20_000);

  it('keeps the PDF valid when the only image exists but its bytes are corrupt', async () => {
    const files = temporaryEvidenceFiles();
    const evidence = photo(1, 'corrupt.png');
    const pdf = await capturePdf(
      render,
      baseInspection({ numeroActa: 'ACTA-QA-CORRUPT', evidencias: [evidence] }),
      () => files.corrupt,
    );

    assertStructurallyValidPdf(pdf, 2);
  });
});
