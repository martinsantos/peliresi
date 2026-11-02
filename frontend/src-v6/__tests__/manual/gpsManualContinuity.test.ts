import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, it } from 'vitest';

it('explains continuity without presenting an old point as current or allowing an unresolved handoff', () => {
  const manual = path.resolve(process.cwd(), '../docs/manual');
  const help = readFileSync(path.join(manual, 'help-data.js'), 'utf8');
  const directory = readFileSync(path.join(manual, 'directorio.html'), 'utf8');
  expect(help).toContain('puede enviar la nueva; la anterior queda pendiente');
  expect(help).toContain('La entrega o el relevo siguen bloqueados hasta resolverla');
  expect(directory).toContain('no recibió esa referencia');
  expect(directory).toContain('conservar la anterior pendiente');
  const version = createHash('sha256').update(help).digest('hex').slice(0, 12);
  for (const name of ['index.html', 'search.html', 'tutorial.html']) {
    expect(readFileSync(path.join(manual, name), 'utf8')).toContain(`help-data.js?v=${version}`);
  }
});
