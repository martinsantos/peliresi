import fs from 'fs';
import os from 'os';
import path from 'path';
import { spawnSync } from 'child_process';
import { PassThrough } from 'stream';
import { describe, expect, it } from 'vitest';
import {
  buildInspectionDocumentFingerprint,
  buildInspectionFieldActFingerprint,
} from '../../services/inspectionDocumentIntegrity.service';
import {
  buildInspectionFieldActPresentation,
  streamInspectionActPdf,
} from '../../services/inspectionFieldActPdf.service';
import { inspectionTraceUrl } from '../../services/inspectionTraceToken.service';

const pixelPng = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=', 'base64');

const completeArticle44Data = {
  danosEstado: 'OBSERVADOS',
  danosDetalle: 'Daño menor documentado en una defensa metálica.',
  tercerosTestigosEstado: 'NO_IDENTIFICADOS',
  libroOperacionesEstado: 'EXHIBIDO',
  libroOperacionesDetalle: 'Libro exhibido; se verificó el último asiento disponible.',
  firmaIntervinienteEstado: 'NEGATIVA',
  firmaIntervinienteDetalle: 'La negativa fue asentada por la inspectora interviniente.',
  copiaActaEstado: 'NEGATIVA_RECEPCION',
  copiaActaDetalle: 'Se dejó constancia de la negativa a recibir la copia.',
  domicilioLegal: 'Calle Legal 123, Godoy Cruz, Mendoza',
  notificacionEstado: 'CONSTANCIA_FORMAL',
  notificacionDetalle: 'Constancia formal incorporada al expediente.',
  plazoDescargoDias: 5,
} as const;

