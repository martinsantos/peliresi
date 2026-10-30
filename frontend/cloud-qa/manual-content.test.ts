import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync, existsSync } from 'node:fs';
import { runInNewContext } from 'node:vm';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const root = new URL('../../docs/manual/', import.meta.url);

test('travel-duration monitoring documents explicit thresholds, periodic checks and their limits', () => {
  const manual = readFileSync(new URL('help-data.js', root), 'utf8');
  assert.match(manual, /Un viaje no tiene un plazo fijo automático/);
  assert.match(manual, /regla de Duración del viaje con un umbral explícito en horas/);
  assert.match(manual, /cada cinco minutos mientras el servicio funciona, incluso si no llegan puntos/);
  assert.match(manual, /transporte vinculado recibe el aviso si fue seleccionado, incluso si su dispositivo envió la ubicación/);
  assert.match(manual, /puede generar otro aviso después de 30 minutos/);
  assert.match(manual, /sus representantes autorizados reciben un aviso por persona/);
  assert.match(manual, /si se revoca o ya no incluye esa sede, oculta el contenido/);
  assert.match(manual, /no reconstruye avisos anteriores/);
  assert.match(manual, /seguimiento GPS actual no activa las reglas históricas de Desvío de ruta/i);
  assert.match(manual, /no con una ruta vial autorizada/i);
  assert.match(manual, /se desconoce cuándo las captó el teléfono y pueden ser anteriores/i);
  assert.match(manual, /observación de corredor compara tres posiciones recibidas del transporte original o de un mismo tramo de relevo/i);
  assert.match(manual, /Pueden haber sido captadas antes de su recepción/i);
  assert.match(manual, /La ausencia de aviso no garantiza que el trayecto sea correcto/i);
});
const read = (name: string) => readFileSync(new URL(name, root), 'utf8');
const context = { window: {} as any };
runInNewContext(read('help-data.js'), context);
const { profiles, guides } = context.window.SITREP_HELP;
test('inspection guidance distinguishes the saved act and its continued fields', () => {
  const text = JSON.stringify(guides);
  assert.match(text, /Otras descargas elegí Acta de inspección/i);
  assert.match(text, /versión guardada en el servidor/i);
  assert.match(text, /Los campos extensos continúan en páginas identificadas/i);
});
test('inspection guidance explains how to enlarge and close an evidence photograph', () => {
  const text = JSON.stringify(guides.find((g: any) => g.id === 'psip-flujo-inspecciones'));
  assert.match(text, /En Evidencias, elegí una miniatura para ampliar la fotografía/);
  assert.match(text, /Cerrala con Cerrar o Escape: volvés a la miniatura sin salir del expediente/);
  assert.match(text, /deslizá la barra inferior para ver más opciones/);
});
test('operational notices identify the target and recheck the representative activity and site', () => {
  const text = JSON.stringify(guides.find((g: any) => g.id === 'manifiestos-avisos'));
  assert.match(text, /incidente en tránsito avisa a la cuenta del operador/i);
  assert.match(text, /diferencia de pesaje mayor al 5 % avisa a la cuenta del generador/i);
  assert.match(text, /vuelve a comprobar la actividad y la sede autorizadas/i);
  assert.match(text, /no reemplaza el informe de hallazgo ni la adenda/i);
});
test('delivery guidance distinguishes the saved inbox from external channels and explains representative access', () => {
  const text = JSON.stringify(guides.find((g: any) => g.id === 'transportista-confirmar-entrega'));
  assert.match(text, /entrega confirmada deja avisos internos/);
  assert.match(text, /confirmación queda deshabilitada.*Reintentar guardado en el mismo diálogo/i);
  assert.match(text, /Reintentar la misma entrega no duplica esos avisos/);
  assert.match(text, /empresa, actividad y sede autorizadas/);
  assert.match(text, /aviso interno no confirma que se haya enviado correo o push/i);
});
test('current manual explains three in-situ approvals and complete treatment before a final certificate', () => {
  const proposals = JSON.stringify(guides.find((g: any) => g.id === 'manifiestos-tres-partes'));
  const certificates = JSON.stringify(guides.find((g: any) => g.id === 'certificados-operador-partes'));
  const notices = JSON.stringify(guides.find((g: any) => g.id === 'manifiestos-avisos'));
  const directory = read('directorio.html');
  assert.match(proposals, /transporte aprobador/);
  assert.match(proposals, /3 de 3 aprobaciones/);
  assert.doesNotMatch(proposals, /en origen sin transporte, 2 de 2/);
  assert.match(certificates, /la certificación final queda bloqueada hasta completar su tratamiento/);
  assert.match(notices, /En tratamiento en origen, el transporte también aprueba, pero no hay retiro, viaje ni GPS/);
  assert.match(directory, /En modalidad IN SITU también se elige un transporte aprobador/);
  assert.doesNotMatch(directory, /Si se elige modalidad IN SITU, el transportista no es requerido/);
  assert.match(directory, /el cierre del tratamiento no las emite automáticamente/i);
});
test('GPS guidance distinguishes device signal from server receipt and scopes the retry action', () => {
  const start = JSON.stringify(guides.find((g: any) => g.id === 'transportista-confirmar-retiro'));
  const recovery = JSON.stringify(guides.find((g: any) => g.id === 'resolver-gps'));
  assert.match(start, /la señal del dispositivo por sí sola no confirma/i);
  assert.match(start, /si la ubicación quedó sin actualizar o su hora no puede verificarse, usá Reintentar GPS/i);
  assert.match(start, /hora indicada en Enviado/i);
  const delivery = JSON.stringify(guides.find((g: any) => g.id === 'transportista-confirmar-entrega'));
  assert.match(delivery, /sólo se adjunta al incidente o la entrega si la lectura del dispositivo sigue siendo reciente al confirmar/i);
  assert.match(delivery, /podés continuar sin adjuntarla/i);
  assert.match(start, /no se garantiza el seguimiento al cerrar la app/i);
  assert.match(recovery, /En el detalle del viaje o en GPS de mis viajes, usá Reintentar GPS si aparece/);
  assert.match(recovery, /desplegá «Cómo habilitar la ubicación»/);
  assert.match(recovery, /Administración puede consultar el punto recibido desde Monitor/);
  assert.match(recovery, /la hora indica cuándo llegó a SITREP y el punto puede ser anterior/i);
  assert.match(recovery, /una entrega puede quedar guardada para enviarse al reconectar con la misma cuenta/i);
  assert.match(recovery, /no pudo comprobar si existe un relevo, reconectate/i);
  assert.match(recovery, /ubicaciones anteriores sin titular identificado se conservan para revisión/i);
  assert.match(recovery, /ubicaciones pendientes de otra cuenta o actividad en este navegador o app/i);
  assert.match(recovery, /versión anterior sin actividad identificada se conservan para revisión/i);
  assert.match(recovery, /otra pestaña mantiene abierto el seguimiento individual/i);
  assert.match(recovery, /copia del último viaje se guarda para la cuenta, actividad y empresa o establecimiento/i);
  assert.match(recovery, /si SITREP deniega el acceso, no se muestra la copia guardada/i);
  assert.match(recovery, /conserva el envío en este dispositivo hasta recibir una confirmación verificable/i);
  assert.match(recovery, /al reabrir, usá la misma cuenta y actividad/i);
  assert.match(recovery, /no confirmes una segunda entrega desde otro dispositivo/i);
  assert.match(recovery, /se intenta guardar la última lectura no enviada/i);
  assert.match(recovery, /falla la escritura y queda una ubicación sólo en memoria/i);
  assert.match(recovery, /volvé al mismo viaje, resolvé el almacenamiento y usá Reintentar guardado/i);
  assert.match(recovery, /un cierre forzado o ignorar el aviso puede perder esa ubicación/i);
  assert.match(recovery, /no comprueba otros dispositivos ni perfiles de navegador/i);
  assert.match(recovery, /otra ventana está sincronizando esa misma cuenta/i);
  assert.match(recovery, /si la espera supera diez segundos/i);
  assert.match(recovery, /misma cuenta, actividad y establecimiento/i);
  assert.match(recovery, /volvé al contexto en que la guardaste/i);
  assert.match(recovery, /entrega anterior de Transporte ya registró un error de autorización/i);
  assert.match(recovery, /cambios anteriores que no identifiquen su empresa/i);
  assert.match(recovery, /no se puede leer la copia local, aparece un error/i);
  assert.match(recovery, /no puede comprobar desde aquí lo que siga pendiente en otro dispositivo o perfil de navegador/i);
  assert.match(recovery, /no se puede verificar el viaje o el servidor/i);
  const monitor = JSON.stringify(guides.find((g: any) => g.id === 'monitor-viaje-vigente'));
  assert.match(monitor, /Monitor y Centro de Control/);
  assert.match(monitor, /hora de captura no está disponible/i);
  assert.match(monitor, /retiro no se cuenta como ubicación GPS/i);
  assert.match(monitor, /datos actuales del generador, que pueden haber cambiado/i);
  assert.match(monitor, /horas del historial usan la zona de Mendoza/i);
  assert.match(monitor, /líneas entre puntos no demuestran el trayecto/i);
  assert.match(monitor, /detalle de viaje es una instantánea del momento en que lo abriste/i);
  assert.match(monitor, /velocidad no se muestra hasta verificar la unidad/i);
  assert.match(monitor, /primer intento se guarda en este dispositivo con su referencia, sin guardar el enlace de acceso/i);
  assert.match(monitor, /se conserva sólo el primer intento pendiente por carga/i);
  assert.match(monitor, /si se renovó la autorización, abrí el enlace vigente/i);
  assert.match(monitor, /si no llegó y aún es reciente/i);
  assert.match(monitor, /el enlace revocado no funciona/i);
  assert.match(monitor, /otro dispositivo o perfil no comparte esta copia/i);
  assert.match(monitor, /alertas de velocidad, parada o pérdida de GPS usan el intervalo entre recepciones/i);
  assert.match(monitor, /mensajes anteriores conservan su texto y muestran una aclaración/i);
  const alerts = JSON.stringify(guides.find((g: any) => g.id === 'administrador-alertas-proactivas'));
  assert.match(alerts, /cuentas ADMIN activas reciben un aviso en la campana/i);
  assert.match(alerts, /no se repite el aviso de la misma clase y manifiesto/i);
  assert.match(alerts, /avisos anteriores faltantes no se reconstruyen automáticamente/i);
});
function jpegDimensions(bytes: Buffer): { width: number; height: number } {
  assert.equal(bytes.readUInt16BE(0), 0xffd8, 'JPEG signature');
  let index = 2;
  while (index + 8 < bytes.length) {
    assert.equal(bytes[index++], 0xff, 'JPEG marker');
    while (bytes[index] === 0xff) index++;
    const marker = bytes[index++];
    if (marker === 0xda || marker === 0xd9) break;
    if (marker === 0x01 || marker >= 0xd0 && marker <= 0xd7) continue;
    const size = bytes.readUInt16BE(index);
    assert.ok(size >= 2 && index + size <= bytes.length, 'JPEG segment');
    if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marker)) {
      return { height: bytes.readUInt16BE(index + 3), width: bytes.readUInt16BE(index + 5) };
    }
    index += size;
  }
  throw new Error('JPEG dimensions not found');
}
test('PSIP explains the existing follow-up loop for both parties without promising external delivery', () => {
  const guide = guides.find((item: any) => item.id === 'psip-flujo-inspecciones');
  assert.ok(guide); assert.ok(guide.steps.length >= 7);
  assert.deepEqual(Array.from(guide.audiences), ['administrador', 'inspector', 'generador', 'transportista', 'operador', 'auditor']);
  const content = JSON.stringify(guide);
  for (const text of ['Notificada', 'En descargo', 'Requiere subsanación', 'Cerrada conforme', 'los correos se simulan', 'push sigue apagado', 'fuera de plazo', 'responsable', 'CAP sigue cerrado']) assert.ok(content.includes(text), text);
  assert.match(content, /genera un aviso en la campana/);
  assert.match(content, /Leer el aviso no responde ni aprueba/);
  assert.ok(guide.steps.filter((step: any) => step.image).length >= 3);
});
test('PSIP screenshots are original synthetic preview captures from successful browser tests', () => {
  const proof = JSON.parse(read('psip-capture-provenance.json'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false); assert.equal(proof.edited, false);
  assert.equal(proof.files.length, 3); assert.equal(proof.browserTestsPassed, 18);
  const guide = guides.find((item: any) => item.id === 'psip-flujo-inspecciones');
  for (const item of proof.files) {
    const bytes = readFileSync(new URL('screenshots/' + item.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(bytes.readUInt32BE(16), item.width); assert.equal(bytes.readUInt32BE(20), item.height);
    const step = guide.steps.find((value: any) => value.image === 'screenshots/' + item.file);
    assert.ok(step); assert.match(step.caption, /Datos sintéticos/);
  }
});
test('simultaneous loads and device notices have unedited synthetic captures and distinct delivery semantics',()=>{
  const proof=JSON.parse(read('fleet-gps-capture-provenance.json'));
  assert.equal(proof.synthetic,true);assert.equal(proof.productionCapture,false);assert.equal(proof.edited,false);assert.equal(proof.browserTestsPassed,2);
  const loads=guides.find((g:any)=>g.id==='transporte-cargas-simultaneas'),notices=guides.find((g:any)=>g.id==='manifiestos-avisos');
  assert.equal(loads.steps.filter((s:any)=>s.image).length,2);
  assert.ok(notices.steps.some((s:any)=>s.image==='screenshots/mobile/device-notifications-20261019.png'));
  assert.match(JSON.stringify(loads),/las cargas ya elegidas/);assert.match(JSON.stringify(loads),/otras cargas siguen viajando/);
  assert.match(JSON.stringify(notices),/un aviso guardado no acredita una entrega externa/);
  for(const item of proof.files){const bytes=readFileSync(new URL('screenshots/'+item.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);}
});
test('handoff guide uses original synthetic captures and distinguishes delegated GPS from user access',()=>{
  const proof=JSON.parse(read('transport-handoff-capture-provenance.json'));
  assert.equal(proof.synthetic,true);assert.equal(proof.productionCapture,false);assert.equal(proof.edited,false);assert.equal(proof.gpsEmulated,true);
  const guide=guides.find((g:any)=>g.id==='transporte-relevo');assert.ok(guide);
  assert.equal(guide.steps.filter((s:any)=>s.image).length,3);
  assert.match(JSON.stringify(guide),/transportista del manifiesto original/);assert.match(JSON.stringify(guide),/No necesita una cuenta/);
  for(const item of proof.files){const bytes=readFileSync(new URL('screenshots/'+item.file,root));assert.equal(createHash('sha256').update(bytes).digest('hex'),item.sha256);assert.equal(bytes.readUInt32BE(16),item.width);assert.equal(bytes.readUInt32BE(20),item.height);}
});

test('new operational guides include relevant reusable captures, not text-only walkthroughs', () => {
  const minimums: Record<string, number> = {
    'capacitacion-por-rol': 5, 'alta-borradores-ocr': 4,
    'soporte-enviar-seguir': 3, 'soporte-gestionar': 3,
    'actor-mis-inspecciones': 3, 'inspector-completar-inspeccion': 7,
  };
  for (const [id, minimum] of Object.entries(minimums)) {
    const guide = guides.find((g: any) => g.id === id);
    assert.ok(guide.steps.filter((s: any) => s.image && s.alt).length >= minimum, id);
  }
  const provenance = JSON.parse(read('training-capture-provenance.json'));
  const replacement = JSON.parse(read('actor-onboarding-capture-provenance.json'));
  const requirementReplacement = JSON.parse(read('psip-actor-capture-provenance.json'));
  assert.equal(provenance.synthetic, true);
  assert.equal(provenance.productionCapture, false);
  assert.equal(provenance.edited, false);
  assert.equal(provenance.files.length, 13);
  for (const item of provenance.files) {
    const bytes = readFileSync(new URL('screenshots/' + item.file, root));
    assert.equal(createHash('sha256').update(bytes).digest('hex'), item.sha256);
    assert.equal(bytes.readUInt32BE(16), item.width);
    assert.equal(bytes.readUInt32BE(20), item.height);
    const steps = guides.flatMap((g: any) => g.steps).filter((s: any) => s.image === 'screenshots/' + item.file);
    const owner = replacement.supersedes.some((entry: any) => entry.file === item.file) ? replacement : requirementReplacement;
    const superseded = owner.supersedes.find((entry: any) => entry.file === item.file);
    if (superseded) {
      assert.equal(steps.length, 0, 'A superseded capture stays archived, without illustrating the current flow');
      assert.ok(owner.files.some((entry: any) => entry.file === superseded.replacement));
      assert.ok(guides.find((g: any) => g.id === superseded.guide).steps.some((s: any) => s.image === 'screenshots/' + superseded.replacement));
    } else assert.ok(steps.length, item.file + ' must be used');
    for (const step of steps) assert.match(step.caption, /Datos sintéticos/);
  }
});

test('actor inspection guide does not grant access to general inspections or authority decisions', () => {
  const guide = guides.find((g: any) => g.id === 'actor-mis-inspecciones');
  assert.deepEqual(Array.from(guide.audiences), ['generador', 'transportista', 'operador']);
  assert.match(JSON.stringify(guide), /No ve los borradores/);
  assert.match(JSON.stringify(guide), /no aprueba ni cierra/);
  assert.match(JSON.stringify(guide), /no habilita nuevas respuestas/);
  assert.match(JSON.stringify(guide), /no al módulo general de Inspecciones/);
  const proof = JSON.parse(read('psip-actor-capture-provenance.json'));
  assert.equal(proof.synthetic, true); assert.equal(proof.productionCapture, false);
  assert.equal(proof.edited, false); assert.equal(proof.physicalAndroid, false);
  assert.equal(proof.files.length, 3);
  for (const [index, file] of proof.files.entries()) {
    const bytes = readFileSync(new URL('screenshots/' + file.file, root));
    assert.equal(file.mime, 'image/jpeg'); assert.match(file.file, /\.jpg$/);
    assert.equal(createHash('sha256').update(bytes).digest('hex'), file.sha256);
    assert.deepEqual(jpegDimensions(bytes), { width: file.width, height: file.height });
    assert.equal(guide.steps[index].image, 'screenshots/' + file.file);
    assert.match(guide.steps[index].caption, /artificial/);
    assert.match(guide.steps[index].caption, /Android físico pendiente/);
  }
});

test('audit guidance separates certificate configuration from issuance and preserves the recorded wording', () => {
  const guide = guides.find((g: any) => g.id === 'auditor-consultar-actividad');
  const text = JSON.stringify(guide);
  for (const phrase of ['Gestión de certificados configurada', 'no que se emitió un documento',
    'Texto original registrado', 'columna Aclaración', 'búsqueda de texto se limita a la página visible',
    'CSV descarga sólo los registros visibles de la página actual']) assert.ok(text.includes(phrase), phrase);
});

test('certificate and addendum guides explain the approved rectification without erasing the observation', () => {
  const cert = JSON.stringify(guides.find((g: any) => g.id === 'certificados-operador-partes'));
  const adenda = JSON.stringify(guides.find((g: any) => g.id === 'adendas-hallazgos-partes'));
  assert.ok(cert.includes('Una rectificación aprobada resuelve la observación'));
  assert.ok(cert.includes('Otras adendas pendientes o rechazadas siguen requiriendo resolución'));
  assert.ok(adenda.includes('la observación anterior deja de bloquear la certificación final'));
  assert.ok(adenda.includes('queda como antecedente observado'));
});
test('certificate guide distinguishes an approved finding from an explicitly treated quantity', () => {
  const cert = JSON.stringify(guides.find((g: any) => g.id === 'certificados-operador-partes'));
  assert.ok(cert.includes('sólo si efectivamente la trataste'));
  assert.ok(cert.includes('completá el tratamiento e indicá el total efectivamente tratado'));
  assert.ok(cert.includes('la certificación final queda bloqueada hasta completar su tratamiento'));
  assert.ok(cert.includes('La firma registra tu decisión'));
});

test('public trial screenshot is unedited, anonymous and explicitly separate from an actual application', () => {
  const p = JSON.parse(read('registration-capture-provenance.json'));
  assert.equal(p.authenticated, false); assert.equal(p.synthetic, true);
  assert.equal(p.businessDataWritten, false); assert.equal(p.edited, false);
  const bytes = readFileSync(new URL('screenshots/' + p.file, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256);
  assert.equal(bytes.readUInt32BE(16), p.width); assert.equal(bytes.readUInt32BE(20), p.height);
  const step = guides.find((g: any) => g.id === 'alta-borradores-ocr').steps[0];
  assert.equal(step.image, 'screenshots/' + p.file);
  assert.match(step.caption, /Datos sintéticos/); assert.match(step.alt, /Prueba sin envío/);
});

test('OCR evidence is an unedited real trial with synthetic data, not approval or persistent upload', () => {
  const p = JSON.parse(read('ocr-capture-provenance.json'));
  assert.equal(p.flowStatus, 'PASS');
  assert.equal(p.synthetic, true); assert.equal(p.edited, false);
  assert.equal(p.businessDataWritten, false); assert.equal(p.persistido, false);
  assert.equal(p.authenticated, false); assert.equal(p.ocr, 'TESSERACT');
  assert.equal(p.draftRecovered, true);
  const bytes = readFileSync(new URL('screenshots/' + p.file, root));
  assert.equal(createHash('sha256').update(bytes).digest('hex'), p.sha256);
  assert.equal(bytes.readUInt32BE(16), p.width); assert.equal(bytes.readUInt32BE(20), p.height);
  // The 2026-10-12 licence image is retained as historical evidence; the
  // current guide illustrates the separately verified synthetic bill instead.
  const step = guides.find((g: any) => g.id === 'alta-borradores-ocr').steps.find((s: any) => s.title === 'Cargar documentos y revisar OCR');
  assert.ok(step);
  assert.match(step.caption, /Factura artificial/);
  assert.match(step.alt, /Factura eléctrica/);
  const current = JSON.parse(read('electricity-capture-provenance.json'));
  assert.equal(current.synthetic, true); assert.equal(current.productionCapture, false);
  assert.equal(current.edited, false); assert.equal(current.physicalAndroid, false);
  const currentBytes = readFileSync(new URL('screenshots/' + current.file, root));
  assert.equal(current.mime, 'image/jpeg'); assert.match(current.file, /\.jpg$/);
  assert.equal(createHash('sha256').update(currentBytes).digest('hex'), current.sha256);
  assert.deepEqual(jpegDimensions(currentBytes), { width: current.width, height: current.height });
  assert.equal(step.image, 'screenshots/' + current.file);
});

test('guides have unique identities, useful steps and existing evidence', () => {
  assert.equal(new Set(guides.map((g: any) => g.id)).size, guides.length);
  for (const guide of guides) {
    assert.ok(profiles.some((p: any) => p.id === guide.profile));
    for (const audience of guide.audiences || []) assert.ok(profiles.some((p: any) => p.id === audience));
    if (guide.id === 'documentos-identidad-integridad') assert.ok(guide.steps.length >= 2, guide.id);
    else assert.ok(guide.steps.length >= 3, guide.id);
    for (const step of guide.steps) {
      assert.ok(step.title && step.expected && step.body.length, guide.id);
      if (step.image) assert.ok(existsSync(fileURLToPath(new URL(step.image, root))), step.image);
    }
  }
});

test('images displayed in the manual use an extension matching their file contents', () => {
  const sources = new Set<string>();
  for (const guide of guides) for (const step of guide.steps) if (step.image) sources.add(step.image);
  for (const match of read('directorio.html').matchAll(/<img\s+src="(screenshots\/[^"]+)"/g)) sources.add(match[1]);
  for (const source of sources) {
    const bytes = readFileSync(new URL(source, root));
    if (bytes.readUInt16BE(0) === 0xffd8) assert.match(source, /\.jpe?g$/i, source + ' contains JPEG');
    else if (bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))) assert.match(source, /\.png$/i, source + ' contains PNG');
    else if (bytes.toString('ascii', 0, 4) === 'RIFF' && bytes.toString('ascii', 8, 12) === 'WEBP') assert.match(source, /\.webp$/i, source + ' contains WebP');
    else assert.fail(source + ' is not a recognized manual image');
  }
});

test('MIME aliases preserve the original evidence bytes and replace active references', () => {
  const aliases = JSON.parse(read('image-mime-aliases-20261027.json'));
  assert.equal(aliases.syntheticCapturesUnchanged, true);
  assert.ok(aliases.files.length > 0);
  assert.equal(new Set(aliases.files.map((file: any) => file.previous)).size, aliases.files.length);
  const active = read('help-data.js') + read('directorio.html');
  for (const file of aliases.files) {
    const old = readFileSync(new URL(file.previous, root));
    const current = readFileSync(new URL(file.current, root));
    assert.match(file.previous, /\.png$/); assert.match(file.current, /\.jpg$/);
    assert.equal(current.readUInt16BE(0), 0xffd8);
    assert.ok(old.equals(current), file.previous);
    assert.equal(createHash('sha256').update(current).digest('hex'), file.sha256);
    assert.ok(active.includes(file.current.replace(/^screenshots\//, '')), file.current);
    assert.ok(!active.includes(file.previous.replace(/^screenshots\//, '')), file.previous);
  }
});

test('training, registration, support and migration are searchable, with safety boundaries', () => {
  for (const id of ['capacitacion-por-rol', 'alta-borradores-ocr', 'soporte-enviar-seguir', 'soporte-gestionar', 'cambio-dominio']) {
    const guide = guides.find((g: any) => g.id === id);
    assert.ok(guide, id);
    assert.ok(guide.safety, id);
  }
  const registration = guides.find((g: any) => g.id === 'alta-borradores-ocr');
  assert.ok(registration.audiences.includes('transportista'));
  assert.match(JSON.stringify(registration), /archivos.*no|no.*archivos/i);
  const support = guides.find((g: any) => g.id === 'soporte-enviar-seguir');
  assert.ok(support.keywords.includes('ticket'));
  const migration = JSON.stringify(guides.find((g: any) => g.id === 'cambio-dominio'));
  assert.match(migration, /sitrep\.mendoza\.gov\.ar/);
  assert.match(migration, /no se trasladan automáticamente/);
});

test('manual operational links remain on the installation origin, including the future domain', () => {
  for (const name of ['index.html', 'search.html', 'tutorial.html', 'directorio.html']) {
    const html = read(name);
    for (const match of html.matchAll(/href="([^"]+)"/g)) {
      const href = match[1];
      assert.doesNotMatch(href, /https?:\/\/(?:rptrazar\.mendoza\.gov\.ar|sitrep\.ultimamilla\.com\.ar|sitrep\.mendoza\.gov\.ar)/, name);
      if (/^(?:https?:|mailto:|tel:|#)/.test(href)) continue;
      for (const origin of ['https://sitrep.ultimamilla.com.ar', 'https://sitrep.mendoza.gov.ar']) {
        assert.equal(new URL(href, `${origin}/manual/${name}`).origin, origin);
      }
    }
  }
});

test('training does not present another server dataset or destructive resets as current instructions', () => {
  const html = read('directorio.html');
  const training = html.split('<section id="capacitacion-qa"')[1].split('</section>')[0];
  assert.doesNotMatch(training, /CAP-20260923|resetear|9\/9/i);
  assert.match(training, /solo lectura/i);
  assert.doesNotMatch(html, /href="[^"]*cmuegqi/);
  assert.doesNotMatch(html, /<td>Texto libre<\/td>/);
});

test('classroom records keep five teams and distinct actor/authority views', () => {
  const workshop = guides.find((g: any) => g.id === 'capacitacion-por-rol');
  assert.equal(workshop.steps.length, 6);
  assert.match(workshop.steps[0].body.join(' '), /enlaces no inician sesión ni cambian el rol/);
  assert.match(workshop.steps[0].body.join(' '), /Equipo 5: reserva/);
  assert.match(workshop.steps[2].body.join(' '), /número conserva/);
  for (const index of [2, 3, 4]) {
    assert.equal(workshop.steps[index].teams.length, 5);
    for (const [i, team] of workshop.steps[index].teams.entries()) {
      const n = i + 1;
      assert.equal(team.label, 'Equipo ' + n);
      for (const r of team.records) assert.match(r.path, new RegExp('cap-20261012-(?:manifiesto-' + n + '-|inspeccion-' + n + '-|participacion-' + n + '-|ticket-(?:generador|transportista|operador)-' + n + '$)'));
      if (index === 2) assert.deepEqual(Array.from(team.records, (r: any) => r.path), ['BORRADOR', 'APROBADO', 'TRATADO'].map(s => '/manifiestos/cap-20261012-manifiesto-' + n + '-' + s));
      if (index === 3) {
        assert.equal(team.records[0].path, '/inspecciones/cap-20261012-inspeccion-' + n + '-GENERADOR');
        for (const role of ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR']) {
          const id = 'cap-20261012-participacion-' + n + '-' + role + '-abierta';
          assert.ok(team.records.some((r: any) => r.path === '/requerimientos/' + id));
          assert.ok(team.records.some((r: any) => r.path === '/inspecciones/' + id));
          assert.ok(!team.records.some((r: any) => r.path === '/mis-inspecciones/' + id));
        }
      }
    }
  }
});

test('all classroom links remain on the current/future domain; trial stays trial', () => {
  const workshop = guides.find((g: any) => g.id === 'capacitacion-por-rol');
  const resources = workshop.steps.flatMap((s: any) => [...(s.resources || []), ...(s.teams || []).flatMap((t: any) => t.records)]);
  assert.equal(resources.length, 76);
  assert.equal(resources.filter((r: any) => r.href === '/manual/tutorial.html?guide=capacitacion-cuatro-telefonos').length, 1);
  for (const r of resources) {
    const href = r.path || r.href;
    assert.match(href, /^\/(?!\/)[a-zA-Z0-9/?=&._-]+$/);
    for (const origin of ['https://sitrep.ultimamilla.com.ar', 'https://sitrep.mendoza.gov.ar']) {
      assert.equal(new URL(href, origin).origin, origin);
      if (r.path) assert.equal(new URL('/app' + href, origin).origin, origin);
    }
    if (href.startsWith('/inscripcion/')) assert.equal(new URL(href, 'https://example.invalid').searchParams.get('modo'), 'revision');
  }
  const fixture = resources.find((r: any) => r.download);
  assert.equal(fixture.href, '/manual/fixtures/licencia-capacitacion.png');
  assert.ok(existsSync(fileURLToPath(new URL('fixtures/licencia-capacitacion.png', root))));
});


test('classroom new features explain incomplete identities, registered fleet and preserved declarations', () => {
  const guide = guides.find((g: any) => g.id === 'capacitacion-novedades');
  assert.equal(guide.steps.length, 4);
  assert.match(guide.safety, /siguen apagadas en la operación real/);
  assert.match(JSON.stringify(guide), /no inventes datos/i);
  assert.match(JSON.stringify(guide), /otra.*conserva el antecedente/);
  assert.match(JSON.stringify(guide), /no se aprueba a sí mismo/);
  assert.match(JSON.stringify(guide), /no se reemplazan|elegilas otra vez/);
  assert.equal(guide.steps[0].resources[0].path, '/switch-user?modo=capacitacion');
  assert.match(read('index.html'), /guide=capacitacion-novedades/);
});


test('four phones retain their roles and follow one new case through GPS and closure', () => {
  const guide = guides.find((g: any) => g.id === 'capacitacion-cuatro-telefonos');
  assert.equal(guide.steps.length, 7);
  assert.match(guide.safety, /No se necesita la cuenta administradora personal/);
  assert.match(guide.steps[0].body.join(' '), /perfiles de navegador independientes/);
  assert.match(guide.steps[0].body.join(' '), /no certifica GPS físico/);
  assert.match(guide.steps[2].body.join(' '), /Sync/);
  assert.match(guide.steps[3].body.join(' '), /Hoy → Viajes Activos/);
  assert.match(guide.steps[5].body.join(' '), /Los cuatro deben ver Tratado/);
  assert.match(read('index.html'), /guide=capacitacion-cuatro-telefonos/);
});


test('classroom new proposals separate authorship, three decisions, agenda and signed releases', () => {
  const guide=guides.find((g:any)=>g.id==='capacitacion-cuatro-telefonos');
  const text=JSON.stringify(guide);
  assert.match(text,/Puede iniciar cualquiera: operador, transporte, generador o administrador CAP/);
  assert.match(text,/Sólo con las tres aprobaciones/);
  assert.match(text,/Manifiestos pendientes/);
  assert.match(text,/Por aprobar, En espera o En curso/);
  assert.match(text,/Iniciar coordinación/);
  assert.match(text,/Activar sonido/);
  assert.match(text,/Tratado no libera automáticamente/);
  assert.match(text,/las adendas resueltas/);
  assert.match(text,/CAPACITACIÓN — SIN VALIDEZ OFICIAL/);
});
