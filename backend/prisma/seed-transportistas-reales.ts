/**
 * seed-transportistas-reales.ts
 *
 * Importación de transportistas reales desde el registro oficial DPA Mendoza.
 * Lee directamente el Excel: "Registro Pcial de Transportistas de RRPP.xlsx"
 * (buscado en ../../ relativo a backend/prisma/, o en /tmp/)
 *
 * Columnas del Excel (índice 0-based):
 *  0: CAA                    → Transportista.numeroHabilitacion (normalizado)
 *  1: RAZÓN SOCIAL           → Transportista.razonSocial + Usuario.nombre
 *  2: CUIT                   → Transportista.cuit (o placeholder si vacío)
 *  3: EXPTE. DPA             → Transportista.expedienteDPA
 *  4: DOMICILIO              → Transportista.domicilio
 *  5: LOC.                   → Transportista.localidad + sufijo en domicilio
 *  6: CORRIENTES AUTH.       → Transportista.corrientesAutorizadas
 *  7: VTO.                   → Transportista.vencimientoHabilitacion (NO Vehiculo)
 *  8: Resol DPA              → Transportista.resolucionDPA
 *  9: Resol SSP              → Transportista.resolucionSSP
 * 10: VIGENCIA               → ignorado (calculable desde vencimientoHabilitacion)
 * 11: Unidades Habilitadas   → Vehiculo.patente[] (multilínea)
 * 12: Acta Insp.             → Transportista.actaInspeccion
 * 13: Acta Insp.2            → Transportista.actaInspeccion2
 * 14: Observaciones          → ignorado (100% vacío)
 *
 * CUITs: si existe backend/prisma/cuits-encontrados.json, los CUITs confirmados
 * reemplazan placeholders. Si no, se usa placeholder "CAA-T-XXXXXX".
 *
 * Idempotente: upsert por CUIT y patente.
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';
// xlsx es una dependencia dev; si no está instalada, el script falla con mensaje claro
let XLSX: any;
try {
  XLSX = require('xlsx');
} catch {
  console.error('ERROR: xlsx no está instalado. Ejecutar: npm install --save-dev xlsx');
  process.exit(1);
}

const prisma = new PrismaClient();

// ============================================================
// 1. NORMALIZACIÓN DE CAA: "T – 000014" → "T-000014"
// ============================================================
function normalizeCAA(caa: string): string {
  return caa
    .trim()
    .replace(/\s*[–—\-]\s*/g, '-')
    .replace(/^T-\s*/, 'T-');
}

// ============================================================
// 2. PARSEO DE FECHA: acepta serial Excel (número) y string MM/DD/YYYY
// ============================================================
function parseFecha(val: any): Date | null {
  if (!val) return null;
  // Excel serial number
  if (typeof val === 'number') {
    const d = XLSX.SSF.parse_date_code(val);
    if (d) return new Date(Date.UTC(d.y, d.m - 1, d.d));
    return null;
  }
  const s = String(val).trim();
  if (!s) return null;
  // MM/DD/YYYY
  const parts = s.split('/');
  if (parts.length === 3) {
    const [mm, dd, yyyy] = parts.map((p: string) => parseInt(p, 10));
    if (!isNaN(mm) && !isNaN(dd) && !isNaN(yyyy) && mm >= 1 && mm <= 12 && dd >= 1 && dd <= 31) {
      return new Date(Date.UTC(yyyy, mm - 1, dd));
    }
  }
  // Intento genérico
  const d = new Date(s);
  return isNaN(d.getTime()) ? null : d;
}

// ============================================================
// 3. PARSEO DE PATENTES (campo multilínea)
// ============================================================
function parsePatentes(raw: any): string[] {
  if (!raw) return [];
  return String(raw)
    .split(/[\n\r]+/)
    .map((line: string) => line.trim().toUpperCase())
    .filter((line: string) => line.length > 0 && line !== '-');
}

// ============================================================
// 4. NORMALIZAR CUIT: "30-12345678-9" → mantener formato, limpiar espacios
// ============================================================
function normalizeCUIT(raw: any): string {
  if (!raw) return '';
  return String(raw).trim().replace(/\s+/g, '');
}

