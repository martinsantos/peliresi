import fs from 'fs';
import os from 'os';
import path from 'path';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import { streamInspectionTechnicalReportPdf } from '../../services/inspectionActPdf.service';

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

    await streamInspectionTechnicalReportPdf(stream as any, {
      id: 'inspection-1', numero: 'I-2026-000001', numeroActa: 'ACTA-001', version: 4,
      tipoActor: 'GENERADOR', estado: 'DERIVADA_LEGALES', inspectorId: 'user-1',
      inspector: { nombre: 'Inspectora', apellido: 'QA' },
      generador: { id: 'actor-1', razonSocial: 'Actor de prueba', cuit: '30-00000000-0', domicilio: 'Mendoza' },
      fechaProgramada: new Date('2026-09-20T12:00:00Z'), iniciadaAt: new Date('2026-09-20T12:05:00Z'),
      cerradaCampoAt: new Date('2026-09-20T13:00:00Z'), plazoRespuestaAt: null, createdAt: new Date('2026-09-20T11:00:00Z'), updatedAt: new Date('2026-09-20T13:00:00Z'),
      ubicacion: 'Planta de prueba', observaciones: `Inspección de prueba sin datos personales reales. ${'Detalle operativo '.repeat(80)}${longTail}`,
      datosActa: {
        area: 'Fiscalización ambiental',
        motivoInspeccion: 'Control programado de cumplimiento documental y operativo',
        lugarAfectacion: 'Sector de almacenamiento transitorio',
        atendidoPor: 'Responsable técnico de prueba',
        cargoAtendido: 'Responsable de planta',
        danosEstado: 'NO_OBSERVADOS',
        tercerosTestigosEstado: 'NO_IDENTIFICADOS',
        libroOperacionesEstado: 'EXHIBIDO',
        libroOperacionesDetalle: 'Libro exhibido y contrastado con el último asiento disponible.',
        firmaIntervinienteEstado: 'NEGATIVA',
        firmaIntervinienteDetalle: 'La negativa fue asentada por la inspectora interviniente.',
        copiaActaEstado: 'ENTREGADA',
        copiaActaDetalle: 'Copia entregada a la persona atendiente, con constancia en el expediente.',
        domicilioLegal: 'Domicilio sintético 100, Mendoza',
        notificacionEstado: 'CONSTANCIA_FORMAL',
        notificacionDetalle: 'Constancia formal incorporada al portal SITREP.',
        plazoDescargoDias: 5,
      },
      informeTecnico: {
        expedienteElectronico: 'EX-DEMO-0001',
        objetivo: 'Evaluar el cumplimiento documentado durante una inspección sintética.',
        antecedentes: 'Antecedente sintético sin datos personales.',
        evaluacion: `Evaluación técnica completa. ${longTail}`,
        conclusion: 'Conclusión técnica redactada y validable.',
        recomendacion: 'Remitir junto con el acta para dictamen.',
      },
      comparaciones: [{ id: 'comparison-1', codigo: 'DOM-01', etiqueta: 'Domicilio', valorDeclarado: 'Mendoza', valorObservado: 'Mendoza', resultado: 'COINCIDE', observacion: `Observación completa. ${longTail}`, evidencias: [] }],
      items: [{ id: 'item-1', codigo: 'SEG-01', etiqueta: 'Libro disponible', resultado: 'NO_CUMPLE', observacion: `Hallazgo completo. ${longTail}`, evidencias: photos.slice(0, 2) }],
      evidencias: photos,
      eventos: [{ id: 'event-1', tipo: 'OBSERVACION', titulo: 'Relato completo del procedimiento', detalle: `${'Secuencia cronológica documentada. '.repeat(40)}${longTail}`, canal: null, estadoEntrega: null, destinatario: null, createdAt: new Date('2026-09-20T13:30:00Z'), usuarioId: 'user-1', usuario: { nombre: 'Inspectora', apellido: 'QA' }, adjuntos: [] }],
      intercambios: [
        {
          id: 'exchange-1', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', asunto: 'Requerimiento documental',
          cuerpo: 'Se solicita acompañar documentación respaldatoria dentro del plazo indicado.', plazoRespuestaAt: new Date('2026-09-25T15:00:00Z'),
          presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP', versionExpediente: 4, contenidoSha256: 'a'.repeat(64), hashAnterior: null,
          hashCadena: 'b'.repeat(64), autorId: 'user-1', createdAt: new Date('2026-09-20T14:00:00Z'),
          autor: { nombre: 'Inspectora', apellido: 'QA', rol: 'ADMIN' }, adjuntos: [photos[2]],
        },
        {
          id: 'exchange-2', secuencia: 2, respondeAId: 'exchange-1', tipo: 'DESCARGO', parte: 'INSPECCIONADO', asunto: 'Presentación de descargo',
          cuerpo: `Se presenta la respuesta con su documentación de respaldo. ${longTail}`, plazoRespuestaAt: null,
          presentadoFueraDePlazo: true, canal: 'PORTAL_SITREP', versionExpediente: 5, contenidoSha256: 'c'.repeat(64), hashAnterior: 'b'.repeat(64),
          hashCadena: 'd'.repeat(64), autorId: 'actor-user', createdAt: new Date('2026-09-26T14:00:00Z'),
          autor: { nombre: 'Representante', apellido: 'QA', rol: 'GENERADOR' }, adjuntos: [photos[3]],
        },
        {
          id: 'exchange-3', secuencia: 3, respondeAId: null, tipo: 'DERIVACION_LEGALES', parte: 'AUTORIDAD', asunto: 'Derivación del expediente a Legales',
          cuerpo: 'Concluida la instancia de intercambio, se remiten el acta, el informe técnico, las presentaciones y sus adjuntos para la intervención legal competente.', plazoRespuestaAt: null,
          presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP', versionExpediente: 6, contenidoSha256: 'e'.repeat(64), hashAnterior: 'd'.repeat(64),
          hashCadena: 'f'.repeat(64), autorId: 'admin-1', createdAt: new Date('2026-09-27T14:00:00Z'),
          autor: { nombre: 'Administradora', apellido: 'DGFA', rol: 'ADMIN' }, adjuntos: [photos[4]],
        },
      ],
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
