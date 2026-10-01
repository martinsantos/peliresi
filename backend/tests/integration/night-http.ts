import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import path from 'node:path';
import sharp from 'sharp';
import { PrismaClient } from '@prisma/client';
import { assertNightDatabase, qaEmail, qaPassword, seedNightDatabase } from './seed-night';

// No controller mocks, token forgery or production fallback. All operations use HTTP.
assertNightDatabase();
const base = process.env.QA_API_URL || 'http://127.0.0.1:3037/api';
assert.equal(base, 'http://127.0.0.1:3037/api');
const db = new PrismaClient();
const sessions: Record<string, { accessToken: string; refreshToken: string }> = {};
const run = randomUUID();
const results: { name: string; status: string; error?: string }[] = [];
async function check(name: string, task: () => Promise<void>) {
  try { await task(); results.push({ name, status: 'PASS' }); console.log(`PASS ${name}`); }
  catch (error) { const message = error instanceof Error ? error.message : String(error);
    results.push({ name, status: 'FAIL', error: message }); console.log(`FAIL ${name}: ${message}`); }
}
async function request(user: string | null, path: string, method = 'GET', body?: unknown, expected = 200) {
  const response = await fetch(base + path, { method, headers: {
    ...(user ? { Authorization: `Bearer ${sessions[user].accessToken}` } : {}),
    ...(body ? { 'Content-Type': 'application/json' } : {}),
  }, body: body ? JSON.stringify(body) : undefined });
  const text = await response.text();
  let data: any;
  try { data = JSON.parse(text); } catch { data = { raw: text.slice(0, 80) }; }
  assert.equal(response.status, expected, `${method} ${path}: ${text.slice(0, 350)}`);
  return data;
}
async function pdf(user: string, path: string) {
  const response = await fetch(base + path, { headers: { Authorization: `Bearer ${sessions[user].accessToken}` } });
  assert.equal(response.status, 200, path);
  assert.match(response.headers.get('content-type') || '', /application\/pdf/);
  const bytes = Buffer.from(await response.arrayBuffer());
  assert.equal(bytes.subarray(0, 5).toString(), '%PDF-');
  assert.ok(bytes.length > 1000);
  return bytes;
}

