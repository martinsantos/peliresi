import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { mkdir, writeFile } from 'node:fs/promises';
import { PassThrough } from 'node:stream';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { assertCloudDatabase, backendRequire } from './safety.ts';

await assertCloudDatabase();
const out = '/work/sitrep/.qa-inspection-pdf-extent-20261030';
assert.equal(process.env.QA_ARTIFACTS, out);
assert.equal(process.env.DISABLE_EMAILS, 'true');
assert.equal(process.env.PUSH_MANIFEST_NOTICES_ENABLED, 'false');
assert.equal(process.env.TRAINING_DIRECT_LOGIN_UNTIL, '2000-01-01T00:00:00Z');
const corrected = process.env.QA_PDF_CANDIDATE === '1';
const destination = corrected ? path.join(out, 'corrected-release') : out;
await mkdir(destination, { recursive: true });
const { streamInspectionActPdf } = backendRequire(corrected
  ? path.join(out, 'compiled/services/inspectionFieldActPdf.service.js')
  : './dist/services/inspectionFieldActPdf.service.js');
const { streamInspectionTechnicalReportPdf } = backendRequire('./dist/services/inspectionActPdf.service.js');
const paragraph = (prefix: string, repeat: number) =>
  `${prefix}-INICIO ${'Datos artificiales de constatación y seguimiento para verificar el contenido completo. '.repeat(repeat)} ${prefix}-FINAL`;
const inspection = {
  id: 'qa-inspection-long-document', numero: 'QA-INSPECCION-LARGA', numeroActa: 'QA-ACTA-LARGA', version: 2,
  tipoActor: 'GENERADOR', estado: 'EN_REVISION', inspectorId: 'qa-inspector',
  inspector: { nombre: 'Inspectora', apellido: 'Prueba' },
  generador: { id: 'qa-generator', razonSocial: 'QA Empresa de prueba sin datos reales',
    cuit: '30-00000000-0', domicilio: 'QA Calle de prueba 100', telefono: '0000000', email: 'pdf@night-qa.invalid' },
  fechaProgramada: new Date('2026-10-20T12:00:00Z'), iniciadaAt: new Date('2026-10-20T12:05:00Z'),
  createdAt: new Date('2026-10-20T11:00:00Z'), updatedAt: new Date('2026-10-20T14:00:00Z'),
  ubicacion: 'Establecimiento artificial', observaciones: paragraph('QA-OBSERVACION', 38),
  datosActa: { departamento: 'Godoy Cruz', calle: 'Calle de prueba', numeroDomicilio: '100',
    atendidoPor: 'Responsable de prueba', cargoAtendido: 'Responsable técnico', area: 'Residuos Peligrosos',
    motivoInspeccion: paragraph('QA-MOTIVO', 7), lugarAfectacion: 'Sector de almacenamiento',
    infraestructura: 'SI', estadoInfraestructura: 'Requiere adecuación',
    requerimientos: paragraph('QA-REQUERIMIENTO', 8), plazoDescargoDias: 5,
    danosEstado: 'NO_OBSERVADOS', tercerosTestigosEstado: 'NO_IDENTIFICADOS', libroOperacionesEstado: 'EXHIBIDO',
    firmaIntervinienteEstado: 'NEGATIVA', firmaIntervinienteDetalle: 'Se registró la negativa de prueba.',
    copiaActaEstado: 'PENDIENTE', domicilioLegal: 'QA Calle legal 123', notificacionEstado: 'NO_REALIZADA',
    notificacionDetalle: 'No se realizó comunicación en esta prueba.' },
  informeTecnico: { objetivo: paragraph('QA-OBJETIVO', 10), antecedentes: paragraph('QA-ANTECEDENTE', 10),
    evaluacion: paragraph('QA-EVALUACION', 10), conclusion: paragraph('QA-CONCLUSION', 10),
    recomendacion: paragraph('QA-RECOMENDACION', 10) },
  comparaciones: [], items: [{ id: 'qa-item', codigo: 'QA-001', etiqueta: 'Señalización visible',
    resultado: 'NO_CUMPLE', observacion: 'Observación artificial para probar paginación.', evidencias: [] }],
  evidencias: [], eventos: [],
};
async function generate(name: string, renderer: (response: any, value: any, resolve: any) => Promise<void>) {
  const stream = new PassThrough() as PassThrough & { setHeader: (name: string, value: string) => void };
  const headers = new Map<string, string>(), chunks: Buffer[] = [];
  stream.setHeader = (name, value) => { headers.set(name, value); };
  stream.on('data', chunk => chunks.push(Buffer.from(chunk)));
  const finished = new Promise<void>((resolve, reject) => { stream.once('finish', resolve); stream.once('error', reject); });
  await renderer(stream, inspection, () => { throw new Error('Unexpected file access'); });
  await finished;
  const body = Buffer.concat(chunks), file = path.join(destination, name + '.pdf');
  assert.equal(headers.get('Content-Type'), 'application/pdf');
  assert.equal(body.subarray(0, 4).toString(), '%PDF');
  await writeFile(file, body);
  const info = execFileSync('pdfinfo', [file], { encoding: 'utf8' });
  const pages = Number(info.match(/^Pages:\s+(\d+)/m)?.[1]);
  assert.ok(pages >= 2);
  const textFile = path.join(destination, name + '.txt');
  execFileSync('pdftotext', ['-layout', file, textFile]);
  execFileSync('pdftoppm', ['-r', '90', '-png', file, path.join(destination, name)]);
  return { name, pages, sha256: createHash('sha256').update(body).digest('hex') };
}
const documents = [];
documents.push(await generate('acta', streamInspectionActPdf));
documents.push(await generate('informe', streamInspectionTechnicalReportPdf));
await writeFile(path.join(destination, 'probe.json'), JSON.stringify({ synthetic: true, controllerNotUsed: true,
  production: false, corrected, documents }, null, 2));
console.log(JSON.stringify({ synthetic: true, documents }));
