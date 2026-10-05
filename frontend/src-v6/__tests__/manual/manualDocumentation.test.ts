import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { runInNewContext } from 'node:vm';
import path from 'node:path';

// Vitest's jsdom module URL is HTTP, not a filesystem file: URL must not locate this static source.
const manual = path.resolve(process.cwd(), '../docs/manual') + path.sep;
type Step = { title: string; body: string[]; image?: string; caption?: string; alt?: string; expected: string };
type Guide = { id: string; profile: string; safety?: string; steps: Step[] };
const context = { window: {} as { SITREP_HELP?: { profiles: Array<{ id: string }>; guides: Guide[] } } };
runInNewContext(readFileSync(manual + 'help-data.js', 'utf8'), context, { timeout: 1000 });
const data = context.window.SITREP_HELP!;
const catalogue = data.guides.find(guide => guide.id === 'administrador-alertas-proactivas')!;

describe('manual documentation stays usable and truthful', () => {
  it('keeps unique guides, recognized roles, useful steps and existing captures for every tutorial', () => {
    expect(new Set(data.guides.map(guide => guide.id)).size).toBe(data.guides.length);
    for (const guide of data.guides) {
      expect(data.profiles.some(profile => profile.id === guide.profile)).toBe(true);
      expect(guide.steps.length).toBeGreaterThan(0);
      for (const step of guide.steps) {
        expect(step.title.length && step.body.length && step.expected.length).toBeGreaterThan(0);
        if (step.image) {
          expect(step.image).toMatch(/^screenshots\/(desktop|mobile)\/[^/]+\.png$/);
          expect(existsSync(manual + step.image), step.image).toBe(true);
          expect(step.alt?.length).toBeGreaterThan(0);
        }
      }
    }
  });
  it('distinguishes simulation, internal delivery, reading, legal decisions and unimplemented families', () => {
    const text = catalogue.steps.flatMap(step => step.body).join(' ');
    expect(catalogue.safety).toContain('pendiente de publicación');
    for (const phrase of ['No crea la regla, casos ni avisos', 'inactivas', 'no un vencimiento legal', 'no significa aceptación legal', 'hasta finalizar el 10 en Mendoza', 'nunca todo el padrón', 'No se envía correo ni push', 'no cierra un manifiesto', 'todavía no son reglas operativas']) {
      expect(text).toContain(phrase);
    }
  });
  it('keeps original synthetic capture bytes with explicit provenance instead of fabricated production images', () => {
    const receipt = JSON.parse(readFileSync(manual + 'capture-provenance.json', 'utf8'));
    expect(receipt.synthetic).toBe(true); expect(receipt.productionCapture).toBe(false); expect(receipt.edited).toBe(false);
    expect(receipt.commit).toMatch(/^[a-f0-9]{40}$/); expect(receipt.run).toMatch(/^\d+$/);
    expect(receipt.files).toHaveLength(7);
    for (const item of receipt.files) {
      const bytes = readFileSync(manual + 'screenshots/' + item.file);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(item.sha256);
      expect(bytes.readUInt32BE(16)).toBe(item.width); expect(bytes.readUInt32BE(20)).toBe(item.height);
    }
    for (const step of catalogue.steps) {
      expect(step.caption).toContain('Datos sintéticos');
      expect(step.caption).toContain('pendiente de publicación');
      expect(receipt.files.some((item: { file: string }) => step.image === 'screenshots/' + item.file)).toBe(true);
    }
  });
  it('exposes the tutorial in all entry pages and escapes the explicit capture caption', () => {
    for (const file of ['index.html', 'search.html', 'tutorial.html']) {
      const html = readFileSync(manual + file, 'utf8');
      expect(html).toContain('help-data.js?v=2026.16.1');
      expect(html).toContain('manual.js?v=2026.16.1');
    }
    const script = readFileSync(manual + 'manual.js', 'utf8');
    expect(script).toContain("'administrador-alertas-proactivas'");
    expect(script).toContain('escapeHTML(step.caption ||');
    expect(readFileSync(manual + 'directorio.html', 'utf8')).toContain('id="alertas-catalogo"');
  });
});
