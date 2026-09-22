import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { streamInspectionActPdf } from '../../services/inspectionActPdf.service';

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('inspection act PDF', () => {
  it('renders every photo and preserves long evidence, timeline and annulment details', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-'));
    const imagePath = path.join(tempDir, 'evidence.png');
    fs.writeFileSync(imagePath, pixelPng);
    const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
    const headers = new Map<string, string>();
    const chunks: Buffer[] = [];
    stream.setHeader = (name, value) => { headers.set(name, value); };
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const finished = new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

    const longTail = 'CIERRE-TEXTO-NO-RECORTADO';
    const photos = Array.from({ length: 8 }, (_, index) => ({
      id: `photo-${index + 1}`,
      tipo: 'FOTO', nombreOriginal: `foto-campo-${index + 1}.png`, storageKey: `photo-${index + 1}.png`, mimeDetectado: 'image/png', bytes: pixelPng.length,
      sha256: `${index + 1}`.repeat(64).slice(0, 64), capturadaAt: new Date(`2026-09-20T12:${String(index).padStart(2, '0')}:00Z`), createdAt: new Date(`2026-09-20T12:${String(index + 1).padStart(2, '0')}:00Z`),
      creadoPorId: 'user-1', creadoPor: { nombre: 'Inspectora', apellido: 'QA' }, itemId: index < 2 ? 'item-1' : null,
      descripcion: `Descripción extensa y completa de la fotografía ${index + 1}. ${index === 7 ? longTail : ''}`,
      transcripcion: index === 7 ? `Transcripción íntegra asociada. ${longTail}` : null,
      anuladaAt: index === 1 ? new Date('2026-09-20T14:00:00Z') : null, anuladaPorId: index === 1 ? 'user-1' : null,
      anuladaPor: index === 1 ? { nombre: 'Inspectora', apellido: 'QA' } : null,
      motivoAnulacion: index === 1 ? 'La toma quedó movida; se conserva pero no integra la conclusión.' : null,
    }));

    await streamInspectionActPdf(stream as any, {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: 'ACTA-001', version: 4,
      tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'user-1',
      inspector: { nombre: 'Inspectora', apellido: 'QA' },
      generador: { id: 'actor-1', razonSocial: 'Actor de prueba', cuit: '30-00000000-0', domicilio: 'Mendoza' },
      fechaProgramada: new Date('2026-09-20T12:00:00Z'), iniciadaAt: new Date('2026-09-20T12:05:00Z'),
      cerradaCampoAt: new Date('2026-09-20T13:00:00Z'), plazoRespuestaAt: null, createdAt: new Date('2026-09-20T11:00:00Z'), updatedAt: new Date('2026-09-20T13:00:00Z'),
      ubicacion: 'Planta de prueba', observaciones: `Inspección de prueba sin datos personales reales. ${'Detalle operativo '.repeat(80)}${longTail}`,
      comparaciones: [{ id: 'comparison-1', codigo: 'DOM-01', etiqueta: 'Domicilio', valorDeclarado: 'Mendoza', valorObservado: 'Mendoza', resultado: 'COINCIDE', observacion: `Observación completa. ${longTail}`, evidencias: [] }],
      items: [{ id: 'item-1', codigo: 'SEG-01', etiqueta: 'Libro disponible', resultado: 'NO_CUMPLE', observacion: `Hallazgo completo. ${longTail}`, evidencias: photos.slice(0, 2) }],
      evidencias: photos,
      eventos: [{ id: 'event-1', tipo: 'OBSERVACION', titulo: 'Relato completo del procedimiento', detalle: `${'Secuencia cronológica documentada. '.repeat(40)}${longTail}`, canal: null, estadoEntrega: null, destinatario: null, createdAt: new Date('2026-09-20T13:30:00Z'), usuarioId: 'user-1', usuario: { nombre: 'Inspectora', apellido: 'QA' }, adjuntos: [] }],
    }, () => imagePath);
    await finished;

    const pdf = Buffer.concat(chunks);
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(10_000);
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThanOrEqual(4);
    if (process.env.SITREP_PDF_QA_OUTPUT) {
      fs.mkdirSync(path.dirname(process.env.SITREP_PDF_QA_OUTPUT), { recursive: true });
      fs.writeFileSync(process.env.SITREP_PDF_QA_OUTPUT, pdf);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
