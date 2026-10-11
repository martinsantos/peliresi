import { build } from 'esbuild';
import { execFileSync } from 'node:child_process';
import { mkdirSync, writeFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// Compile the actual React components with the application JSX runtime, outside
// Playwright's component-test JSX transform. No product code or browser mocking.
const frontend = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const artifacts = process.env.QA_ARTIFACTS;
if (!artifacts) throw new Error('QA_ARTIFACTS is required');
mkdirSync(artifacts, { recursive: true });
const outfile = path.join(artifacts, 'brand-render.cjs');
await build({
  stdin: {
    contents: `import React from 'react';
      import { renderToStaticMarkup } from 'react-dom/server';
      import { MapCategorySymbol } from './src-v6/components/ui/MapLayerToggle';
      const categories = ['generador', 'transportista', 'operador', 'inspeccion'];
      process.stdout.write(JSON.stringify(Object.fromEntries(categories.map(category =>
        [category, renderToStaticMarkup(React.createElement(MapCategorySymbol, { category, size: 'hero' }))]))));`,
    resolveDir: frontend, loader: 'tsx',
  },
  bundle: true, platform: 'node', format: 'cjs', jsx: 'automatic', outfile,
});
const rendered = execFileSync(process.execPath, [outfile], { maxBuffer: 256 * 1024 }).toString();
const symbols = JSON.parse(rendered);
if (Object.keys(symbols).length !== 4) throw new Error('Missing category symbols');
writeFileSync(path.join(artifacts, 'brand-symbols.json'), JSON.stringify(symbols));