describe('inspection field act PDF', () => {
  it('distinguishes documentary completeness from field closure without inferring missing facts', () => {
    const incomplete = buildInspectionFieldActPresentation({ datosActa: {} });
    expect(incomplete.status).toBe('BORRADOR_INCOMPLETA');
    expect(incomplete.unresolved.map((entry) => entry.key)).toEqual([
      'damages',
      'witnesses',
      'operationsBook',
      'signature',
      'copyDelivery',
      'notification',
    ]);
    expect(incomplete.formalities.every((entry) => entry.state === 'No consignado')).toBe(true);
    expect(incomplete.formalities.find((entry) => entry.key === 'notification')?.detail).toContain('Domicilio legal: No consignado.');

    const documentedDraft = buildInspectionFieldActPresentation({ datosActa: completeArticle44Data });
    expect(documentedDraft.status).toBe('BORRADOR_PENDIENTE_CIERRE');
    expect(documentedDraft.complete).toBe(true);

    const documentedAndClosed = buildInspectionFieldActPresentation({
      cerradaCampoAt: new Date('2026-09-22T14:00:00Z'),
      datosActa: completeArticle44Data,
    });
    expect(documentedAndClosed.status).toBe('CERRADA_COMPLETA');
    expect(documentedAndClosed.unresolved).toEqual([]);
  });

  it('keeps adverse or pending formalities explicit and requires their contextual detail', () => {
    const presentation = buildInspectionFieldActPresentation({
      cerradaCampoAt: new Date('2026-09-22T14:00:00Z'),
      datosActa: {
        ...completeArticle44Data,
        danosEstado: 'OBSERVADOS',
        danosDetalle: '',
        tercerosTestigosEstado: 'IDENTIFICADOS',
        tercerosTestigosDetalle: '',
        libroOperacionesEstado: 'NO_VERIFICADO',
        libroOperacionesDetalle: '',
        firmaIntervinienteEstado: 'PENDIENTE',
        firmaIntervinienteDetalle: '',
        copiaActaEstado: 'NO_ENTREGADA',
        copiaActaDetalle: '',
        domicilioLegal: '',
        notificacionEstado: 'NO_REALIZADA',
        notificacionDetalle: '',
        plazoDescargoDias: undefined,
      },
    });

    expect(presentation.status).toBe('CERRADA_INCOMPLETA');
    expect(presentation.unresolved.map((entry) => entry.key)).toEqual([
      'damages',
      'witnesses',
      'operationsBook',
      'signature',
      'copyDelivery',
      'notification',
    ]);
    expect(presentation.formalities.find((entry) => entry.key === 'copyDelivery')).toMatchObject({
      state: 'Copia no entregada',
      unresolvedReason: 'Falta documentar la entrega, negativa o falta de entrega.',
    });
    expect(presentation.formalities.find((entry) => entry.key === 'notification')?.unresolvedReason)
      .toBe('Falta consignar: domicilio legal, constancia de notificación, plazo.');
  });

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

    const inspection = {
      id: 'inspection-1', numero: 'I-2026-000099', numeroActa: 'ARP-DEMO-099', version: 6,
      tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'user-1',
      inspector: { nombre: 'Inspectora', apellido: 'QA' },
      generador: { id: 'actor-1', razonSocial: 'Entidad sintética', cuit: '30-00000000-0', domicilio: 'Calle Demo 100', telefono: '2610000000', email: 'demo@example.invalid' },
      fechaProgramada: new Date('2026-09-22T12:00:00Z'), iniciadaAt: new Date('2026-09-22T12:05:00Z'), createdAt: new Date('2026-09-22T11:00:00Z'), updatedAt: new Date('2026-09-22T14:00:00Z'),
      ubicacion: 'Planta sintética', observaciones: 'Se realizó el recorrido y se documentó un hallazgo de prueba.\nNo se enviaron comunicaciones externas.',
      datosActa: {
        departamento: 'Godoy Cruz', calle: 'Calle Demo', numeroDomicilio: '100', atendidoPor: 'Responsable Demo', cargoAtendido: 'Responsable técnico', area: 'Residuos Peligrosos', motivoInspeccion: 'Inspección programada', lugarAfectacion: 'Sector de almacenamiento', infraestructura: 'SI', estadoInfraestructura: 'Requiere adecuación', requerimientos: 'Adecuar señalización.', plazoDescargoDias: 5,
        danosEstado: 'OBSERVADOS',
        danosDetalle: 'Defensa metálica con deformación superficial, documentada sin atribuir causa.',
        tercerosTestigosEstado: 'NO_VERIFICADO',
        libroOperacionesEstado: 'EXHIBIDO',
        libroOperacionesDetalle: '',
        firmaIntervinienteEstado: 'NEGATIVA',
        firmaIntervinienteDetalle: 'La persona atendiente manifestó su negativa; la inspectora dejó constancia.',
        copiaActaEstado: 'PENDIENTE',
        domicilioLegal: 'Calle Legal 123, Godoy Cruz, Mendoza',
        notificacionEstado: 'NO_REALIZADA',
        notificacionDetalle: 'No se realizó notificación durante esta emisión de prueba.',
      },
      comparaciones: [],
      items: [{ id: 'item-1', codigo: 'SEG-01', etiqueta: 'Señalización visible', resultado: 'NO_CUMPLE', observacion: 'Falta señalización', evidencias: [evidence] }],
      evidencias: [evidence], eventos: [],
    };

    await streamInspectionActPdf(stream as any, inspection, () => imagePath);
    await finished;

    const pdf = Buffer.concat(chunks);
    expect(headers.get('Content-Type')).toBe('application/pdf');
    expect(headers.get('Content-Disposition')).toContain('acta_inspeccion_');
    expect(pdf.subarray(0, 4).toString()).toBe('%PDF');
    expect(pdf.length).toBeGreaterThan(6_000);
    // At least the real QR plus the photographic evidence must be embedded.
    expect((pdf.toString('latin1').match(/\/Subtype\s*\/Image\b/g) || []).length).toBeGreaterThanOrEqual(2);
    expect((pdf.toString('latin1').match(/\/Subtype\s*\/Link\b/g) || []).length).toBeGreaterThanOrEqual(1);
    expect((pdf.toString('latin1').match(/\/Type\s*\/Page\b/g) || []).length).toBeGreaterThanOrEqual(4);

    const renderedPdf = path.join(tempDir, 'acta-art44.pdf');
    fs.writeFileSync(renderedPdf, pdf);
    const extracted = spawnSync('pdftotext', [renderedPdf, '-'], { encoding: 'utf8' });
    if (!extracted.error) {
      expect(extracted.status, extracted.stderr).toBe(0);
      expect(extracted.stdout).toContain('ESTADO DOCUMENTAL: BORRADOR / INCOMPLETA');
      expect(extracted.stdout).toContain('FORMALIDADES DOCUMENTALES DEL ART. 44');
      expect(extracted.stdout).toContain('Daños a personas o bienes');
      expect(extracted.stdout).toContain('Terceros y testigos intervinientes');
      expect(extracted.stdout).toContain('Libro de Registro de Operaciones');
      expect(extracted.stdout).toContain('Firma e intervinientes');
      expect(extracted.stdout).toContain('Entrega de copia del acta');
      expect(extracted.stdout).toContain('Notificación y domicilio legal');
      expect(extracted.stdout).toContain('DOCUMENTO OFICIAL GENERADO POR SITREP');
      expect(extracted.stdout).toContain('Gobierno de Mendoza');
      expect(extracted.stdout).toContain('VERIFICAR TRAZABILIDAD DEL ACTA');
      expect(extracted.stdout).toContain('HUELLA SHA-256 DEL EXPEDIENTE');
      expect(extracted.stdout.replace(/\s/g, '')).toContain(inspectionTraceUrl(inspection.id, inspection.numero, inspection.version, buildInspectionDocumentFingerprint(inspection)).replace(/\s/g, ''));
      expect(extracted.stdout.replace(/\s/g, '')).toContain(buildInspectionDocumentFingerprint(inspection));
      expect(extracted.stdout.replace(/\s/g, '')).toContain(buildInspectionFieldActFingerprint(inspection));
    } else {
      expect((extracted.error as NodeJS.ErrnoException).code).toBe('ENOENT');
    }
    if (process.env.SITREP_ACTA_PDF_QA_OUTPUT) {
      fs.mkdirSync(path.dirname(process.env.SITREP_ACTA_PDF_QA_OUTPUT), { recursive: true });
      fs.writeFileSync(process.env.SITREP_ACTA_PDF_QA_OUTPUT, pdf);
    }
    fs.rmSync(tempDir, { recursive: true, force: true });
  });
});
