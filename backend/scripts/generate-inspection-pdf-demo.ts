import fs from 'fs';
import path from 'path';
import { streamInspectionActPdf } from '../src/services/inspectionActPdf.service';

async function main() {
  const output = path.resolve('..', 'output/pdf/acta-inspeccion-demo-I-2026-000002.pdf');
  fs.mkdirSync(path.dirname(output), { recursive: true });
  const photoPath = path.resolve('assets/inspection-demo/almacenamiento-sintetico-demo.png');
  const now = new Date();
  const raw = [
    ['Identidad', 'Razón social', 'ALFA SERVICE', 'ALFA SERVICE', 'COINCIDE', ''],
    ['Identidad', 'CUIT', '30-71123596-1', '30-71123596-1', 'COINCIDE', ''],
    ['Habilitación', 'Número de habilitación', 'T-000005', 'T-000008', 'DIFIERE', 'La constancia exhibida presenta un número distinto.'],
    ['Habilitación', 'Vencimiento de habilitación', '21/05/2027', '21/05/2027', 'COINCIDE', ''],
    ['Residuos', 'Corrientes autorizadas', 'Y8, Y9, Y12', 'Y8, Y9, Y12', 'COINCIDE', ''],
    ['Flota', 'Vehículos activos declarados', 'NSN-936 · habilitación V-102', 'NSN-936 · habilitación V-102', 'COINCIDE', ''],
    ['Flota', 'Conductores activos declarados', '2 conductores habilitados', 'Se verificó 1 de 2', 'NO_VERIFICADO', 'Un conductor no se encontraba presente.'],
  ];
  const comparisons = raw.map((row, index) => ({ id: String(index), codigo: `DEMO-${index}`, categoria: row[0], etiqueta: row[1], origen: 'demo', valorDeclarado: row[2], valorObservado: row[3], resultado: row[4], observacion: row[5], orden: index, evidencias: [] }));
  const labels = ['Cuenta con habilitación vigente', 'Actividad coincide con la autorizada', 'Rótulos reglamentarios visibles', 'Exhibe documentación respaldatoria', 'Registros completos y actualizados', 'EPP disponible y en uso', 'Elementos de emergencia operativos', 'Documentación coincide con SITREP', 'Vehículos coinciden con SITREP', 'Conductores habilitados', 'Carga y contingencia adecuadas'];
  const items = labels.map((etiqueta, index) => ({ id: `it${index}`, etiqueta, resultado: index === 2 ? 'NO_CUMPLE' : 'CUMPLE', observacion: index === 2 ? 'Un rótulo requiere reposición.' : '' }));
  const evidence = { id: 'ev1', tipo: 'FOTO', nombreOriginal: 'almacenamiento-sintetico-demo.png', storageKey: 'demo', mimeDetectado: 'image/png', bytes: 1234, descripcion: 'Área de almacenamiento transitorio. Evidencia sintética para capacitación.', capturadaAt: now, createdAt: now };
  const events = [
    { id: 'e1', tipo: 'CREADA', titulo: 'Inspección creada', detalle: 'Expediente asignado al inspector.', visibleActor: false, canal: 'SISTEMA', createdAt: new Date(now.getTime() - 86400000 * 4), usuario: { nombre: 'Inspector', apellido: 'Demo' }, adjuntos: [] },
    { id: 'e2', tipo: 'EVIDENCIA_AGREGADA', titulo: 'Evidencia de campo agregada', detalle: 'Se incorporó registro fotográfico.', visibleActor: false, canal: 'SISTEMA', createdAt: new Date(now.getTime() - 86400000 * 3), usuario: { nombre: 'Inspector', apellido: 'Demo' }, adjuntos: [evidence] },
    { id: 'e3', tipo: 'CAMBIO_ESTADO', titulo: 'Enviada a revisión', detalle: 'Checklist y contraste completos.', visibleActor: false, canal: 'SISTEMA', createdAt: new Date(now.getTime() - 86400000 * 2), usuario: { nombre: 'Inspector', apellido: 'Demo' }, adjuntos: [] },
    { id: 'e4', tipo: 'NOTIFICACION_PREPARADA', titulo: 'Notificación preparada', detalle: 'Solicitud de corrección preparada para el actor.', visibleActor: true, canal: 'EMAIL', estadoEntrega: 'NO_ENVIADO', destinatario: 'demo-no-enviar@example.invalid', createdAt: new Date(now.getTime() - 86400000), usuario: { nombre: 'Administración', apellido: 'Demo' }, adjuntos: [] },
    { id: 'e5', tipo: 'RESPUESTA_ACTOR', titulo: 'Respuesta del actor', detalle: 'Se adjunta descargo y constancia actualizada.', visibleActor: true, canal: 'PORTAL_ACTOR', createdAt: now, usuario: { nombre: 'Actor', apellido: 'Demo' }, adjuntos: [{ ...evidence, id: 'doc1', tipo: 'DOCUMENTO', nombreOriginal: 'descargo-habilitacion-demo.pdf' }] },
  ];
  const inspection = { numero: 'I-2026-000002', numeroActa: 'DEMO-INS-TRA-001', estado: 'EN_REVISION', tipoActor: 'TRANSPORTISTA', ubicacion: 'San Martín, Mendoza', fechaProgramada: now, iniciadaAt: new Date(now.getTime() - 7200000), observaciones: 'Se verificaron las condiciones generales de operación. Se requiere subsanar la identificación documental de la habilitación y reponer un rótulo deteriorado.', inspector: { nombre: 'Inspector', apellido: 'Demo' }, transportista: { razonSocial: 'ALFA SERVICE', cuit: '30-71123596-1', domicilio: 'Mendoza' }, generador: null, operador: null, comparaciones: comparisons, items, evidencias: [evidence], eventos: events };
  const out = fs.createWriteStream(output) as fs.WriteStream & { setHeader: () => void };
  out.setHeader = () => undefined;
  const finished = new Promise<void>((resolve, reject) => { out.on('finish', resolve); out.on('error', reject); });
  await streamInspectionActPdf(out as any, inspection, () => photoPath);
  await finished;
  console.log(output);
}

main().catch((error) => { console.error(error); process.exit(1); });
