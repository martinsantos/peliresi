import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { readFileSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { assertCloudDatabase, root } from './safety.ts';

await assertCloudDatabase();
assert.equal(process.env.SITREP_QA_RUN, 'legacy-integrity-20261030');
const sql = readFileSync(path.join(root, 'docs/CONSULTA-CORTE-APROBACIONES-20261029.sql'), 'utf8');
assert.match(sql, /BEGIN TRANSACTION READ ONLY/);
const setup = `
CREATE TEMP TABLE manifiestos(id text, estado text, modalidad text, "transportistaId" text, "isDemoData" boolean);
CREATE TEMP TABLE eventos_manifiesto("manifiestoId" text, tipo text);
INSERT INTO manifiestos VALUES
 ('a','PENDIENTE_APROBACION','FIJO','t',false), ('b','BORRADOR',NULL,'t',false),
 ('c','APROBADO','IN_SITU',NULL,false), ('d','APROBADO','FIJO','t',false),
 ('e','APROBADO','FIJO','t',false), ('f','APROBADO','FIJO','t',false),
 ('g','APROBADO','FIJO','t',false), ('h','TRATADO','FIJO','t',false),
 ('i','PENDIENTE_APROBACION','FIJO','t',true);
INSERT INTO eventos_manifiesto VALUES
 ('c','PROPUESTA_PARTES_V1'),('c','FIRMA'),('c','APROBACION_OPERADOR'),
 ('d','PROPUESTA_PARTES_V1'),('d','FIRMA'),('d','APROBACION_OPERADOR'),
 ('e','PROPUESTA_PARTES_V1'),('e','PROPUESTA_PARTES_V1'),('e','FIRMA'),('e','APROBACION_TRANSPORTISTA'),('e','APROBACION_OPERADOR'),
 ('f','PROPUESTA_PARTES_V1'),('f','FIRMA'),('f','APROBACION_TRANSPORTISTA'),('f','APROBACION_OPERADOR'),('f','RECHAZO_PARTE'),
 ('g','PROPUESTA_PARTES_V1'),('g','FIRMA'),('g','APROBACION_TRANSPORTISTA'),('g','APROBACION_OPERADOR');
`;
const result = spawnSync('psql', ['--no-psqlrc', '-A', '-t', '-F', '|', '-v', 'ON_ERROR_STOP=1', '-h', '127.0.0.1', '-p', '55440', '-U', 'qa', '-d', 'sitrep_night_qa_20260926'], { input: setup + '\n' + sql, encoding: 'utf8' });
assert.equal(result.status, 0, result.stderr);
const rows = result.stdout.split('\n').filter(line => line.includes('|')).sort();
const expected = [
  'SIN_PROPUESTA_REGISTRADA|PENDIENTE_APROBACION|FIJO|1', 'SIN_PROPUESTA_REGISTRADA|BORRADOR|FIJO|1',
  'MARCADORES_MULTIPLES|APROBADO|FIJO|1', 'APROBADO_SIN_TRES_DECISIONES|APROBADO|FIJO|1',
  'APROBADO_SIN_TRES_DECISIONES|APROBADO|IN_SITU|1', 'APROBADO_O_PENDIENTE_CON_RECHAZO|APROBADO|FIJO|1',
  'ORIGEN_SIN_TRANSPORTE|APROBADO|IN_SITU|1',
].sort();
assert.deepEqual(rows, expected);
writeFileSync(path.join(process.env.QA_ARTIFACTS!, 'legacy-integrity-sql.json'), JSON.stringify({ synthetic: true, production: false, temporaryTablesOnly: true, categoriesMayOverlap: true, markerContentValidated: false, rows }, null, 2));
console.log(`Consulta de corte verificada contra ${rows.length} grupos artificiales en tablas temporales.`);
