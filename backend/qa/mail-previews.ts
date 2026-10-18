/** Synthetic preview catalogue generated in CI; never sends or opens a browser. */
import { createRequire } from 'node:module';
import { mkdirSync, writeFileSync } from 'node:fs';
const require = createRequire(import.meta.url);
const { renderMail } = require('../dist/services/email-templates.js');
const directory = '/tmp/sitrep-mail-templates';
mkdirSync(directory, { recursive: true });
const ids = ['verify', 'pending', 'approved', 'newAccount', 'reset', 'application', 'observed', 'response', 'rejected', 'modification', 'modificationApproved', 'modificationRejected'];
process.env.FRONTEND_URL = 'https://sitrep.example.invalid';
for (const id of ids) {
  const mail = renderMail(id, { name: 'Persona de capacitación',
    ...(['pending', 'newAccount', 'application', 'modification'].includes(id) ? { role: 'Generador' } : {}),
    ...(['observed', 'rejected', 'modificationRejected'].includes(id) ? { message: 'Revisá el domicilio del establecimiento y adjuntá el documento solicitado.' } : {}),
    ...(['verify', 'reset'].includes(id) ? { token: 'solo-vista-previa-sin-validez' } : {}),
  });
  writeFileSync(`${directory}/${id}.html`, mail.html);
  writeFileSync(`${directory}/${id}.txt`, mail.text);
}
writeFileSync(`${directory}/index.html`, '<!doctype html><html lang="es"><meta charset="utf-8"><title>Plantillas SITREP · QA</title><h1>Plantillas de correo SITREP</h1><p>Datos ficticios. No son envíos ni enlaces válidos para trámites.</p><ul>' + ids.map(id => `<li><a href="${id}.html">${id}</a> · <a href="${id}.txt">Texto plano</a></li>`).join('') + '</ul></html>');
console.log(`${ids.length} synthetic HTML/text previews generated`);
