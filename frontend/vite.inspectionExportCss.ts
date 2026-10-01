import type { Plugin } from 'vite';

/** Preserve the production cascade for the inspection export menu on both shells. */
export function inspectionExportCssLast(): Plugin {
  return {
    name: 'inspection-export-css-last',
    transformIndexHtml: {
      order: 'post',
      handler(html) {
        const stylesheet = html.match(/<link rel="stylesheet" href="\/(?:app\/)?inspection-export-mobile\.css\?v=\d+" \/>/)?.[0];
        if (!stylesheet) return html;
        return html.replace(stylesheet, '').replace('</head>', `    ${stylesheet}\n  </head>`);
      },
    },
  };
}
