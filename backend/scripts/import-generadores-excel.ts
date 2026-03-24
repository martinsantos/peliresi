/**
 * Import Generadores enrichment data from Excel files into Prisma DB.
 *
 * Sources:
 *   File 3 (master): docs/data/planilla-generadores-2026.xlsx → Generador fields + DDJJ
 *   File 1 (pagos):  docs/data/control-pago-notificaciones.xlsx → PagoTEF records
 *
 * Usage: cd backend && npx ts-node scripts/import-generadores-excel.ts
 *
 * Idempotent: uses upsert, safe to run multiple times.
 */

import * as XLSX from 'xlsx';
import * as path from 'path';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

const MASTER_FILE = path.resolve(__dirname, '../../docs/data/planilla-generadores-2026.xlsx');
const PAGOS_FILE = path.resolve(__dirname, '../../docs/data/control-pago-notificaciones.xlsx');

function normalizeCuit(raw: any): string {
  if (!raw) return '';
  return String(raw).replace(/[^0-9]/g, '');
}

function formatCuitDashed(digits: string): string {
  if (digits.length === 11) {
    return `${digits.slice(0, 2)}-${digits.slice(2, 10)}-${digits.slice(10)}`;
  }
  return digits;
}

function parseArgMoney(val: any): number | null {
  if (val === undefined || val === null || val === '') return null;
  if (typeof val === 'number') return val;
  // "$ 39.204,00" → 39204.00
  const s = String(val).replace(/\$/g, '').replace(/\s/g, '').replace(/\./g, '').replace(',', '.');
  const n = parseFloat(s);
  return isNaN(n) ? null : n;
}

function excelDateToJs(serial: any): Date | null {
  if (!serial) return null;
  if (typeof serial === 'number') {
    // Excel serial date
    const utc_days = Math.floor(serial - 25569);
    return new Date(utc_days * 86400 * 1000);
  }
  if (typeof serial === 'string') {
    const d = new Date(serial);
    return isNaN(d.getTime()) ? null : d;
  }
  return null;
}

function parseBool(val: any): boolean {
  if (!val) return false;
  const s = String(val).toUpperCase().trim();
  return s === 'SI' || s === 'YES' || s === 'TRUE' || s === '1' || s === 'S';
}

