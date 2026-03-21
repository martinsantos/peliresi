/**
 * fix-transportista-null-fields.ts
 *
 * One-shot repair: re-reads the Excel source and fills NULL regulatory fields
 * on existing Transportista records. Does NOT create or delete records.
 *
 * Fields updated: corrientesAutorizadas, vencimientoHabilitacion, expedienteDPA,
 *   resolucionDPA, resolucionSSP, actaInspeccion, actaInspeccion2, localidad
 *
 * Usage (via SSH tunnel to production):
 *   DATABASE_URL="postgresql://directus:PASS@localhost:5433/trazabilidad_rrpp?schema=public" \
 *     npx ts-node prisma/fix-transportista-null-fields.ts
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';
import path from 'path';

let XLSX: any;
try {
  XLSX = require('xlsx');
} catch {
  console.error('ERROR: xlsx not installed. Run: npm install --save-dev xlsx');
  process.exit(1);
}

const prisma = new PrismaClient();

function normalizeCAA(caa: string): string {
  return caa.trim().replace(/\s*[–—\-]\s*/g, '-').replace(/^T-\s*/, 'T-');
}

function normalizeCUIT(raw: any): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, '');
}

function parseFecha(val: any): Date | null {
  if (!val) return null;
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    return null;
  }
  const s = String(val).trim();
  if (!s) return null;
  const parts = s.split('/');
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts.map((p: string) => parseInt(p, 10));
    if (!isNaN(mm) && !isNaN(dd) && !isNaN(yyyy) && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

async function main() {
  console.log('=== FIX TRANSPORTISTA NULL FIELDS ===\n');

  // Locate Excel
  const excelName = 'Registro Pcial de Transportistas de RRPP.xlsx';
  const candidates = [
    path.join(__dirname, '../../', excelName),
    path.join(__dirname, '../../../', excelName),
    path.join('/tmp', excelName),
    path.join(__dirname, excelName),
  ];
  let excelPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { excelPath = p; break; }
  }
  if (!excelPath) {
    console.error(`ERROR: Excel not found:\n${candidates.join('\n')}`);
    process.exit(1);
  }
  console.log(`Excel: ${excelPath}`);

  // Load CUITs map (optional)
  const cuitsJsonPath = path.join(__dirname, 'cuits-encontrados.json');
  const cuitsMap = new Map<string, string>();
  if (fs.existsSync(cuitsJsonPath)) {
    const cuitsData: Array<{ caa: string; cuitEncontrado: string | null }> = JSON.parse(
      fs.readFileSync(cuitsJsonPath, 'utf-8')
    );
    for (const entry of cuitsData) {
      if (entry.cuitEncontrado) {
        cuitsMap.set(normalizeCAA(entry.caa), normalizeCUIT(entry.cuitEncontrado));
      }
    }
    console.log(`CUITs confirmados: ${cuitsMap.size}`);
  }

  // Read Excel
  const workbook = XLSX.readFile(excelPath, { cellDates: false, cellNF: false, raw: true });
  const sheet = workbook.Sheets[workbook.SheetNames[0]];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  let headerIdx = 0;
  for (let i = 0; i < Math.min(5, rawRows.length); i++) {
    const row = rawRows[i].map((c: any) => String(c).toUpperCase().trim());
    if (row.some((c: string) => c.includes('CAA') || c.includes('RAZ'))) {
      headerIdx = i;
      break;
    }
  }
  const dataRows = rawRows.slice(headerIdx + 1).filter(row =>
    row.some((c: any) => c !== '' && c !== null && c !== undefined)
  );
  console.log(`Filas de datos: ${dataRows.length}\n`);

  let updated = 0;
  let skipped = 0;
  let notFound = 0;
  const errores: string[] = [];

  for (const rawRow of dataRows) {
    const caaRaw = String(rawRow[0] || '').trim();
    const razonSocial = String(rawRow[1] || '').trim();
    const cuitRaw = normalizeCUIT(rawRow[2]);
    if (!caaRaw && !razonSocial) continue;

    const numeroHabilitacion = normalizeCAA(caaRaw);
    let cuit = cuitRaw;
    if (!cuit && cuitsMap.has(numeroHabilitacion)) {
      cuit = cuitsMap.get(numeroHabilitacion)!;
    }
    if (!cuit) {
      const caaNum = caaRaw.replace(/[^0-9]/g, '').padStart(6, '0');
      cuit = `CAA-T-${caaNum}`;
    }

    // Find existing transportista
    const transportista = await prisma.transportista.findUnique({ where: { cuit } });
    if (!transportista) {
      notFound++;
      continue;
    }

    // Check if any regulatory field is NULL
    const corrientes = String(rawRow[6] || '').trim() || null;
    const vtoRaw = rawRow[7];
    const vencimiento = parseFecha(vtoRaw);
    const expteDPA = String(rawRow[3] || '').trim() || null;
    const localidad = String(rawRow[5] || '').trim() || null;
    const resolucionDPA = String(rawRow[8] || '').trim() || null;
    const resolucionSSP = String(rawRow[9] || '').trim() || null;
    const actaInsp = String(rawRow[12] || '').trim() || null;
    const actaInsp2 = String(rawRow[13] || '').trim() || null;

    // Only update fields that are NULL in DB but have data in Excel
    const updateData: Record<string, any> = {};
    if (!transportista.corrientesAutorizadas && corrientes) updateData.corrientesAutorizadas = corrientes;
    if (!transportista.vencimientoHabilitacion && vencimiento) updateData.vencimientoHabilitacion = vencimiento;
    if (!transportista.expedienteDPA && expteDPA) updateData.expedienteDPA = expteDPA;
    if (!transportista.localidad && localidad) updateData.localidad = localidad;
    if (!transportista.resolucionDPA && resolucionDPA) updateData.resolucionDPA = resolucionDPA;
    if (!transportista.resolucionSSP && resolucionSSP) updateData.resolucionSSP = resolucionSSP;
    if (!transportista.actaInspeccion && actaInsp) updateData.actaInspeccion = actaInsp;
    if (!transportista.actaInspeccion2 && actaInsp2) updateData.actaInspeccion2 = actaInsp2;

    if (Object.keys(updateData).length === 0) {
      skipped++;
      continue;
    }

    try {
      await prisma.transportista.update({
        where: { id: transportista.id },
        data: updateData,
      });
      updated++;
      console.log(`  ~ ${razonSocial} (${cuit}): updated ${Object.keys(updateData).join(', ')}`);
    } catch (err: any) {
      errores.push(`${razonSocial} (${cuit}): ${err.message}`);
    }
  }

  console.log('\n=== RESUMEN ===');
  console.log(`Transportistas actualizados: ${updated}`);
  console.log(`Sin cambios necesarios:      ${skipped}`);
  console.log(`No encontrados en DB:        ${notFound}`);

  if (errores.length > 0) {
    console.log(`\nERRORES (${errores.length}):`);
    for (const e of errores) console.log(`  - ${e}`);
  } else {
    console.log('\nSin errores.');
  }

  // Verification
  console.log('\n=== VERIFICACION ===');
  const totalTrans = await prisma.transportista.count();
  const conVTO = await prisma.transportista.count({ where: { vencimientoHabilitacion: { not: null } } });
  const conCorrientes = await prisma.transportista.count({ where: { corrientesAutorizadas: { not: null } } });
  const conLocalidad = await prisma.transportista.count({ where: { localidad: { not: null } } });
  console.log(`Total Transportistas:        ${totalTrans}`);
  console.log(`Con vencimientoHabilitacion:  ${conVTO} (${((conVTO / totalTrans) * 100).toFixed(1)}%)`);
  console.log(`Con corrientesAutorizadas:    ${conCorrientes} (${((conCorrientes / totalTrans) * 100).toFixed(1)}%)`);
  console.log(`Con localidad:               ${conLocalidad} (${((conLocalidad / totalTrans) * 100).toFixed(1)}%)`);
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
