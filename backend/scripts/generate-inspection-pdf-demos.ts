/**
 * Reproducible visual fixtures for the two inspection PDFs.
 *
 * The evidence is a technical SVG rendered to PNG by sharp. It is deliberately
 * labelled SIMULACIÓN and is not presented as a real photograph.
 *
 * Run from backend/:
 *   SITREP_PDF_DEMO_OUTPUT=/tmp/sitrep-pdf-review npx ts-node scripts/generate-inspection-pdf-demos.ts
 *
 * Without SITREP_PDF_DEMO_OUTPUT, a fresh temporary directory is used. The
 * short case has no professional conclusion; the long case exercises captions
 * that continue onto another page. Neither case reads a live inspection.
 */
import fs from 'fs';
import os from 'os';
import path from 'path';
import { createHash } from 'crypto';
import { PassThrough } from 'stream';
import sharp from 'sharp';
import { streamInspectionTechnicalReportPdf } from '../src/services/inspectionActPdf.service';
import { streamInspectionActPdf } from '../src/services/inspectionFieldActPdf.service';

export type DemoVariant = 'short' | 'long';
export const demoEvidenceIds = {
  document: 'd0c00001-0001',
  annulled: 'f07000ff-0002',
  firstPhoto: 'f0700001-0003',
  secondPhoto: 'f0700002-0004',
};
const imageKeys = ['lamina-acopio.png', 'lamina-recorrido.png', 'lamina-anulada.png'];
const documentContent = 'SIMULACIÓN. Constancia documental sintética para revisar identificadores y adjuntos del PDF.\n';
const narrative = 'Se verificó el sector de almacenamiento, el acceso al registro y la correspondencia de las etiquetas con el inventario sintético. Los datos reproducen un procedimiento de demostración sin personas, instalaciones ni actuaciones reales.';

export function demoPhotoCaption(variant: DemoVariant): string {
  const introduction = 'INICIO-DESCRIPCION-FOTOGRAFICA. Lámina sintética del sector de acopio; un rótulo presenta desgaste en el borde inferior y el pasillo permanece despejado. No es una fotografía real.';
  if (variant === 'short') return `${introduction} FIN-DESCRIPCION-FOTOGRAFICA.`;
  // Enough text for a genuine continuation page at the gallery's caption size.
  const paragraphs = Array.from({ length: 22 }, (_, index) =>
    `Detalle ${String(index + 1).padStart(2, '0')}: ${narrative} La referencia del contenedor P-01 permite relacionar esta descripción con el punto observado y revisar la continuidad del texto sin resumir su contenido.`,
  );
  return [introduction, ...paragraphs, 'FIN-DESCRIPCION-FOTOGRAFICA.'].join('\n\n');
}