// ============================================================
// 5. MAIN
// ============================================================
async function main() {
  console.log('=== MIGRACIÓN DE TRANSPORTISTAS REALES (DPA Mendoza) ===\n');

  // --- Localizar Excel ---
  const excelName = 'Registro Pcial de Transportistas de RRPP.xlsx';
  const candidates = [
    path.join(__dirname, '../../', excelName),          // proyecto raíz
    path.join(__dirname, '../../../', excelName),       // un nivel más arriba
    path.join('/tmp', excelName),
    path.join(__dirname, excelName),
  ];
  let excelPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { excelPath = p; break; }
  }
  if (!excelPath) {
    console.error(`ERROR: No se encontró "${excelName}" en:\n${candidates.join('\n')}`);
    process.exit(1);
  }
  console.log(`Excel encontrado: ${excelPath}`);

  // --- Cargar CUITs confirmados (opcional) ---
  const cuitsJsonPath = path.join(__dirname, 'cuits-encontrados.json');
  const cuitsMap = new Map<string, string>(); // caa → cuit
  if (fs.existsSync(cuitsJsonPath)) {
    const cuitsData: Array<{ caa: string; cuitEncontrado: string | null }> = JSON.parse(
      fs.readFileSync(cuitsJsonPath, 'utf-8')
    );
    for (const entry of cuitsData) {
      if (entry.cuitEncontrado) {
        cuitsMap.set(normalizeCAA(entry.caa), normalizeCUIT(entry.cuitEncontrado));
      }
    }
    console.log(`CUITs confirmados cargados: ${cuitsMap.size}`);
  } else {
    console.log('Aviso: cuits-encontrados.json no encontrado — se usarán placeholders para CUITs vacíos');
  }

  // --- Leer Excel ---
  const workbook = XLSX.readFile(excelPath, { cellDates: false, cellNF: false, raw: true });
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rawRows: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: '' });

  // Encontrar fila de encabezado (buscar fila que contenga "CAA" o "RAZÓN")
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
  console.log(`Filas de datos: ${dataRows.length} (header en fila ${headerIdx})\n`);

  // --- Contadores ---
  let transportistasCreados   = 0;
  let transportistasActualizados = 0;
  let vehiculosCreados        = 0;
  let vehiculosActualizados   = 0;
  let filasOmitidas           = 0;
  const errores: string[]     = [];
  const warnings: string[]    = [];

  for (const rawRow of dataRows) {
    const caaRaw         = String(rawRow[0]  || '').trim();
    const razonSocial    = String(rawRow[1]  || '').trim();
    const cuitRaw        = normalizeCUIT(rawRow[2]);
    const expteDPA       = String(rawRow[3]  || '').trim() || null;
    const domicilioBase  = String(rawRow[4]  || '').trim();
    const localidad      = String(rawRow[5]  || '').trim() || null;
    const corrientes     = String(rawRow[6]  || '').trim() || null;
    const vtoRaw         = rawRow[7];
    const resolucionDPA  = String(rawRow[8]  || '').trim() || null;
    const resolucionSSP  = String(rawRow[9]  || '').trim() || null;
    // col 10: VIGENCIA — ignorado
    const unidadesRaw    = rawRow[11];
    const actaInsp       = String(rawRow[12] || '').trim() || null;
    const actaInsp2      = String(rawRow[13] || '').trim() || null;

    // Validación mínima
    if (!caaRaw && !razonSocial) {
      filasOmitidas++;
      continue;
    }
    if (!razonSocial) {
      console.log(`  SKIP: fila sin razón social (CAA: "${caaRaw}")`);
      filasOmitidas++;
      continue;
    }

    const numeroHabilitacion = normalizeCAA(caaRaw);

    // Determinar CUIT
    let cuit = cuitRaw;
    if (!cuit && cuitsMap.has(numeroHabilitacion)) {
      cuit = cuitsMap.get(numeroHabilitacion)!;
    }
    if (!cuit) {
      // Placeholder único por CAA
      const caaNum = caaRaw.replace(/[^0-9]/g, '').padStart(6, '0');
      cuit = `CAA-T-${caaNum}`;
      warnings.push(`${razonSocial}: CUIT no disponible → placeholder ${cuit}`);
    }

    // Domicilio combinado
    const domicilio = [domicilioBase, localidad]
      .filter(Boolean)
      .join(', ') || 'Sin datos';

    // Fechas
    const vencimientoHabilitacion = parseFecha(vtoRaw);
    // Fecha proxy para vehículos si no hay VTO individual
    const vtoVehiculo = vencimientoHabilitacion ?? new Date('2026-12-31T00:00:00Z');

    // Patentes
    const patentes = parsePatentes(unidadesRaw);

    // Email y password
    const cuitDigits = cuit.replace(/[^0-9]/g, '');
    const email      = `transportista.${cuitDigits || numeroHabilitacion.replace(/[^A-Z0-9]/g, '').toLowerCase()}@sitrep.local`;

    try {
      // --------------------------------------------------------
      // A. Upsert Usuario (rol TRANSPORTISTA)
      // --------------------------------------------------------
      let usuario = await prisma.usuario.findUnique({ where: { cuit } });

      if (usuario) {
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: { nombre: razonSocial, rol: 'TRANSPORTISTA' },
        });
      } else {
        const emailExistente = await prisma.usuario.findUnique({ where: { email } });
        const emailFinal = emailExistente
          ? `transportista.${cuitDigits || Date.now()}.${Date.now()}@sitrep.local`
          : email;
        if (emailExistente) {
          warnings.push(`${razonSocial}: email ${email} ya existe, usando ${emailFinal}`);
        }
        const password = await bcrypt.hash(cuit, 10);
        usuario = await prisma.usuario.create({
          data: {
            email: emailFinal,
            password,
            rol:      'TRANSPORTISTA',
            cuit,
            nombre:   razonSocial,
            apellido: '',
          },
        });
      }

      // --------------------------------------------------------
      // B. Upsert Transportista con todos los campos regulatorios
      // --------------------------------------------------------
      const transportistaData = {
        razonSocial,
        domicilio,
        numeroHabilitacion,
        localidad,
        corrientesAutorizadas: corrientes,
        vencimientoHabilitacion,
        expedienteDPA: expteDPA,
        resolucionDPA,
        resolucionSSP,
        actaInspeccion: actaInsp,
        actaInspeccion2: actaInsp2,
      };

      let transportista = await prisma.transportista.findUnique({ where: { cuit } });

      if (transportista) {
        transportista = await prisma.transportista.update({
          where: { id: transportista.id },
          data: transportistaData,
        });
        transportistasActualizados++;
      } else {
        transportista = await prisma.transportista.create({
          data: {
            usuarioId: usuario.id,
            cuit,
            telefono:  'S/D',
            email:     usuario.email,
            ...transportistaData,
          },
        });
        transportistasCreados++;
      }

      // --------------------------------------------------------
      // C. Upsert Vehículos (por patente + transportistaId)
      // --------------------------------------------------------
      for (const patente of patentes) {
        const vehiculoExistente = await prisma.vehiculo.findFirst({
          where: { patente, transportistaId: transportista.id },
        });

        if (vehiculoExistente) {
          await prisma.vehiculo.update({
            where: { id: vehiculoExistente.id },
            data: { vencimiento: vtoVehiculo },
          });
          vehiculosActualizados++;
        } else {
          await prisma.vehiculo.create({
            data: {
              transportistaId:   transportista.id,
              patente,
              marca:             'S/D',
              modelo:            'S/D',
              anio:              2020,
              capacidad:         0.0,
              numeroHabilitacion,
              vencimiento:       vtoVehiculo,
            },
          });
          vehiculosCreados++;
        }
      }

      const vtoStr = vencimientoHabilitacion
        ? vencimientoHabilitacion.toISOString().split('T')[0]
        : 'sin VTO';
      console.log(
        `  ✓ ${razonSocial} (${cuit}) — ${numeroHabilitacion}, veh: ${patentes.length}, VTO: ${vtoStr}`
      );

    } catch (err: any) {
      const msg = `ERROR ${razonSocial} (${cuit}): ${err.message}`;
      errores.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  // --- RESUMEN ---
  console.log('\n=== RESUMEN ===');
  console.log(`Transportistas creados:      ${transportistasCreados}`);
  console.log(`Transportistas actualizados: ${transportistasActualizados}`);
  console.log(`Vehículos creados:           ${vehiculosCreados}`);
  console.log(`Vehículos actualizados:      ${vehiculosActualizados}`);
  console.log(`Filas omitidas:              ${filasOmitidas}`);

  if (warnings.length > 0) {
    console.log(`\nADVERTENCIAS (${warnings.length}):`);
    for (const w of warnings) console.log(`  ⚠ ${w}`);
  }
  if (errores.length > 0) {
    console.log(`\nERRORES (${errores.length}):`);
    for (const e of errores) console.log(`  ✗ ${e}`);
  } else {
    console.log('\nSin errores.');
  }

  // --- VERIFICACIÓN FINAL ---
  console.log('\n=== VERIFICACIÓN ===');
  const totalTransportistas = await prisma.transportista.count();
  const totalVehiculos      = await prisma.vehiculo.count();
  const totalConVTO         = await prisma.transportista.count({ where: { vencimientoHabilitacion: { not: null } } });
  const totalConLocalidad   = await prisma.transportista.count({ where: { localidad: { not: null } } });
  const totalConCorrientes  = await prisma.transportista.count({ where: { corrientesAutorizadas: { not: null } } });
  const totalPlaceholder    = await prisma.transportista.count({ where: { cuit: { startsWith: 'CAA-T-' } } });
  console.log(`Total Transportistas:        ${totalTransportistas}`);
  console.log(`Total Vehículos:             ${totalVehiculos}`);
  console.log(`Con vencimientoHabilitacion: ${totalConVTO}`);
  console.log(`Con localidad:               ${totalConLocalidad}`);
  console.log(`Con corrientes autorizadas:  ${totalConCorrientes}`);
  console.log(`CUITs placeholder (CAA-T-):  ${totalPlaceholder}`);
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
