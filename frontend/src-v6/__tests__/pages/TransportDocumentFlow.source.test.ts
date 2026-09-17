import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';

describe('transport document flow regression', () => {
  const source = readFileSync(resolve(process.cwd(), 'src-v6/pages/actores/TransportistaDetallePage.tsx'), 'utf8');

  it('does not expose the former four technical upload labels in each table row', () => {
    expect(source).not.toContain("label: 'Verde frente'");
    expect(source).not.toContain("label: 'Verde dorso'");
    expect(source).not.toContain("label: 'Azul frente'");
    expect(source).not.toContain("label: 'Azul dorso'");
  });

  it('guides users through front, back and the conditional authorization', () => {
    expect(source).toContain('primero el frente y después el dorso');
    expect(source).toContain('Cédula de identificación del vehículo');
    expect(source).toContain('¿El vehículo requiere autorización de uso?');
  });
});