function technicalSvg(index: number): string {
  const label = `LÁMINA ${index} - SIMULACIÓN`;
  const accent = index % 2 ? '#0D8A4F' : '#1E5AA8';
  return `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="1400" height="920" viewBox="0 0 1400 920">
  <rect width="1400" height="920" fill="#f3f6f8"/>
  <rect x="48" y="48" width="1304" height="824" rx="22" fill="#fff" stroke="#cad4df" stroke-width="4"/>
  <text x="94" y="128" font-family="Arial, sans-serif" font-size="34" font-weight="700" fill="#10213a">EVIDENCIA TÉCNICA ILUSTRATIVA</text>
  <text x="94" y="178" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#a61b1b">SIMULACIÓN · NO ES UNA FOTOGRAFÍA REAL</text>
  <text x="94" y="224" font-family="Arial, sans-serif" font-size="24" fill="#5e6b7f">Inspección I-2026-000001 · control documental de residuos peligrosos</text>
  <rect x="94" y="280" width="1212" height="412" rx="14" fill="#f4f7f5" stroke="${accent}" stroke-width="5"/>
  <path d="M144 610 H1250 M214 350 V650 M430 350 V650 M646 350 V650 M862 350 V650 M1078 350 V650" stroke="#b7c5d2" stroke-width="3" stroke-dasharray="12 10"/>
  <rect x="160" y="390" width="195" height="170" rx="10" fill="#eaf7f0" stroke="#0d8a4f" stroke-width="5"/>
  <text x="185" y="460" font-family="Arial, sans-serif" font-size="28" font-weight="700" fill="#1b5e3c">ZONA A</text>
  <text x="185" y="505" font-family="Arial, sans-serif" font-size="23" fill="#172033">acopio</text>
  <circle cx="540" cy="475" r="88" fill="#fff4d6" stroke="#9a5b00" stroke-width="6"/>
  <text x="488" y="466" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#9a5b00">P-01</text>
  <text x="471" y="505" font-family="Arial, sans-serif" font-size="22" fill="#172033">contenedor</text>
  <rect x="770" y="380" width="210" height="190" rx="12" fill="#eaf0ff" stroke="#1e5aa8" stroke-width="5"/>
  <text x="808" y="456" font-family="Arial, sans-serif" font-size="27" font-weight="700" fill="#1e5aa8">RUTA</text>
  <path d="M812 510 C860 425 905 560 950 456" fill="none" stroke="#1e5aa8" stroke-width="12"/>
  <path d="M932 458 l25 -4 -11 23" fill="#1e5aa8"/>
  <rect x="1080" y="390" width="165" height="170" rx="10" fill="#fdecec" stroke="#a61b1b" stroke-width="5"/>
  <text x="1110" y="456" font-family="Arial, sans-serif" font-size="26" font-weight="700" fill="#a61b1b">SEG-01</text>
  <text x="1110" y="502" font-family="Arial, sans-serif" font-size="22" fill="#172033">hallazgo</text>
  <rect x="94" y="744" width="1212" height="74" rx="12" fill="#10213a"/>
  <text x="124" y="792" font-family="Arial, sans-serif" font-size="25" font-weight="700" fill="#fff">${label} · REPRESENTACIÓN VECTORIAL PARA QA DEL PDF</text>
</svg>`;
}

async function makeEvidenceFiles(fixtureDir: string): Promise<Map<string, string>> {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const paths = new Map<string, string>();
  for (let index = 0; index < imageKeys.length; index += 1) {
    const key = imageKeys[index];
    const target = path.join(fixtureDir, key);
    await sharp(Buffer.from(technicalSvg(index + 1))).png().toFile(target);
    paths.set(key, target);
  }
  const documentPath = path.join(fixtureDir, 'constancia-demo.txt');
  fs.writeFileSync(documentPath, documentContent);
  paths.set('constancia-demo.txt', documentPath);
  return paths;
}