async function importMasterFile() {
  console.log('\n=== Importing master file (generadores) ===');
  const wb = XLSX.readFile(MASTER_FILE);
  const ws = wb.Sheets['REGISTRO'];
  if (!ws) { console.log('Sheet REGISTRO not found'); return; }

  const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
  const headers = rows[0] as string[];
  console.log(`Found ${rows.length - 1} rows`);

  // Column indices (based on actual headers)
  const COL = {
    CERTIFICADO: 0,
    EXPEDIENTE: 1,
    RAZON_SOCIAL: 2,
    CUIT: 3,
    ACTIVIDAD: 4,
    RUBRO: 5,
    DOM_LEGAL_CALLE: 6,
    DOM_LEGAL_LOC: 7,
    DOM_LEGAL_DEPTO: 8,
    DOM_REAL_CALLE: 9,
    DOM_REAL_LOC: 10,
    DOM_REAL_DEPTO: 11,
    EMAIL: 12,
    TELEFONO: 13,
    ISO: 14,
    CATEGORIAS: 15,
    RESOLUCION: 16,
    R: 17,
    MXR: 18,
    INDIV: 19,
    INFORME: 20,
    TEF_2025: 21,
    LIBRO: 22,
    DDJJ_2021: 23,
    DDJJ_2022: 24,
    DDJJ_2023: 25,
    DDJJ_2024: 26,
    DDJJ_2024B: 27,
    DDJJ_2025: 28,
    DDJJ_2026: 29,
  };

  let updated = 0;
  let notFound = 0;

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row || !row[COL.CUIT]) continue;

    const cuitRaw = normalizeCuit(row[COL.CUIT]);
    if (!cuitRaw || cuitRaw.length < 10) continue;

    const cuitDashed = formatCuitDashed(cuitRaw);
    // Try both formats
    const gen = await prisma.generador.findFirst({
      where: { OR: [{ cuit: cuitRaw }, { cuit: cuitDashed }] }
    });

    if (!gen) {
      notFound++;
      continue;
    }

    // Update generador fields
    try {
      await prisma.generador.update({
        where: { id: gen.id },
        data: {
          expedienteInscripcion: row[COL.EXPEDIENTE] ? String(row[COL.EXPEDIENTE]).trim() : undefined,
          domicilioLegalCalle: row[COL.DOM_LEGAL_CALLE] ? String(row[COL.DOM_LEGAL_CALLE]).trim() : undefined,
          domicilioLegalLocalidad: row[COL.DOM_LEGAL_LOC] ? String(row[COL.DOM_LEGAL_LOC]).trim() : undefined,
          domicilioLegalDepto: row[COL.DOM_LEGAL_DEPTO] ? String(row[COL.DOM_LEGAL_DEPTO]).trim() : undefined,
          domicilioRealCalle: row[COL.DOM_REAL_CALLE] ? String(row[COL.DOM_REAL_CALLE]).trim() : undefined,
          domicilioRealLocalidad: row[COL.DOM_REAL_LOC] ? String(row[COL.DOM_REAL_LOC]).trim() : undefined,
          domicilioRealDepto: row[COL.DOM_REAL_DEPTO] ? String(row[COL.DOM_REAL_DEPTO]).trim() : undefined,
          certificacionISO: excelDateToJs(row[COL.ISO]),
          resolucionInscripcion: row[COL.RESOLUCION] ? String(row[COL.RESOLUCION]).trim() : undefined,
          factorR: row[COL.R] != null ? Number(row[COL.R]) || undefined : undefined,
          montoMxR: parseArgMoney(row[COL.MXR]),
          categoriaIndividual: row[COL.INDIV] ? String(row[COL.INDIV]).trim() : undefined,
          libroOperatoria: row[COL.LIBRO] ? parseBool(row[COL.LIBRO]) : undefined,
        }
      });

      // Upsert DDJJ records
      const ddjjCols = [
        { anio: 2021, col: COL.DDJJ_2021 },
        { anio: 2022, col: COL.DDJJ_2022 },
        { anio: 2023, col: COL.DDJJ_2023 },
        { anio: 2024, col: COL.DDJJ_2024 },
        { anio: 2025, col: COL.DDJJ_2025 },
        { anio: 2026, col: COL.DDJJ_2026 },
      ];

      for (const { anio, col } of ddjjCols) {
        const val = row[col];
        if (val === undefined || val === null) continue;
        const presentada = !!val; // non-empty = presentada
        const numeroGDE = typeof val === 'number' ? String(val) : typeof val === 'string' ? val.trim() : undefined;

        await prisma.declaracionJurada.upsert({
          where: { generadorId_anio: { generadorId: gen.id, anio } },
          update: { presentada, numeroGDE },
          create: { generadorId: gen.id, anio, presentada, numeroGDE },
        });
      }

      updated++;
    } catch (err: any) {
      console.error(`Error updating ${cuitDashed}: ${err.message}`);
    }
  }

  console.log(`Updated: ${updated}, Not found in DB: ${notFound}`);
}

