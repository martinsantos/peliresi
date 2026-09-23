/** Live smoke constrained to one explicitly marked Government training case. */
export {};
const fs = require('node:fs');
const crypto = require('node:crypto');
const { PrismaClient } = require('@prisma/client');
const jwt = require('jsonwebtoken');

require('dotenv').config();
const prisma = new PrismaClient();
const label = process.env.TRAINING_RUN_LABEL;
const imagePath = '/var/www/sitrep/icon-192.png';

async function main() {
  if (!/^20\d{6}$/.test(label || '')) throw new Error('Training label missing.');
  if (process.env.DISABLE_EMAILS !== 'true') throw new Error('Email sending must be disabled.');
  if (new URL(process.env.DATABASE_URL).pathname !== '/sitrep_prod') throw new Error('Unexpected DB.');
  const inspection = await prisma.inspeccion.findFirst({
    where: { numeroActa: `DEMO-INS-GEN-${label}` },
    include: { generador: true, inspector: true },
  });
  if (!inspection || !inspection.generador?.razonSocial.startsWith('CAPACITACION RP -')
    || inspection.inspector.rol !== 'ADMIN' || inspection.estado !== 'BORRADOR') {
    throw new Error('Strict synthetic-inspection guard failed.');
  }
  const token = jwt.sign({ id: inspection.inspectorId }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const base = `http://127.0.0.1:3002/api/inspecciones/${inspection.id}`;
  const auth = { Authorization: `Bearer ${token}` };
  const get = await fetch(base, { headers: auth });
  if (get.status !== 200) throw new Error(`GET inspection ${get.status}`);
  const current = (await get.json()).data;
  const item = current.items.find((row: any) => row.codigo === 'DOC-01');
  if (!item) throw new Error('DOC-01 missing.');

  const observation = '[DEMO] Documento de práctica: se adjunta imagen sintética a esta observación.';
  const save = await fetch(`${base}/items`, {
    method: 'PATCH',
    headers: { ...auth, 'Content-Type': 'application/json' },
    body: JSON.stringify({ version: current.version, items: [{ id: item.id, resultado: 'NO_CUMPLE', observacion: observation }] }),
  });
  if (save.status !== 200) throw new Error(`Save item ${save.status}: ${(await save.text()).slice(0, 300)}`);
  console.log('DEMO_ITEM_COMMENT_SAVED');

  const bytes = fs.readFileSync(imagePath);
  const sha = crypto.createHash('sha256').update(bytes).digest('hex');
  const upload = async () => {
    const form = new FormData();
    form.append('itemId', item.id);
    form.append('clienteId', `demo-field-photo-${label}`);
    form.append('clienteSha256', sha);
    form.append('descripcion', '[DEMO] Foto sintética vinculada al comentario DOC-01');
    form.append('file', new Blob([bytes], { type: 'image/png' }), 'demo-evidence-icon.png');
    const response = await fetch(`${base}/evidencias`, { method: 'POST', headers: auth, body: form });
    const payload = await response.json();
    if (![200, 201].includes(response.status) || !payload.data?.id) {
      throw new Error(`Photo upload ${response.status}: ${JSON.stringify(payload).slice(0, 300)}`);
    }
    return payload.data;
  };

  const first = await upload();
  if (first.itemId !== item.id || first.sha256 !== sha) throw new Error('Photo not linked or hash mismatch.');
  console.log('DEMO_ITEM_PHOTO_LINKED');
  const retry = await upload();
  if (retry.id !== first.id) throw new Error('Idempotency retry created a duplicate.');
  console.log('DEMO_PHOTO_RETRY_IDEMPOTENT');

  const detail = await fetch(base, { headers: auth });
  const refreshed = (await detail.json()).data;
  const refreshedItem = refreshed.items.find((row: any) => row.id === item.id);
  if (refreshedItem?.observacion !== observation || !refreshedItem.evidencias?.some((row: any) => row.id === first.id)) {
    throw new Error('Comment and thumbnail association not returned by detail.');
  }
  const downloaded = await fetch(`${base}/evidencias/${first.id}`, { headers: auth });
  if (downloaded.status !== 200 || !downloaded.headers.get('content-type')?.includes('image/png')) {
    throw new Error(`Evidence download failed: ${downloaded.status}`);
  }
  console.log('DEMO_THUMBNAIL_DOWNLOAD_OK');

  for (const document of ['acta.pdf', 'informe-tecnico.pdf']) {
    const response = await fetch(`${base}/${document}`, { headers: auth });
    const signature = Buffer.from(await response.arrayBuffer()).subarray(0, 4).toString();
    if (response.status !== 200 || signature !== '%PDF') throw new Error(`${document} failed: ${response.status}`);
    console.log(`DEMO_${document.toUpperCase().replace(/[^A-Z]/g, '_')}_OK`);
  }
}

main().catch((error: Error) => {
  console.error(error.message);
  process.exitCode = 1;
}).finally(async () => {
  await prisma.$disconnect();
});
