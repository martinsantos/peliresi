/**
 * buscar-cuits-transportistas.ts
 *
 * Script ONE-TIME para buscar CUITs de transportistas sin CUIT real.
 * Lee el Excel del Registro Provincial, busca en cuitonline.com por razón social,
 * y genera backend/prisma/cuits-encontrados.json para revisión humana.
 *
 * USO:
 *   npx ts-node backend/scripts/buscar-cuits-transportistas.ts
 *   npx ts-node backend/scripts/buscar-cuits-transportistas.ts --dry-run
 *   npx ts-node backend/scripts/buscar-cuits-transportistas.ts --verifik-api-key=XXX
 *
 * Tras revisión humana del JSON, ejecutar:
 *   npx ts-node backend/prisma/seed-transportistas-reales.ts
 *
 * Dependencias: npm install --save-dev xlsx axios cheerio @types/cheerio
 */

import fs from 'fs';
import path from 'path';

let XLSX: any;
let axios: any;
let cheerio: any;

try { XLSX = require('xlsx'); } catch {
  console.error('ERROR: falta xlsx. Ejecutar: npm install --save-dev xlsx'); process.exit(1);
}
try { axios = require('axios').default; } catch {
  console.error('ERROR: falta axios. Ejecutar: npm install --save-dev axios'); process.exit(1);
}
try { cheerio = require('cheerio'); } catch {
  console.error('ERROR: falta cheerio. Ejecutar: npm install --save-dev cheerio'); process.exit(1);
}

// ── Config ────────────────────────────────────────────────────────────────
const RATE_LIMIT_MS = 1200;         // 1 req/1.2s para no banear IP
const MAX_RETRIES   = 2;
const OUTPUT_PATH   = path.join(__dirname, '../prisma/cuits-encontrados.json');
const EXCEL_NAME    = 'Registro Pcial de Transportistas de RRPP.xlsx';

// ── Args ──────────────────────────────────────────────────────────────────
const args = process.argv.slice(2);
const isDryRun = args.includes('--dry-run');
const verifikKey = (args.find(a => a.startsWith('--verifik-api-key=')) || '').split('=')[1];

// ── Helpers ───────────────────────────────────────────────────────────────
function normalizeCAA(caa: string): string {
  return caa.trim().replace(/\s*[–—\-]\s*/g, '-').replace(/^T-\s*/, 'T-');
}

function normalizeCUIT(raw: string): string {
  return raw.trim().replace(/\s+/g, '');
}