async function importPagosFile() {
  console.log('\n=== Importing pagos file ===');
  const wb = XLSX.readFile(PAGOS_FILE);
  let totalPagos = 0;

  for (const sheetName of wb.SheetNames) {
    // Extract year from sheet name like "REGISTRO 2018"
    const yearMatch = sheetName.match(/(\d{4})/);
    if (!yearMatch) continue;
    const anio = parseInt(yearMatch[1]);

    const ws = wb.Sheets[sheetName];
    const rows = XLSX.utils.sheet_to_json(ws, { header: 1 }) as any[][];
    if (rows.length < 2) continue;

    const headers = (rows[0] || []).map((h: any) => h != null ? String(h).toUpperCase().trim() : '');

    // Find column indices by header name patterns
    const findCol = (patterns: string[]): number => {
      return headers.findIndex(h => h && patterns.some(p => h.includes(p)));
    };

    const colCert = findCol(['CERTIFICADO']);
    const colCuit = findCol(['CUIT']);
    const colTef = findCol(['TEF']);
    const colResol = findCol(['RESOL']);
    const colNotif = findCol(['NOTIF. ENVIADA', 'NOTIFICADO']);
    const colFechaNotif = findCol(['FECHA NOTIFICADO']);
    const colFechaPago = findCol(['FECHA DE PAGO']);
    const colHab = findCol(['HABILITACION']);
    const colFuera = findCol(['FUERA DE TERMINO']);
    const colGedoResol = findCol(['GEDO RESOL']);
    const colGedoNotif = findCol(['GEDO NOTIF', 'GEO NOTIF']);

    console.log(`Sheet ${sheetName}: ${rows.length - 1} rows, TEF col: ${colTef}, CUIT col: ${colCuit}`);

    for (let i = 1; i < rows.length; i++) {
      const row = rows[i];
      if (!row) continue;

      // Need CUIT or CERTIFICADO to identify generator
      const certRaw = colCert >= 0 ? String(row[colCert] || '').trim() : '';
      const cuitRaw = colCuit >= 0 ? normalizeCuit(row[colCuit]) : '';

      if (!cuitRaw && !certRaw) continue;

      // Find generator by CUIT or certificado search
      let gen: any = null;
      if (cuitRaw && cuitRaw.length >= 10) {
        const cuitDashed = formatCuitDashed(cuitRaw);
        gen = await prisma.generador.findFirst({
          where: { OR: [{ cuit: cuitRaw }, { cuit: cuitDashed }] }
        });
      }
      if (!gen) continue; // Can't match without CUIT in DB

      const tef = colTef >= 0 ? parseArgMoney(row[colTef]) : null;
      const resol = colResol >= 0 && row[colResol] ? String(row[colResol]).trim() : null;
      const notificado = colNotif >= 0 ? parseBool(row[colNotif]) : false;
      const fechaNotif = colFechaNotif >= 0 ? excelDateToJs(row[colFechaNotif]) : null;
      const fechaPago = colFechaPago >= 0 ? excelDateToJs(row[colFechaPago]) : null;
      const habilitado = colHab >= 0 ? parseBool(row[colHab]) : null;
      const fuera = colFuera >= 0 ? parseBool(row[colFuera]) : false;
      const gedoResol = colGedoResol >= 0 && row[colGedoResol] ? String(row[colGedoResol]).trim() : null;
      const gedoNotif = colGedoNotif >= 0 && row[colGedoNotif] ? String(row[colGedoNotif]).trim() : null;

      try {
        await prisma.pagoTEF.upsert({
          where: { generadorId_anio: { generadorId: gen.id, anio } },
          update: {
            montoTEF: tef, resolucion: resol, notificado, fechaNotificado: fechaNotif,
            fechaPago, habilitado, pagoFueraTermino: fuera, gedoResolucion: gedoResol, gedoNotificacion: gedoNotif
          },
          create: {
            generadorId: gen.id, anio, montoTEF: tef, resolucion: resol, notificado,
            fechaNotificado: fechaNotif, fechaPago, habilitado, pagoFueraTermino: fuera,
            gedoResolucion: gedoResol, gedoNotificacion: gedoNotif
          }
        });
        totalPagos++;
      } catch (err: any) {
        // Skip duplicates or errors silently
      }
    }
  }

  console.log(`Total pagos upserted: ${totalPagos}`);
}

async function main() {
  console.log('=== Generadores Excel Import ===');
  console.log('Master file:', MASTER_FILE);
  console.log('Pagos file:', PAGOS_FILE);

  await importMasterFile();
  await importPagosFile();

  console.log('\nDone!');
  await prisma.$disconnect();
}

main().catch(err => {
  console.error(err);
  prisma.$disconnect();
  process.exit(1);
});
