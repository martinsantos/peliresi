import fs from 'node:fs';
import path from 'node:path';
import { mergeConfig, type Plugin } from 'vite';
import base from '../vite.config';

// A separate real web build with changed lazy chunks and a new worker version.
if (process.env.SITREP_QA_EXECUTOR !== 'preview-container'
  || process.env.QA_ARTIFACTS !== '/work/sitrep/.qa-pwa-continuity-20261031'
  || process.cwd() !== '/work/sitrep/frontend'
  || !['baseline', 'fixed'].includes(process.env.QA_PWA_WEB_BASE || '')) {
  throw new Error('La variante sólo puede compilarse en el preview aislado.');
}
const output = path.join(process.env.QA_ARTIFACTS, 'web-release-b');
const variant: Plugin = {
  name: 'sitrep-qa-web-release-b',
  enforce: 'pre',
  transform(code, id) {
    const filename = id.replaceAll('\\', '/').split('?')[0];
    if (filename.endsWith('/src-v6/main.tsx')
      || filename.endsWith('/src-v6/pages/inspecciones/InspeccionesPageV2.tsx')) {
      return { code: code + '\nconsole.info("[QA] Variante web sintética B");\n', map: null };
    }
  },
  closeBundle() {
    const file = path.join(output, 'sw.js');
    const original = fs.readFileSync(file, 'utf8');
    const from = process.env.QA_PWA_WEB_BASE === 'fixed' ? ['v179', 'v122'] : ['v178', 'v121'];
    const to = process.env.QA_PWA_WEB_BASE === 'fixed' ? ['v180', 'v123'] : ['v179', 'v122'];
    const result = original.replace(`trazabilidad-rrpp-${from[0]}`, `trazabilidad-rrpp-${to[0]}`)
      .replace(`runtime-cache-${from[1]}`, `runtime-cache-${to[1]}`);
    if (result === original || !result.includes(`runtime-cache-${to[1]}`)) throw Error('Versión web QA no reconocida');
    fs.writeFileSync(file, result);
  },
};
export default mergeConfig(base, { plugins: [variant], build: { outDir: output } });
