/**
 * Reproducible visual fixtures for the two inspection PDFs.
 *
 * The evidence is a technical SVG rendered to PNG by sharp. It is deliberately
 * labelled SIMULACIÓN and is not presented as a real photograph.
 *
 * Run from backend/:
 *   npx ts-node scripts/generate-inspection-pdf-demos.ts
 */
import fs from 'fs';
import path from 'path';
import { PassThrough } from 'stream';
import sharp from 'sharp';
import { streamInspectionTechnicalReportPdf } from '../src/services/inspectionActPdf.service';
import { streamInspectionActPdf } from '../src/services/inspectionFieldActPdf.service';

const repoRoot = path.resolve(__dirname, '../..');
const outputDir = path.join(repoRoot, 'output', 'pdf');
const fixtureDir = path.join(repoRoot, 'tmp', 'inspection-pdf-demo');

function technicalSvg(index: number): string {
  const label = `LÁMINA E-${String(index).padStart(3, '0')}`;
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

async function makeEvidenceFiles(): Promise<Map<string, string>> {
  fs.mkdirSync(fixtureDir, { recursive: true });
  const paths = new Map<string, string>();
  for (let index = 1; index <= 8; index += 1) {
    const key = `demo-evidence-${index}.png`;
    const target = path.join(fixtureDir, key);
    await sharp(Buffer.from(technicalSvg(index))).png().toFile(target);
    paths.set(key, target);
  }
  return paths;
}

function demoInspection(imageKeys: string[]) {
  const evidence = imageKeys.map((storageKey, index) => ({
    id: `evidence-${index + 1}`,
    tipo: 'FOTO',
    nombreOriginal: `evidencia-ilustrativa-${String(index + 1).padStart(2, '0')}.png`,
    storageKey,
    mimeDetectado: 'image/png',
    bytes: 0,
    sha256: `${String(index + 1)}${'a'.repeat(63)}`,
    capturadaAt: new Date(`2026-09-22T13:${String(index).padStart(2, '0')}:00Z`),
    createdAt: new Date(`2026-09-22T13:${String(index + 1).padStart(2, '0')}:00Z`),
    creadoPorId: 'demo-inspector',
    creadoPor: { nombre: 'Inspectora', apellido: 'QA' },
    itemId: index < 2 ? 'item-1' : null,
    descripcion: `Representación vectorial SIMULACIÓN ${index + 1}; no constituye una fotografía real.`,
    transcripcion: null,
    anuladaAt: null,
    anuladaPorId: null,
    anuladaPor: null,
    motivoAnulacion: null,
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
    observaciones: 'Se realizó un recorrido técnico ilustrativo y se documentó un hallazgo de prueba. Este expediente es una SIMULACIÓN para control visual del documento; no contiene datos ni fotografías reales.',
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
    informeTecnico: {
      expedienteElectronico: 'EX-DEMO-0001', objetivo: 'Evaluar el cumplimiento documentado durante una inspección sintética.',
      antecedentes: 'Antecedente sintético sin datos personales. Documento generado para revisión de diseño.',
      evaluacion: 'Evaluación técnica ilustrativa; los resultados deben ser completados por personal competente.',
      conclusion: 'Conclusión técnica de demostración, validable por el área responsable.',
      recomendacion: 'Remitir junto con el acta para dictamen.',
    },
    comparaciones: [{ id: 'comparison-1', codigo: 'DOM-01', etiqueta: 'Domicilio', valorDeclarado: 'Mendoza', valorObservado: 'Mendoza', resultado: 'COINCIDE', observacion: 'Observación de simulación.', evidencias: [] }],
    items: [
      { id: 'item-1', codigo: 'SEG-01', etiqueta: 'Señalización visible', resultado: 'NO_CUMPLE', observacion: 'Falta señalización; hallazgo de demostración.', evidencias: evidence.slice(0, 2) },
      { id: 'item-2', codigo: 'LIB-01', etiqueta: 'Libro disponible', resultado: 'CUMPLE', observacion: 'Registro disponible en la simulación.', evidencias: evidence.slice(2, 3) },
    ],
    evidencias: evidence,
    eventos: [{ id: 'event-1', tipo: 'OBSERVACION', titulo: 'Relato ilustrativo del procedimiento', detalle: 'Secuencia cronológica de demostración para QA del PDF.', canal: null, estadoEntrega: null, destinatario: null, createdAt: new Date('2026-09-22T13:30:00Z'), usuarioId: 'demo-inspector', usuario: { nombre: 'Inspectora', apellido: 'QA' }, adjuntos: [] }],
    intercambios: [{
      id: 'exchange-1', secuencia: 1, tipo: 'REQUERIMIENTO', parte: 'AUTORIDAD', asunto: 'Requerimiento documental de demostración',
      cuerpo: 'Se solicita acompañar documentación respaldatoria dentro del plazo ilustrativo indicado.', plazoRespuestaAt: new Date('2026-09-29T15:00:00Z'),
      presentadoFueraDePlazo: false, canal: 'PORTAL_SITREP', versionExpediente: 7, contenidoSha256: 'a'.repeat(64), hashAnterior: null,
      hashCadena: 'b'.repeat(64), autorId: 'demo-inspector', createdAt: new Date('2026-09-22T14:00:00Z'), autor: { nombre: 'Inspectora', apellido: 'QA', rol: 'ADMIN' }, adjuntos: [evidence[2]],
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
  const files = await makeEvidenceFiles();
  const inspection = demoInspection([...files.keys()]);
  fs.mkdirSync(outputDir, { recursive: true });
  const resolveEvidence = (key: string) => files.get(key) || path.join(fixtureDir, key);
  await renderPdf((response) => streamInspectionActPdf(response, inspection, resolveEvidence), path.join(outputDir, 'acta-inspeccion-demostracion.pdf'));
  await renderPdf((response) => streamInspectionTechnicalReportPdf(response, inspection, resolveEvidence), path.join(outputDir, 'informe-tecnico-inspeccion-demostracion.pdf'));
  console.log(`Demos generados en ${outputDir}`);
  console.log('Evidencia: SVG técnico renderizado a PNG, marcada SIMULACIÓN (no fotografía real).');
  console.log('QR demo: frontend local configurado por FRONTEND_URL (habitualmente http://localhost:5173).');
}

void main().catch((error) => { console.error(error); process.exitCode = 1; });
