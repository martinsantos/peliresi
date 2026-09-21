import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { streamInspectionActPdf } from '../../services/inspectionActPdf.service';

describe('inspection act PDF', () => {
  it('renders a versioned PDF with the integrity ledger', async () => {
    const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
    const headers = new Map<string, string>();
    const chunks: Buffer[] = [];
    stream.setHeader = (name, value) => { headers.set(name, value); };
    stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
    const finished = new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });

    await streamInspectionActPdf(stream as any, {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: 'ACTA-001', version: 4,
      tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'user-1',
      inspector: { nombre: 'Inspectora', apellido: 'QA' },
      generador: { id: 'actor-1', razonSocial: 'Actor de prueba', cuit: '30-00000000-0', domicilio: 'Mendoza' },
      fechaProgramada: new Date('2026-09-20T12:00:00Z'), iniciadaAt: new Date('2026-09-20T12:05:00Z'),
      cerradaCampoAt: new Date('2026-09-20T13:00:00Z'), createdAt: new Date('2026-09-20T11:00:00Z'), updatedAt: new Date('2026-09-20T13:00:00Z'),
      ubicacion: 'Planta de prueba', observaciones: 'Inspección de prueba sin datos personales reales.',
      comparaciones: [{ id: 'comparison-1', etiqueta: 'Domicilio', valorDeclarado: 'Mendoza', valorObservado: 'Mendoza', resultado: 'COINCIDE', observacion: null }],
      items: [{ id: 'item-1', etiqueta: 'Libro disponible', resultado: 'CUMPLE', observacion: null, evidencias: [] }],
      evidencias: [], eventos: [],
    }, () => '');
    await finished;

    const pdf = Buffer.concat(chunks);
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(1_000);
  });
});
