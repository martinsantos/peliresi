/**
 * fix-multi-role-actors.ts
 *
 * One-shot repair script: creates missing actor records for CUITs that appear
 * in multiple source files (Generador + Operador, Generador + Transportista, etc.)
 * but only have ONE actor record in the DB because seeds overwrote each other.
 *
 * Does NOT touch Usuario.rol — only creates missing Generador/Operador records.
 *
 * Usage (via SSH tunnel to production):
 *   DATABASE_URL="postgresql://directus:PASS@localhost:5433/trazabilidad_rrpp?schema=public" \
 *     npx ts-node prisma/fix-multi-role-actors.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================
// CSV PARSER (same as seed scripts — handles multiline quoted fields)
// ============================================================
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let inQuotes = false;
  let row: string[] = [];
  let field = '';

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++;
      } else if (ch === '"') {
        inQuotes = false;
      } else {
        field += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        row.push(field);
        field = '';
      } else if (ch === '\n' || (ch === '\r' && next === '\n')) {
        row.push(field);
        field = '';
        if (row.length > 1 || row[0] !== '') {
          rows.push(row);
        }
        row = [];
        if (ch === '\r') i++;
      } else {
        field += ch;
      }
    }
  }
  if (field || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
  }
  return rows;
}

function normalizeCertificado(cert: string, prefix: string): string {
  return cert
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[–—-]\s*/g, '-')
    .replace(new RegExp(`^${prefix}\\s*-\\s*`), `${prefix}-`)
    .replace(new RegExp(`^${prefix}-\\s*`), `${prefix}-`);
}

