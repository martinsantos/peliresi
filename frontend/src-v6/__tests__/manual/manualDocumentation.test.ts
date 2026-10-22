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
  it('distinguishes individual approval, repeated receipts and certificate issuance', () => {
    const guide = data.guides.find(item => item.id === 'correos-decisiones-documentos');
    expect(guide).toBeDefined();
    const content = JSON.stringify(guide);
    for (const term of ['aprobación individual', 'no acredita un pago nuevo', 'emisión expresa del operador', 'permanecen apagados', 'históricos']) expect(content).toContain(term);
    expect(guide?.steps).toHaveLength(3);
  });
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
    expect(catalogue.safety).toContain('datos sintéticos y no acreditan la configuración actual');
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
      expect(step.caption).toContain('No acredita el estado actual de esta instalación');
      expect(receipt.files.some((item: { file: string }) => step.image === 'screenshots/' + item.file)).toBe(true);
    }
  });
  it('preserves the current account-edit captures and explains the notice delivery boundary', () => {
    const provenance = JSON.parse(readFileSync(manual + 'circuit-review-capture-provenance.json', 'utf8'));
    expect(provenance).toMatchObject({ synthetic: true, productionCapture: false, edited: false });
    expect(provenance.files).toHaveLength(4);
    for (const image of provenance.files) {
      const bytes = readFileSync(manual + 'screenshots/' + image.file);
      expect(createHash('sha256').update(bytes).digest('hex')).toBe(image.sha256);
      expect(bytes.readUInt32BE(16)).toBe(image.width); expect(bytes.readUInt32BE(20)).toBe(image.height);
    }
    const psip = data.guides.find(guide => guide.id === 'psip-flujo-inspecciones')!;
    const body = psip.steps.flatMap(step => step.body).join(' ');
    expect(body).toContain('Quitar la fecha no cancela');
    expect(body).toContain('históricos sólo-campana no se reenvían');
    expect(body).toContain('correo y push siguen apagados');
    const account = data.guides.find(guide => guide.id === 'administrador-editar-usuarios')!;
    expect(account.steps.flatMap(step => step.body).join(' ')).toContain('Nombre y Apellido son campos separados');
  });

  it('exposes the tutorial in all entry pages and escapes the explicit capture caption', () => {
    for (const file of ['index.html', 'search.html', 'tutorial.html']) {
      const html = readFileSync(manual + file, 'utf8');
      // Guide content uses its own current cache key; the corrected renderer has its own key; CSS retains its version.
      // Keep exact versions: stale entry pages must not load an older renderer.
      expect(html).toContain('help-data.js?v=2026.22.5');
      expect(html).toContain('manual.js?v=2026.20.6');
      expect(html).toContain('manual.css?v=2026.20.5');
    }
    const script = readFileSync(manual + 'manual.js', 'utf8');
    expect(script).toContain("'administrador-alertas-proactivas'");
    expect(script).toContain('escapeHTML(step.caption ||');
    expect(readFileSync(manual + 'directorio.html', 'utf8')).toContain('id="alertas-catalogo"');
  });
});

it('documents operational proposals separately from CAP and keeps the old manifest contract explicit',()=>{
 const guide=data.guides.find(g=>g.id==='manifiestos-tres-partes')!;
 const text=guide.steps.flatMap(s=>s.body.concat(s.expected)).join(' ');
 for(const value of ['Crear no aprueba','Generador firma','3 de 3','Iniciar coordinación','Leer un aviso no aprueba'])expect(text).toContain(value);
 expect(guide.safety).toContain('CAP cerrado y correo/push apagados');
 expect(data.guides.find(g=>g.id==='generador-crear-manifiesto')!.safety).toContain('modo de borrador anterior');
});

it('explains eventual search, live updates and explicit conflict recovery', () => {
 const guide = data.guides.find(item => item.id === 'eventuales-aprobaciones-avisos');
 const content = JSON.stringify(guide);
 for (const text of ['Buscar eventual', 'Etapa del eventual', 'Usar versión actual', 'no envía ni aprueba', 'sin duplicarla']) expect(content).toContain(text);
 expect(guide?.safety).toContain('La referencia BI- es interna');
 expect(content).toContain('Correo y push permanecen apagados');
 expect(content).not.toContain('en este ensayo');
});