export function demoInspection(variant: DemoVariant) {
  const source = [
    { id: demoEvidenceIds.document, storageKey: 'constancia-demo.txt', tipo: 'DOCUMENTO' },
    { id: demoEvidenceIds.annulled, storageKey: imageKeys[2], tipo: 'FOTO' },
    { id: demoEvidenceIds.firstPhoto, storageKey: imageKeys[0], tipo: 'FOTO' },
    { id: demoEvidenceIds.secondPhoto, storageKey: imageKeys[1], tipo: 'FOTO' },
  ];
  const evidence = source.map(({ id, storageKey, tipo }, index) => ({
    id,
    tipo,
    nombreOriginal: storageKey,
    storageKey,
    mimeDetectado: tipo === 'FOTO' ? 'image/png' : 'text/plain',
    bytes: 0,
    sha256: `${String(index + 1)}${'a'.repeat(63)}`,
    capturadaAt: new Date(`2026-09-22T13:${String(index).padStart(2, '0')}:00Z`),
    createdAt: new Date(`2026-09-22T13:${String(index + 1).padStart(2, '0')}:00Z`),
    creadoPorId: 'demo-inspector',
    creadoPor: { nombre: 'Inspectora', apellido: 'QA' },
    itemId: index === 1 || index === 2 ? 'item-1' : null,
    comparacionId: index === 3 ? 'comparison-1' : null,
    intercambioId: index === 0 ? 'exchange-1' : null,
    descripcion: index === 2 ? demoPhotoCaption(variant) : index === 3
      ? 'Lámina de recorrido de demostración. DESCRIPCION-SEGUNDA-FOTO-COMPLETA.'
      : index === 1 ? 'Toma sintética anulada; se preserva su registro y su motivo de anulación.'
        : 'Constancia documental sintética adjunta a la presentación formal.',
    transcripcion: null,
    anuladaAt: index === 1 ? new Date('2026-09-22T13:10:00Z') : null,
    anuladaPorId: index === 1 ? 'demo-inspector' : null,
    anuladaPor: index === 1 ? { nombre: 'Inspectora', apellido: 'QA' } : null,
    motivoAnulacion: index === 1 ? 'Lámina duplicada de simulación. Se conserva para verificar la trazabilidad.' : null,
  }));
  return {
    id: 'demo-inspection-001', numero: 'I-2026-000001', numeroActa: 'ARP-DEMO-001', version: 7,
    tipoActor: 'GENERADOR', estado: 'DERIVADA_LEGALES', inspectorId: 'demo-inspector',
    inspector: { nombre: 'Inspectora', apellido: 'QA' },
    generador: {
      id: 'demo-generator', razonSocial: 'Entidad Ambiental de Mendoza · SIMULACIÓN', cuit: '30-00000000-0',
      domicilio: 'Calle de Prueba 100, Mendoza', telefono: '261-000-0000', email: 'demo@example.invalid',
    },
    fechaProgramada: new Date('2026-09-22T12:00:00Z'), iniciadaAt: new Date('2026-09-22T12:05:00Z'),
    cerradaCampoAt: new Date('2026-09-22T13:45:00Z'), plazoRespuestaAt: new Date('2026-09-29T13:45:00Z'),
    createdAt: new Date('2026-09-22T11:00:00Z'), updatedAt: new Date('2026-09-22T14:00:00Z'),
    ubicacion: 'Planta de prueba · Mendoza (SIMULACIÓN)',
    observaciones: `OBSERVACION-DE-CAMPO-SIN-CONCLUSION. Se realizó un recorrido técnico ilustrativo y se documentó un hallazgo de prueba. Este expediente es una SIMULACIÓN para control visual del documento; no contiene datos ni fotografías reales.${variant === 'long' ? `\n\n${Array.from({ length: 5 }, () => narrative).join('\n\n')}` : ''}`,
    datosActa: {
      departamento: 'Godoy Cruz', calle: 'Calle de Prueba', numeroDomicilio: '100', atendidoPor: 'Responsable Demo',
      dniAtendido: '00.000.000', cargoAtendido: 'Responsable técnico', area: 'Fiscalización ambiental',
      motivoInspeccion: 'Inspección programada de demostración', lugarAfectacion: 'Sector de almacenamiento transitorio',
      infraestructura: 'SI', detalleInfraestructura: 'Representación vectorial del sector inspeccionado.', estadoInfraestructura: 'Requiere adecuación',
      generacion: 'Corriente demo de residuos peligrosos', actaAnterior: 'Sin antecedente real', requerimientos: 'Adecuar señalización y conservar constancias.',
      plazoDescargoDias: 5, danosEstado: 'NO_OBSERVADOS', danosDetalle: 'No se observaron daños; dato de simulación.',
      tercerosTestigosEstado: 'NO_IDENTIFICADOS', tercerosTestigosDetalle: 'No se identificaron terceros en la simulación.',
      libroOperacionesEstado: 'EXHIBIDO', libroOperacionesDetalle: 'Libro ilustrativamente exhibido y contrastado.',
      firmaIntervinienteEstado: 'FIRMADA', firmaIntervinienteDetalle: 'Constancia de demostración; la firma gráfica no se incorpora al PDF.',
      copiaActaEstado: 'ENTREGADA', copiaActaDetalle: 'Copia entregada en el flujo de demostración.', domicilioLegal: 'Calle Legal 123, Mendoza (SIMULACIÓN)',
      notificacionEstado: 'CONSTANCIA_FORMAL', notificacionDetalle: 'Constancia formal ilustrativa incorporada al portal SITREP.',
    },
    informeTecnico: variant === 'short' ? null : {
      expedienteElectronico: 'EX-DEMO-0001', objetivo: 'Evaluar el cumplimiento documentado durante una inspección sintética.',
      antecedentes: `Antecedente sintético sin datos personales. Documento generado para revisión de diseño. ${narrative}`,
      evaluacion: `Evaluación técnica ilustrativa; los resultados deben ser completados por personal competente. ${Array.from({ length: 4 }, () => narrative).join('\n\n')} FIN-EVALUACION-EXTENSA.`,
      conclusion: 'Conclusión técnica de demostración, validable por el área responsable.',
      recomendacion: 'Remitir junto con el acta para dictamen.',
    },
    comparaciones: [{ id: 'comparison-1', codigo: 'DOM-01', etiqueta: 'Domicilio', valorDeclarado: 'Mendoza', valorObservado: 'Mendoza', resultado: 'COINCIDE', observacion: 'Observación de simulación.', evidencias: [evidence[3]] }],
    items: [
      { id: 'item-1', codigo: 'SEG-01', etiqueta: 'Señalización visible', resultado: 'NO_CUMPLE', observacion: 'Falta señalización; hallazgo de demostración.', evidencias: [evidence[1], evidence[2]] },
      { id: 'item-2', codigo: 'LIB-01', etiqueta: 'Libro disponible', resultado: 'CUMPLE', observacion: 'Registro disponible en la simulación.', evidencias: [evidence[3]] },
    ],
    evidencias: evidence,
    eventos: [{ id: 'event-1', tipo: 'OBSERVACION', titulo: 'Relato ilustrativo del procedimiento', detalle: `Secuencia cronológica de demostración para QA del PDF.${variant === 'long' ? ` ${narrative}` : ''}`, canal: null, estadoEntrega: null, destinatario: null, createdAt: new Date('2026-09-22T13:30:00Z'), usuarioId: 'demo-inspector', usuario: { nombre: 'Inspectora', apellido: 'QA' }, adjuntos: [evidence[3]] }],
    intercambios: [{
      id: 'exchange-1', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', asunto: 'Requerimiento documental de demostración',
      cuerpo: 'Se solicita acompañar documentación respaldatoria dentro del plazo ilustrativo indicado.', plazoRespuestaAt: new Date('2026-09-29T15:00:00Z'),
      presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP', versionExpediente: 7, contenidoSha256: 'a'.repeat(64), hashAnterior: null,
      hashCadena: 'b'.repeat(64), autorId: 'demo-inspector', createdAt: new Date('2026-09-22T14:00:00Z'), autor: { nombre: 'Inspectora', apellido: 'QA', rol: 'ADMIN' }, adjuntos: [evidence[0]],
    }],
  };
}