function sleep(ms: number) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// ── Busca CUIT en cuitonline.com por razón social ─────────────────────────
async function buscarEnCuitOnline(razonSocial: string): Promise<{
  cuit: string | null;
  nombreAfip: string | null;
  confianza: 'alta' | 'media' | 'baja' | 'no_encontrado' | 'error';
}> {
  const query = encodeURIComponent(razonSocial.substring(0, 40));
  const url   = `https://www.cuitonline.com/search/${query}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const resp = await axios.get(url, {
        timeout: 10000,
        headers: {
          'User-Agent': 'Mozilla/5.0 (compatible; SITREP-DPA-Mendoza/1.0; +https://sitrep.ultimamilla.com.ar)',
          'Accept': 'text/html',
        },
      });

      const $ = cheerio.load(resp.data as string);

      // cuitonline.com lista resultados en <table class="table">
      // Columnas: CUIT | Nombre | ...
      const firstRow = $('table tbody tr').first();
      if (!firstRow.length) {
        return { cuit: null, nombreAfip: null, confianza: 'no_encontrado' };
      }

      const cells = firstRow.find('td');
      const cuitCell    = cells.eq(0).text().trim();
      const nombreCell  = cells.eq(1).text().trim();

      const cuitMatch = cuitCell.match(/(\d{2}-\d{7,8}-\d)/);
      if (!cuitMatch) {
        return { cuit: null, nombreAfip: nombreCell || null, confianza: 'no_encontrado' };
      }

      const cuitFound = cuitMatch[1];

      // Calcular confianza por similitud de nombre
      const normalNombre   = razonSocial.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
      const normalNombreAf = nombreCell.toUpperCase().replace(/[^A-Z0-9 ]/g, '');
      const wordsSrc  = normalNombre.split(' ').filter(Boolean);
      const wordsDst  = normalNombreAf.split(' ').filter(Boolean);
      const matches   = wordsSrc.filter(w => wordsDst.includes(w)).length;
      const ratio     = wordsSrc.length > 0 ? matches / wordsSrc.length : 0;

      let confianza: 'alta' | 'media' | 'baja' = ratio >= 0.7 ? 'alta' : ratio >= 0.4 ? 'media' : 'baja';

      return { cuit: cuitFound, nombreAfip: nombreCell, confianza };

    } catch (err: any) {
      if (attempt === MAX_RETRIES) {
        return { cuit: null, nombreAfip: null, confianza: 'error' };
      }
      await sleep(RATE_LIMIT_MS * 2);
    }
  }
  return { cuit: null, nombreAfip: null, confianza: 'error' };
}

// ── Busca via Verifik API (alternativa pagada) ────────────────────────────
async function buscarEnVerifik(razonSocial: string, apiKey: string): Promise<{
  cuit: string | null;
  nombreAfip: string | null;
  confianza: 'alta' | 'media' | 'baja' | 'no_encontrado' | 'error';
}> {
  try {
    const resp = await axios.post(
      'https://api.verifik.co/v2/ar/afip/search',
      { query: razonSocial },
      {
        headers: { Authorization: `Bearer ${apiKey}`, 'Content-Type': 'application/json' },
        timeout: 10000,
      }
    );
    const data = resp.data?.data?.[0];
    if (!data?.cuit) return { cuit: null, nombreAfip: null, confianza: 'no_encontrado' };
    return {
      cuit: data.cuit,
      nombreAfip: data.razonSocial || null,
      confianza: 'alta',
    };
  } catch {
    return { cuit: null, nombreAfip: null, confianza: 'error' };
  }
}

// ── MAIN ──────────────────────────────────────────────────────────────────
async function main() {
  console.log('=== BÚSQUEDA DE CUITs — Registro Provincial Transportistas RRPP ===\n');
  if (isDryRun) console.log('⚠️  MODO DRY-RUN: no se consultará la web\n');
  if (verifikKey) console.log('🔑 Usando Verifik API\n');

  // Localizar Excel
  const candidates = [
    path.join(__dirname, '../../', EXCEL_NAME),
    path.join(__dirname, '../../../', EXCEL_NAME),
    path.join('/tmp', EXCEL_NAME),
  ];
  let excelPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { excelPath = p; break; }
  }
  if (!excelPath) {
    console.error(`ERROR: No se encontró "${EXCEL_NAME}"`);
    process.exit(1);
  }
  console.log(`Excel: ${excelPath}`);

  // Leer Excel
  const workbook = XLSX.readFile(excelPath, { raw: true });
  const sheet    = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Encontrar header
  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    if (rawRows[i].some((c: any) => String(c).toUpperCase().includes('CAA'))) {
      headerIdx = i; break;
    }
  }
  const dataRows = rawRows.slice(headerIdx + 1).filter((r: any[]) => r.some((c: any) => c !== ''));

  // Cargar output existente para no repetir trabajo
  let existing: any[] = [];
  if (fs.existsSync(OUTPUT_PATH)) {
    existing = JSON.parse(fs.readFileSync(OUTPUT_PATH, 'utf-8'));
    console.log(`Output existente: ${existing.length} entradas previas`);
  }
  const existingMap = new Map(existing.map((e: any) => [e.caa, e]));

  // Filtrar solo los sin CUIT real
  const pendientes = dataRows.filter((row: any[]) => {
    const cuit = String(row[2] || '').trim();
    return !cuit || cuit === '' || cuit.startsWith('CAA');
  });

  console.log(`Total filas: ${dataRows.length}`);
  console.log(`Con CUIT vacío/placeholder: ${pendientes.length}`);
  console.log(`Ya procesados antes: ${existing.filter((e: any) => e.cuitEncontrado).length}\n`);

  const results: any[] = [...existing];
  let processed = 0;

  for (const row of pendientes) {
    const caaRaw     = String(row[0] || '').trim();
    const razonSocial = String(row[1] || '').trim();
    if (!razonSocial) continue;

    const caa = normalizeCAA(caaRaw);

    // Si ya procesado, saltar
    if (existingMap.has(caa)) {
      console.log(`  SKIP (ya procesado): ${razonSocial}`);
      continue;
    }

    process.stdout.write(`  [${++processed}/${pendientes.length}] ${razonSocial.substring(0, 40)}... `);

    let result: any = { caa, razonSocial, cuitEncontrado: null, confianza: 'no_procesado', nombreAfip: null };

    if (!isDryRun) {
      let found;
      if (verifikKey) {
        found = await buscarEnVerifik(razonSocial, verifikKey);
      } else {
        found = await buscarEnCuitOnline(razonSocial);
      }
      result = {
        caa,
        razonSocial,
        cuitEncontrado: found.cuit,
        confianza: found.confianza,
        nombreAfip: found.nombreAfip,
      };
      console.log(`${found.cuit || 'no encontrado'} (${found.confianza})`);
      await sleep(RATE_LIMIT_MS);
    } else {
      console.log('(dry-run)');
    }

    results.push(result);
    existingMap.set(caa, result);

    // Guardar progreso incremental cada 10 registros
    if (processed % 10 === 0) {
      fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));
      console.log(`  💾 Guardado parcial (${results.length} registros)`);
    }
  }

  // Guardar resultado final
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(results, null, 2));

  // Resumen
  const encontrados     = results.filter((r: any) => r.cuitEncontrado).length;
  const noEncontrados   = results.filter((r: any) => !r.cuitEncontrado).length;
  const alta            = results.filter((r: any) => r.confianza === 'alta').length;
  const media           = results.filter((r: any) => r.confianza === 'media').length;
  const baja            = results.filter((r: any) => r.confianza === 'baja').length;

  console.log('\n=== RESUMEN ===');
  console.log(`Total procesados: ${results.length}`);
  console.log(`CUITs encontrados: ${encontrados} (alta: ${alta}, media: ${media}, baja: ${baja})`);
  console.log(`No encontrados: ${noEncontrados}`);
  console.log(`\n✅ Output: ${OUTPUT_PATH}`);
  console.log('\n⚠️  IMPORTANTE: Revisar manualmente el JSON antes de ejecutar el seed.');
  console.log('   Corregir/descartar entradas con confianza "media" o "baja".');
  console.log('   Luego ejecutar: npx ts-node backend/prisma/seed-transportistas-reales.ts');
}

main().catch(err => {
  console.error('Error fatal:', err);
  process.exit(1);
});