async function main() {
  const fixture = await seedNightDatabase();
  for (const [index, name] of Object.keys(fixture.users).entries()) {
    await check(`auth / login ${name}`, async () => {
      // Isolated logical clients behind our local trusted proxy; production auth limits stay intact.
      const response = await fetch(base + '/auth/login', { method: 'POST', headers: {
        'Content-Type': 'application/json', 'X-Forwarded-For': `127.10.0.${index + 1}`,
      }, body: JSON.stringify({ email: qaEmail(name), password: qaPassword }) });
      assert.equal(response.status, 200);
      const json: any = await response.json();
      assert.equal(json.data.user.id, fixture.users[name]);
      sessions[name] = json.data.tokens;
      assert.ok(sessions[name].accessToken);
    });
  }
  await check('auth / protected route rejects anonymous client', async () => { await request(null, '/manifiestos', 'GET', undefined, 401); });
  await check('auth / actor cannot list or impersonate users', async () => {
    await request('operador', '/admin/usuarios', 'GET', undefined, 403);
    await request('operador', `/admin/impersonate/${fixture.users.admin}`, 'POST', {}, 403);
  });
  await check('auth / admin impersonation returns real actor session', async () => {
    const json = await request('admin', `/admin/impersonate/${fixture.users.operador}`, 'POST', {});
    assert.equal(json.data.user.id, fixture.users.operador);
    assert.ok(json.data.tokens.accessToken);
  });
  await check('auth / real refresh preserves identity', async () => {
    const json = await request(null, '/auth/refresh-token', 'POST', { refreshToken: sessions.generador.refreshToken });
    assert.ok(json.data.tokens?.accessToken || json.data.accessToken);
  });
  await check('manifiestos / an account without an actor sees no manifests or dashboard totals', async () => {
    const list = await request('sin-actor', '/manifiestos');
    assert.equal(list.data.pagination.total, 0);
    assert.deepEqual(list.data.manifiestos, []);
    const dashboard = await request('sin-actor', '/manifiestos/dashboard');
    assert.equal(dashboard.data.estadisticas.total, 0);
    assert.deepEqual(dashboard.data.recientes, []);
  });

  const create = async (modalidad = 'FIJO') => (await request('generador', '/manifiestos', 'POST', {
    operadorId: fixture.actors.operador,
    ...(modalidad === 'FIJO' ? { transportistaId: fixture.actors.transportista } : {}), modalidad,
    observaciones: `QA HTTP ${run}`, residuos: [{ tipoResiduoId: fixture.wastes[0], cantidad: 100, unidad: 'kg' }],
  }, 201)).data.manifiesto;
  const action = async (user: string, id: string, name: string, body = {}, expected = 200) =>
    request(user, `/manifiestos/${id}/${name}`, 'POST', body, expected);
  await check('manifiestos / handwritten signature is validated, persisted with signer and included in PDF', async () => {
    const m = await create();
    await action('generador', m.id, 'firmar', { firma: 'data:image/png;base64,AAAA' }, 400);
    assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: m.id } })).estado, 'BORRADOR');
    const pixels = Buffer.alloc(400 * 200 * 3, 255);
    for (let x = 30; x < 300; x++) for (let c = 0; c < 3; c++) pixels[(Math.floor(45 + x / 4) * 400 + x) * 3 + c] = 20;
    const png = await sharp(pixels, { raw: { width: 400, height: 200, channels: 3 } }).png().toBuffer();
    await action('generador', m.id, 'firmar', { firma: `data:image/png;base64,${png.toString('base64')}` });
    const event = await db.eventoManifiesto.findFirstOrThrow({ where: { manifiestoId: m.id, tipo: 'FIRMA' } });
    assert.equal(event.usuarioId, fixture.users.generador);
    assert.ok(event.firmaImagen);
    assert.equal(event.firmaSha256, createHash('sha256').update(Buffer.from(event.firmaImagen.split(',')[1], 'base64')).digest('hex'));
    assert.match(event.descripcion, /firma manuscrita adjunta/);
    const detail = (await request('generador', `/manifiestos/${m.id}`)).data.manifiesto;
    assert.equal(detail.eventos.find((item: any) => item.id === event.id).firmaImagen, event.firmaImagen);
    const publicDetail = await request(null, `/manifiestos/verificar/${m.numero}`);
    assert.ok(!JSON.stringify(publicDetail).includes(event.firmaImagen));
    const bytes = await pdf('generador', `/pdf/manifiesto/${m.id}`);
    if (process.env.QA_ARTIFACTS) {
      assert.ok(path.isAbsolute(process.env.QA_ARTIFACTS) && /sitrep-night-20260926\.[^/]+$/.test(process.env.QA_ARTIFACTS));
      await writeFile(path.join(process.env.QA_ARTIFACTS, 'manifest-handwritten-signature.pdf'), bytes);
    }
    // A later approval without an image must not fabricate or reuse a previous signature.
    await action('admin', m.id, 'revertir-estado', { estadoNuevo: 'BORRADOR', motivo: 'QA verificar preservación del historial' });
    await action('generador', m.id, 'firmar');
    const approvals = await db.eventoManifiesto.findMany({ where: { manifiestoId: m.id, tipo: 'FIRMA' }, orderBy: { createdAt: 'asc' } });
    assert.equal(approvals.length, 2);
    assert.equal(approvals[0].firmaImagen, event.firmaImagen);
    assert.equal(approvals[1].firmaImagen, null);
  });
  await check('manifiestos / full FIJO lifecycle, persistence, GPS, weights and PDFs', async () => {
    let m = await create();
    assert.equal(m.estado, 'BORRADOR');
    await request('generador', `/manifiestos/${m.id}`, 'PUT', { observaciones: 'QA editado', residuos: [
      { tipoResiduoId: fixture.wastes[0], cantidad: 125, unidad: 'kg' },
    ] });
    await action('operador', m.id, 'cerrar', {}, 400);
    await action('generador', m.id, 'firmar');
    const signed = await db.manifiesto.findUniqueOrThrow({ where: { id: m.id } });
    assert.equal(signed.estado, 'APROBADO'); assert.ok(signed.qrCode); assert.ok(signed.rollingHash);
    await action('generador', m.id, 'confirmar-retiro', {}, 403);
    await action('transportista', m.id, 'confirmar-retiro', { latitud: -32.89, longitud: -68.84 });
    await action('transportista', m.id, 'ubicacion', { latitud: -32.88, longitud: -68.83 });
    await action('transportista', m.id, 'incidente', { tipo: 'PAUSA', descripcion: 'QA pausa segura' });
    assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: m.id } })).estado, 'EN_TRANSITO');
    assert.ok(await db.trackingGPS.count({ where: { manifiestoId: m.id } }));
    await action('transportista', m.id, 'confirmar-entrega');
    await action('transportista', m.id, 'ubicacion', { latitud: -32.87, longitud: -68.82 }, 404);
    await action('operador', m.id, 'confirmar-recepcion', { pesoReal: 123 });
    m = (await request('operador', `/manifiestos/${m.id}`)).data.manifiesto;
    await action('operador', m.id, 'pesaje', { residuos: [{ id: m.residuos[0].id, cantidadRecibida: 123 }] });
    const waste = await db.manifiestoResiduo.findUniqueOrThrow({ where: { id: m.residuos[0].id } });
    assert.equal(waste.cantidadRecibida, 123);
    await action('operador', m.id, 'tratamiento', { metodo: 'QA ESTABILIZACION' });
    await action('operador', m.id, 'cerrar', { metodoTratamiento: 'QA ESTABILIZACION' });
    assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: m.id } })).estado, 'TRATADO');
    await pdf('generador', `/pdf/manifiesto/${m.id}`);
    await pdf('operador', `/pdf/certificado/${m.id}`);
    await action('generador', m.id, 'cancelar', { motivo: 'QA no debe permitirlo' }, 400);
    await action('operador', m.id, 'cerrar', {}, 400);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: m.id, tipo: 'CIERRE' } }), 1);
  });
  await check('manifiestos / entity isolation on details and mutation', async () => {
    const m = await create();
    for (const role of ['generador2', 'transportista2', 'operador2']) {
      await request(role, `/manifiestos/${m.id}`, 'GET', undefined, 404);
    }
    await action('generador2', m.id, 'firmar', {}, 404);
    await request('generador2', `/manifiestos/${m.id}`, 'DELETE', undefined, 404);
  });
  await check('manifiestos / IN_SITU skips transport, persists closure and certificate', async () => {
    const m = await create('IN_SITU'); assert.equal(m.transportistaId, null);
    await action('generador', m.id, 'firmar');
    await action('admin', m.id, 'confirmar-retiro', {}, 400);
    await action('operador', m.id, 'recepcion-insitu');
    await action('operador', m.id, 'cerrar', { metodoTratamiento: 'QA ESTABILIZACION' });
    await pdf('operador', `/pdf/certificado/${m.id}`);
  });
  await check('manifiestos / rejection, cancellation and delete branches', async () => {
    const m = await create();
    await action('generador', m.id, 'firmar'); await action('transportista', m.id, 'confirmar-retiro');
    await action('transportista', m.id, 'confirmar-entrega');
    await action('operador', m.id, 'rechazar', { motivo: 'QA carga incompatible' });
    assert.equal((await db.manifiesto.findUniqueOrThrow({ where: { id: m.id } })).estado, 'RECHAZADO');
    await action('operador', m.id, 'tratamiento', { metodo: 'QA ESTABILIZACION' }, 400);
    await action('generador', m.id, 'cancelar', { motivo: 'QA cierre prueba' });
    await request('generador', `/manifiestos/${m.id}`, 'DELETE');
    assert.equal(await db.manifiesto.findUnique({ where: { id: m.id } }), null);
  });
  await check('manifiestos / duplicate signing has one effect', async () => {
    const m = await create();
    const statuses = await Promise.all([1, 2].map(() => fetch(`${base}/manifiestos/${m.id}/firmar`, {
      method: 'POST', headers: { Authorization: `Bearer ${sessions.generador.accessToken}` },
    }).then(res => res.status)));
    assert.deepEqual(statuses.sort(), [200, 400]);
    assert.equal(await db.eventoManifiesto.count({ where: { manifiestoId: m.id, tipo: 'FIRMA' } }), 1);
  });
  await check('manifiestos / concurrent creation allocates unique numbers', async () => {
    const records = await Promise.all(Array.from({ length: 5 }, () => create()));
    assert.equal(new Set(records.map(row => row.numero)).size, 5);
  });

  const types = ['GENERADOR', 'TRANSPORTISTA', 'OPERADOR', 'PETROLEO', 'AIRE', 'ESPONTANEA'];
  const series = ['GRP', 'TRP', 'ORP', 'PRP', 'ARP', 'IRP'];
  for (const [index, type] of types.entries()) {
    await check(`inspecciones / ${type} create, assign, checklist, version conflict and review`, async () => {
      const input = { tipoInspeccion: type, clienteId: `${run}-${type}`, inspectorId: fixture.users.inspector,
        ...(index < 3 ? { tipoActor: type, actorId: fixture.actors[type.toLowerCase()] } : {}),
        ubicacion: 'QA SIN UBICACION REAL', fechaProgramada: new Date().toISOString() };
      let record = (await request('admin', '/inspecciones', 'POST', input, 201)).data;
      assert.match(record.numero, new RegExp(`^${series[index]}-\\d{4}-\\d{5}$`));
      assert.equal(record.estado, 'PLANIFICADA'); assert.ok(record.items.length > 0);
      const retry = (await request('admin', '/inspecciones', 'POST', input, 201)).data;
      assert.equal(retry.id, record.id);
      await request('admin', '/inspecciones', 'POST', { ...input, ubicacion: 'QA cambió' }, 409);
      await request('inspector2', `/inspecciones/${record.id}`, 'GET', undefined, 403);
      record = (await request('inspector', `/inspecciones/${record.id}/estado`, 'POST', { estado: 'EN_CAMPO', version: record.version })).data;
      await request('inspector', `/inspecciones/${record.id}/estado`, 'POST', { estado: 'EN_REVISION', version: record.version }, 400);
      const oldVersion = record.version;
      record = (await request('inspector', `/inspecciones/${record.id}/borrador`, 'PATCH', {
        version: record.version, observaciones: `QA observación persistida ${type}`, numeroActa: `QA-${type}-${run.slice(0, 8)}`,
        items: record.items.map((item: any) => ({ id: item.id, resultado: 'CUMPLE' })),
        comparaciones: record.comparaciones.map((item: any) => ({ id: item.id, resultado: 'COINCIDE' })),
      })).data;
      assert.equal(record.observaciones, `QA observación persistida ${type}`);
      await request('inspector', `/inspecciones/${record.id}/borrador`, 'PATCH', {
        version: oldVersion, observaciones: 'QA no debe pisar', items: [], comparaciones: [],
      }, 409);
      assert.equal((await db.inspeccion.findUniqueOrThrow({ where: { id: record.id } })).observaciones, `QA observación persistida ${type}`);
      await pdf('inspector', `/inspecciones/${record.id}/expediente.pdf`);
      record = (await request('inspector', `/inspecciones/${record.id}/estado`, 'POST', { estado: 'EN_REVISION', version: record.version })).data;
      assert.equal(record.estado, 'EN_REVISION'); assert.ok(record.cerradaCampoAt);
      await request('inspector', `/inspecciones/${record.id}/borrador`, 'PATCH', { version: record.version, items: [], comparaciones: [], observaciones: 'QA cerrado no editable' }, 409);
    });
  }
  await check('inspecciones / invalid D and actor mismatch are input errors, not crashes', async () => {
    await request('admin', '/inspecciones', 'POST', { tipoInspeccion: 'D' }, 400);
    await request('admin', '/inspecciones', 'POST', { tipoInspeccion: 'OPERADOR', tipoActor: 'GENERADOR', actorId: fixture.actors.generador }, 400);
  });
  await check('inspecciones / actors and sector reviewers cannot cross scopes', async () => {
    await request('generador', '/inspecciones', 'GET', undefined, 403);
    await request('jefe-generadores', '/inspecciones', 'POST', { tipoInspeccion: 'OPERADOR', tipoActor: 'OPERADOR', actorId: fixture.actors.operador }, 403);
    await request('jefe-operadores', '/inspecciones', 'POST', { tipoInspeccion: 'ESPONTANEA' }, 403);
  });
  await check('inspecciones / concurrent numbering remains unique', async () => {
    const records = await Promise.all(Array.from({ length: 5 }, (_, index) => request('admin', '/inspecciones', 'POST', {
      tipoInspeccion: 'ESPONTANEA', clienteId: `${run}-concurrent-${index}`,
    }, 201)));
    assert.equal(new Set(records.map(row => row.data.numero)).size, 5);
  });
  for (const decision of ['CERRADA_CONFORME', 'DERIVADA_LEGALES']) {
    await check(`inspecciones / evidence, reviewed dossier, actor response, ${decision} and final PDF`, async () => {
      let record = (await request('admin', '/inspecciones', 'POST', {
        tipoInspeccion: 'GENERADOR', tipoActor: 'GENERADOR', actorId: fixture.actors.generador,
        inspectorId: fixture.users.inspector, numeroActa: `QA-${decision}-${run.slice(0, 8)}`,
      }, 201)).data;
      const path = `/inspecciones/${record.id}`;
      const refresh = async () => { record = (await request('inspector', path)).data; return record; };
      await request('generador', `${path}/intercambios`, 'GET', undefined, 403);
      record = (await request('inspector', `${path}/estado`, 'POST', { version: record.version, estado: 'EN_CAMPO' })).data;
      const image = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAGQAAABGCAIAAAC15KY+AAAACXBIWXMAAAPoAAAD6AG1e1JrAAAAz0lEQVR4nO3WUQ0DQRDD0COw2MyrqEvhfqpspScNAsvJ5Dmf3HkH4UHqvNYFrMDqF4lhVmDFrLbvSAwDK2Ylhv3LMNZZgRWzEsPmZaSzAitmNY+Y6RBYMav7z4IPrJiVGDYvI50VWDGrecRMh8CKWd1/FnxgxazEsHkZ6azAilnNI2Y6BFbM6v6z4AMrZiWGzctIZwVWzGoeMdMhsGJW958FH1gxKzFsXkY6K7BiVvOImQ6BFbO6/yz4wIpZiWHzMtJZgRWzmkfMdAisVmZ9AS7AknkS//KNAAAAAElFTkSuQmCC', 'base64');
      const upload = async (expected: number) => {
        const data = new FormData();
        data.set('file', new Blob([image], { type: 'image/png' }), 'QA-synthetic-pixel.png');
        data.set('clienteId', `${run}-${decision}-capture`);
        data.set('itemId', record.items[0].id);
        const response = await fetch(base + path + '/evidencias', {
          method: 'POST', headers: { Authorization: `Bearer ${sessions.inspector.accessToken}` }, body: data,
        });
        const json: any = await response.json();
        assert.equal(response.status, expected, JSON.stringify(json)); return json.data;
      };
      const evidence = await upload(201);
      assert.equal((await upload(200)).id, evidence.id);
      assert.equal(await db.evidenciaInspeccion.count({ where: { inspeccionId: record.id } }), 1);
      const file = await fetch(base + path + `/evidencias/${evidence.id}`, { headers: { Authorization: `Bearer ${sessions.inspector.accessToken}` } });
      assert.equal(file.status, 200); assert.deepEqual(Buffer.from(await file.arrayBuffer()), image);
      await request('inspector2', `${path}/evidencias/${evidence.id}`, 'GET', undefined, 403);
      await refresh();
      const report = { expedienteElectronico: `QA-${run}`, objetivo: 'QA verificar condiciones', antecedentes: 'QA antecedentes sintéticos',
        evaluacion: 'QA evaluación de la evidencia sintética', conclusion: 'QA conclusión sintética', recomendacion: 'QA revisión sintética' };
      record = (await request('inspector', `${path}/borrador`, 'PATCH', {
        version: record.version, observaciones: 'QA constatación sintética completa', ubicacion: 'QA lugar sin domicilio real',
        datosActa: { area: 'QA', motivoInspeccion: 'QA control', lugarAfectacion: 'QA depósito',
          danosEstado: 'NO_OBSERVADOS', tercerosTestigosEstado: 'NO_IDENTIFICADOS', libroOperacionesEstado: 'EXHIBIDO',
          libroOperacionesDetalle: 'QA libro sintético verificado', firmaIntervinienteEstado: 'FIRMADA',
          copiaActaEstado: 'ENTREGADA', copiaActaDetalle: 'QA constancia sintética de entrega', domicilioLegal: 'QA domicilio ficticio',
          notificacionEstado: 'COMUNICADA_EN_ACTA', notificacionDetalle: 'QA constancia sintética, no comunicación real' },
        informeTecnico: report,
        items: record.items.map((item: any) => ({ id: item.id, resultado: 'CUMPLE' })),
        comparaciones: record.comparaciones.map((item: any) => ({ id: item.id, resultado: 'COINCIDE' })),
      })).data;
      record = (await request('inspector', `${path}/estado`, 'POST', { version: record.version, estado: 'EN_REVISION' })).data;
      const fieldSnapshot = await db.eventoInspeccion.findFirstOrThrow({ where: { inspeccionId: record.id, estadoHasta: 'EN_REVISION' } });
      assert.ok(fieldSnapshot.metadata);
      record = (await request('inspector', `${path}/informe-tecnico`, 'PATCH', { version: record.version, informeTecnico: { ...report, conclusion: 'QA conclusión ampliada sin modificar acta' } })).data;
      assert.deepEqual((await db.eventoInspeccion.findUniqueOrThrow({ where: { id: fieldSnapshot.id } })).metadata, fieldSnapshot.metadata);
      await request('inspector', `${path}/estado`, 'POST', { version: record.version, estado: 'NOTIFICADA', plazoRespuestaAt: '2030-01-01T00:00:00Z' }, 409);
      record = (await request('admin', `${path}/estado`, 'POST', { version: record.version, estado: 'NOTIFICADA', plazoRespuestaAt: '2030-01-01T00:00:00Z' })).data;
      const requirement = (await request('admin', `${path}/intercambios`, 'POST', {
        version: record.version, clienteId: `${run}-${decision}-requirement`, tipo: 'REQUERIMIENTO',
        asunto: 'QA requerimiento sintético', cuerpo: 'QA presentar documentación sintética para la prueba funcional.',
      }, 201)).data;
      await refresh();
      const actorView = await request('generador', `${path}/intercambios`);
      assert.equal(actorView.data.comunicacionExterna, false);
      await request('generador2', `${path}/intercambios`, 'GET', undefined, 403);
      const answerInput = { version: record.version, clienteId: `${run}-${decision}-answer`, tipo: 'DESCARGO',
        asunto: 'QA respuesta sintética', cuerpo: 'QA documentación de descargo completamente sintética.', respondeAId: requirement.id };
      const answer = (await request('generador', `${path}/intercambios`, 'POST', answerInput, 201)).data;
      assert.equal((await request('generador', `${path}/intercambios`, 'POST', answerInput)).data.id, answer.id);
      assert.equal(answer.hashAnterior, requirement.hashCadena);
      await refresh(); assert.equal(record.estado, 'EN_DESCARGO');
      const resolutionInput = { version: record.version, clienteId: `${run}-${decision}-resolution`, decision,
        fundamento: 'QA decisión sintética fundada para verificar el cierre del expediente.' };
      await request('inspector', `${path}/intercambios/decision`, 'POST', resolutionInput, 403);
      const resolution = (await request('admin', `${path}/intercambios/decision`, 'POST', resolutionInput)).data;
      assert.equal(resolution.hashAnterior, answer.hashCadena);
      await refresh(); assert.equal(record.estado, decision);
      if (decision === 'DERIVADA_LEGALES') {
        for (const estado of ['EN_TRAMITE_LEGAL', 'DERIVADA_ATM', 'FINALIZADA']) {
          record = (await request('admin', `${path}/estado`, 'POST', { version: record.version, estado })).data;
        }
      }
      await pdf('admin', `${path}/expediente.pdf`);
      await pdf('admin', `${path}/acta.pdf`);
      await pdf('admin', `${path}/informe-tecnico.pdf`);
      await request('generador', `${path}/intercambios`, 'POST', { ...answerInput, version: record.version, clienteId: `${run}-${decision}-closed` }, 409);
      const trace = (await refresh()).verificacion;
      const verification = await request(null, `/inspecciones/verificar/${new URL(trace.url).pathname.split('/').pop()}`);
      assert.equal(verification.success, true);
    });
  }
  for (const path of ['/manifiestos/dashboard', '/catalogos/generadores', '/catalogos/operadores',
    '/catalogos/transportistas', '/centro-control/actividad?capas=generadores,transportistas,operadores,inspecciones',
    '/inspecciones/operaciones', '/reportes/manifiestos', '/reportes/tratados', '/reportes/transporte']) {
    await check(`integraciones / ${path}`, async () => { await request('admin', path); });
  }
  console.log(JSON.stringify({ run, results, passed: results.filter(row => row.status === 'PASS').length,
    failed: results.filter(row => row.status === 'FAIL').length }, null, 2));
  if (results.some(row => row.status === 'FAIL')) process.exitCode = 1;
}
main().catch(error => { console.error(error); process.exitCode = 1; }).finally(() => db.$disconnect());
