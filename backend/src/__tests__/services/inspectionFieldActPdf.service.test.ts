import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { streamInspectionActPdf } from '../../services/inspectionFieldActPdf.service';

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

describe('inspection field act PDF', () => {
  it('renders the tablet act, observations and photographic annex as one document', async () => {
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-acta-'));
    const imagePath = path.join(tempDir, 'hallazgo.png');
    fs.writeFileSync(imagePath, pixelPng);
    const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
    const headers = new Map<string, string>();
    const chunks: Buffer[] = [];
    stream.setHeader = (name, value) => { headers.set(name, value); };
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const finished = new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
    const evidence = {
      id: 'evidence-1', tipo: 'FOTO', nombreOriginal: 'hallazgo.png', storageKey: 'hallazgo.png', mimeDetectado: 'image/png', bytes: pixelPng.length,
      sha256: 'a'.repeat(64), capturadaAt: new Date('2026-09-22T13:00:00Z'), createdAt: new Date('2026-09-22T13:01:00Z'), itemId: 'item-1', anuladaAt: null,
      descripcion: 'Vista general del control observado.',
    };

    await streamInspectionActPdf(stream as any, {
      id: 'inspection-1', numero: 'I-2026-000099', numeroActa: 'ARP-DEMO-099', version: 6,
      tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'user-1',
      inspector: { nombre: 'Inspectora', apellido: 'QA' },
      generador: { id: 'actor-1', razonSocial: 'Entidad sintética', cuit: '30-00000000-0', domicilio: 'Calle Demo 100', telefono: '2610000000', email: 'demo@example.invalid' },
      fechaProgramada: new Date('2026-09-22T12:00:00Z'), iniciadaAt: new Date('2026-09-22T12:05:00Z'), createdAt: new Date('2026-09-22T11:00:00Z'), updatedAt: new Date('2026-09-22T14:00:00Z'),
      ubicacion: 'Planta sintética', observaciones: 'Se realizó el recorrido y se documentó un hallazgo de prueba.\nNo se enviaron comunicaciones externas.',
      datosActa: { departamento: 'Godoy Cruz', calle: 'Calle Demo', numeroDomicilio: '100', atendidoPor: 'Responsable Demo', cargoAtendido: 'Responsable técnico', area: 'Residuos Peligrosos', motivoInspeccion: 'Inspección programada', lugarAfectacion: 'Sector de almacenamiento', infraestructura: 'SI', estadoInfraestructura: 'Requiere adecuación', requerimientos: 'Adecuar señalización.', plazoDescargoDias: 5 },
      comparaciones: [],
      items: [{ id: 'item-1', codigo: 'SEG-01', etiqueta: 'Señalización visible', resultado: 'NO_CUMPLE', observacion: 'Falta señalización', evidencias: [evidence] }],
      evidencias: [evidence], eventos: [],
    }, () => imagePath);
    await finished;

    const pdf = Buffer.concat(chunks);
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Content-Disposition')).toContain('acta_inspeccion_');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(6_000);
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThanOrEqual(3);
    if (process.env.SITREP_ACTA_PDF_QA_OUTPUT) {
      fs.mkdirSync(path.dirname(process.env.SITREP_ACTA_PDF_QA_OUTPUT), { recursive: true });
      fs.writeFileSync(process.env.SITREP_ACTA_PDF_QA_OUTPUT, pdf);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