async function renderPdf(render: (response: any) => Promise<void>, target: string) {
  const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
  stream.setHeader = () => undefined;
  const chunks: Buffer[] = [];
  stream.on('data', (chunk) => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<void>((resolve, reject) => { stream.on('finish', resolve); stream.on('error', reject); });
  await render(stream);
  await finished;
  fs.writeFileSync(target, Buffer.concat(chunks));
}

async function main() {
  const outputDir = process.env.SITREP_PDF_DEMO_OUTPUT
    ? path.resolve(process.env.SITREP_PDF_DEMO_OUTPUT)
    : fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-pdf-demos-'));
  const fixtureDir = path.join(outputDir, 'synthetic-evidence');
  const files = await makeEvidenceFiles(fixtureDir);
  fs.mkdirSync(outputDir, { recursive: true });
  const resolveEvidence = (key: string) => files.get(key) || path.join(fixtureDir, key);
  for (const variant of ['short', 'long'] as const) {
    const inspection = demoInspection(variant);
    for (const evidence of inspection.evidencias) {
      const bytes = fs.readFileSync(resolveEvidence(evidence.storageKey));
      evidence.bytes = bytes.length;
      evidence.sha256 = createHash('sha256').update(bytes).digest('hex');
    }
    const suffix = variant === 'short' ? 'corta' : 'extensa';
    await renderPdf((response) => streamInspectionActPdf(response, inspection, resolveEvidence), path.join(outputDir, `acta-inspeccion-${suffix}.pdf`));
    await renderPdf((response) => streamInspectionTechnicalReportPdf(response, inspection, resolveEvidence), path.join(outputDir, `informe-tecnico-${suffix}.pdf`));
  }
  console.log(`Demos generados en ${outputDir}`);
  console.log('Evidencia: SVG técnico renderizado a PNG, marcada SIMULACIÓN (no fotografía real).');
  console.log('QR demo: frontend local configurado por FRONTEND_URL (habitualmente http://localhost:5173).');
}

if (require.main === module) {
  void main().catch((error) => { console.error(error); process.exitCode = 1; });
}