// ============================================================
// MAIN
// ============================================================
async function main() {
  console.log('=== FIX MULTI-ROLE ACTORS ===\n');

  // ----------------------------------------------------------
  // 1. Load generadores CSV → map of CUIT → data
  // ----------------------------------------------------------
  const genCandidates = [
    path.join(__dirname, 'generadores-reales.csv'),
    path.join(__dirname, '../../..', 'datos/generadores21012926'),
    path.join(__dirname, '../..', 'datos/generadores21012926'),
  ];
  let genCsvPath: string | null = null;
  for (const p of genCandidates) {
    if (fs.existsSync(p)) { genCsvPath = p; break; }
  }
  if (!genCsvPath) {
    console.error('ERROR: generadores CSV not found');
    process.exit(1);
  }
  console.log(`Generadores CSV: ${genCsvPath}`);

  const genRows = parseCSV(fs.readFileSync(genCsvPath, 'utf-8'));
  const genDataRows = genRows.slice(1); // skip header

  interface GenData {
    razonSocial: string;
    cuit: string;
    certificado: string;
    actividad: string | null;
    rubro: string | null;
    domicilio: string;
    email: string;
    telefono: string;
    categoria: string;
    corrientesControl: string | null;
  }

  const genByCuit = new Map<string, GenData>();
  for (const row of genDataRows) {
    const cuit = (row[3] || '').trim();
    if (!cuit) continue;
    const razonSocial = (row[2] || '').trim() || `Generador ${cuit}`;
    const domParts = [row[6], row[7], row[8]].map(v => (v || '').trim()).filter(Boolean);
    const emailRaw = (row[12] || '').trim();
    const emailParts = emailRaw.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    const cuitDigits = cuit.replace(/[^0-9]/g, '');

    genByCuit.set(cuit, {
      razonSocial,
      cuit,
      certificado: normalizeCertificado(row[0] || '', 'G'),
      actividad: (row[4] || '').trim() || null,
      rubro: (row[5] || '').trim() || null,
      domicilio: domParts.join(', ') || 'Sin datos',
      email: emailParts[0] || `generador.${cuitDigits}@sitrep.local`,
      telefono: (row[13] || '').trim() || 'S/D',
      categoria: (row[15] || '').trim() || 'SIN CATEGORIA',
      corrientesControl: (row[15] || '').trim() || null,
    });
  }
  console.log(`Generadores en CSV: ${genByCuit.size}`);

  // ----------------------------------------------------------
  // 2. Load operadores CSV → map of CUIT → data
  // ----------------------------------------------------------
  const operCandidates = [
    path.join(__dirname, 'operadores-reales-v2.csv'),
    path.join(__dirname, 'operadores-reales.csv'),
  ];
  let operCsvPath: string | null = null;
  for (const p of operCandidates) {
    if (fs.existsSync(p)) { operCsvPath = p; break; }
  }
  if (!operCsvPath) {
    console.error('ERROR: operadores CSV not found');
    process.exit(1);
  }
  console.log(`Operadores CSV: ${operCsvPath}`);

  const operRows = parseCSV(fs.readFileSync(operCsvPath, 'utf-8'));
  const operDataRows = operRows.slice(1);

  interface OperData {
    empresa: string;
    cuit: string;
    certificado: string;
    telefono: string;
    email: string;
    domicilio: string;
    categoria: string;
    tipoOperador: string | null;
    tecnologia: string | null;
    corrientesY: string | null;
  }

  // Group operadores by CUIT (same CUIT can have multiple rows for FIJO/IN SITU)
  const operByCuit = new Map<string, OperData>();
  const operGrouped = new Map<string, typeof operDataRows>();
  for (const row of operDataRows) {
    const cuit = (row[3] || '').trim();
    if (!cuit) continue;
    const existing = operGrouped.get(cuit) || [];
    existing.push(row);
    operGrouped.set(cuit, existing);
  }

  for (const [cuit, rows] of operGrouped) {
    const first = rows[0];
    const empresa = (first[2] || '').trim();
    const certificados = rows.map(r => normalizeCertificado((r[0] || '').trim(), 'O'));
    const categorias = rows.map(r => (r[12] || '').trim());
    const tecnologias = rows.map(r => (r[13] || '').trim());
    const domParts = [(first[6] || '').trim(), (first[7] || '').trim(), (first[8] || '').trim()].filter(Boolean);
    const emailParts = (first[5] || '').trim().split(/[;\s]+/).filter((e: string) => e.includes('@'));
    const cuitDigits = cuit.replace(/[^0-9]/g, '');

    operByCuit.set(cuit, {
      empresa,
      cuit,
      certificado: certificados.join(' / '),
      telefono: (first[4] || '').trim() || '',
      email: emailParts[0] || `operador.${cuitDigits}@sitrep.local`,
      domicilio: domParts.join(', ') || 'Sin datos',
      categoria: [...new Set(categorias)].join(' / '),
      tipoOperador: categorias[0]?.trim() || null,
      tecnologia: [...new Set(tecnologias)].join(' | ') || null,
      corrientesY: (first[14] || '').trim() || null,
    });
  }
  console.log(`Operadores en CSV: ${operByCuit.size}`);

  // ----------------------------------------------------------
  // 3. Find CUITs present in multiple source files
  // ----------------------------------------------------------
  const allGenCuits = new Set(genByCuit.keys());
  const allOperCuits = new Set(operByCuit.keys());

  // We don't load transportistas from Excel here — the existing transportista
  // records in DB are already correct. We only need to create missing Gen/Oper records.

  const multiRoleCuits = new Set<string>();
  for (const cuit of allGenCuits) {
    if (allOperCuits.has(cuit)) multiRoleCuits.add(cuit);
  }
  // Also check gen CUITs that exist as transportistas in DB
  const transportistasCuits = await prisma.transportista.findMany({
    select: { cuit: true },
  });
  const transCuitSet = new Set(transportistasCuits.map(t => t.cuit));
  for (const cuit of allGenCuits) {
    if (transCuitSet.has(cuit)) multiRoleCuits.add(cuit);
  }
  for (const cuit of allOperCuits) {
    if (transCuitSet.has(cuit)) multiRoleCuits.add(cuit);
  }

  console.log(`\nCUITs multi-rol detectados: ${multiRoleCuits.size}`);

  // ----------------------------------------------------------
  // 4. For each multi-role CUIT, create missing actor records
  // ----------------------------------------------------------
  let genCreados = 0;
  let operCreados = 0;
  let errores: string[] = [];
  let skipped = 0;

  for (const cuit of multiRoleCuits) {
    const usuario = await prisma.usuario.findUnique({ where: { cuit } });
    if (!usuario) {
      errores.push(`${cuit}: Usuario not found in DB — skipping`);
      continue;
    }

    // Check if Generador record exists
    const genExists = await prisma.generador.findUnique({ where: { cuit } });
    const genSource = genByCuit.get(cuit);

    if (!genExists && genSource) {
      // Check if this usuario already has a generador (by usuarioId)
      const genByUser = await prisma.generador.findUnique({ where: { usuarioId: usuario.id } });
      if (genByUser) {
        console.log(`  SKIP ${cuit}: usuario already linked to generador ${genByUser.cuit}`);
        skipped++;
      } else {
        try {
          await prisma.generador.create({
            data: {
              usuarioId: usuario.id,
              razonSocial: genSource.razonSocial,
              cuit: genSource.cuit,
              domicilio: genSource.domicilio,
              telefono: genSource.telefono,
              email: genSource.email,
              numeroInscripcion: genSource.certificado,
              categoria: genSource.categoria,
              actividad: genSource.actividad,
              rubro: genSource.rubro,
              corrientesControl: genSource.corrientesControl,
            },
          });
          genCreados++;
          console.log(`  + Generador: ${genSource.razonSocial} (${cuit})`);
        } catch (err: any) {
          // usuarioId unique constraint — user already has a generador from different CUIT
          if (err.code === 'P2002') {
            console.log(`  SKIP ${cuit}: unique constraint on generador.usuarioId — user already linked`);
            skipped++;
          } else {
            errores.push(`Generador ${cuit}: ${err.message}`);
          }
        }
      }
    }

    // Check if Operador record exists
    const operExists = await prisma.operador.findUnique({ where: { cuit } });
    const operSource = operByCuit.get(cuit);

    if (!operExists && operSource) {
      const operByUser = await prisma.operador.findUnique({ where: { usuarioId: usuario.id } });
      if (operByUser) {
        console.log(`  SKIP ${cuit}: usuario already linked to operador ${operByUser.cuit}`);
        skipped++;
      } else {
        try {
          await prisma.operador.create({
            data: {
              usuarioId: usuario.id,
              razonSocial: operSource.empresa,
              cuit: operSource.cuit,
              domicilio: operSource.domicilio,
              telefono: operSource.telefono,
              email: operSource.email,
              numeroHabilitacion: operSource.certificado,
              categoria: operSource.categoria,
              tipoOperador: operSource.tipoOperador,
              tecnologia: operSource.tecnologia,
              corrientesY: operSource.corrientesY,
            },
          });
          operCreados++;
          console.log(`  + Operador: ${operSource.empresa} (${cuit})`);
        } catch (err: any) {
          if (err.code === 'P2002') {
            console.log(`  SKIP ${cuit}: unique constraint on operador.usuarioId — user already linked`);
            skipped++;
          } else {
            errores.push(`Operador ${cuit}: ${err.message}`);
          }
        }
      }
    }
  }

  // ----------------------------------------------------------
  // 5. Clean up TEST entry
  // ----------------------------------------------------------
  const testCuit = '30-99887766-5';
  const testUser = await prisma.usuario.findUnique({ where: { cuit: testCuit } });
  if (testUser) {
    // Check it has no manifiestos before deleting
    const manifCount = await prisma.manifiesto.count({
      where: {
        OR: [
          { generador: { cuit: testCuit } },
          { transportista: { cuit: testCuit } },
          { operador: { cuit: testCuit } },
        ],
      },
    });
    if (manifCount === 0) {
      // Delete associated actor records first
      await prisma.generador.deleteMany({ where: { cuit: testCuit } });
      await prisma.operador.deleteMany({ where: { cuit: testCuit } });
      await prisma.transportista.deleteMany({ where: { cuit: testCuit } });
      await prisma.usuario.delete({ where: { cuit: testCuit } });
      console.log(`\n  - Deleted TEST entry: ${testCuit}`);
    } else {
      console.log(`\n  WARN: TEST entry ${testCuit} has ${manifCount} manifiestos — not deleting`);
    }
  } else {
    console.log(`\n  TEST entry ${testCuit} not found in DB (already clean)`);
  }

  // ----------------------------------------------------------
  // 6. Summary
  // ----------------------------------------------------------
  console.log('\n=== RESUMEN ===');
  console.log(`Generadores creados:  ${genCreados}`);
  console.log(`Operadores creados:   ${operCreados}`);
  console.log(`Skipped (constraint): ${skipped}`);

  if (errores.length > 0) {
    console.log(`\nERRORES (${errores.length}):`);
    for (const e of errores) console.log(`  - ${e}`);
  } else {
    console.log('\nSin errores.');
  }

  // Verification
  console.log('\n=== VERIFICACION ===');
  const totalGen = await prisma.generador.count();
  const totalOper = await prisma.operador.count();
  const totalTrans = await prisma.transportista.count();
  console.log(`Total Generadores:    ${totalGen}`);
  console.log(`Total Operadores:     ${totalOper}`);
  console.log(`Total Transportistas: ${totalTrans}`);
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
