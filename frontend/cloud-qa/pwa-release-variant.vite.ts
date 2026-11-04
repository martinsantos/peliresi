import { mergeConfig, type Plugin } from 'vite';
import base from '../vite.config.app';

// QA-only second build of the real app. Different hashed entry/inspection
// chunks simulate an ordinary release without changing product sources.
if (process.env.SITREP_QA_EXECUTOR !== 'preview-container'
  || process.env.QA_ARTIFACTS !== '/work/sitrep/.qa-pwa-continuity-20261031'
  || process.cwd() !== '/work/sitrep/frontend') {
  throw new Error('La variante sólo puede compilarse en el preview aislado.');
}
const variant: Plugin = {
  name: 'sitrep-qa-release-b',
  enforce: 'pre',
  transform(code, id) {
    const filename = id.replaceAll('\\', '/').split('?')[0];
    if (filename.endsWith('/src-v6/main-app.tsx')
      || filename.endsWith('/src-v6/pages/inspecciones/InspeccionesPageV2.tsx')) {
      return { code: code + '\nconsole.info("[QA] Variante sintética B");\n', map: null };
    }
  },
  transformIndexHtml(html) {
    return html.replace('</head>', '<meta name="sitrep-qa-release" content="B" /></head>');
  },
};
export default mergeConfig(base, { plugins: [variant], build: { outDir: process.env.QA_ARTIFACTS + '/release-b' } });
