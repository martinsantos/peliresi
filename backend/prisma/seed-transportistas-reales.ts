/**
 * seed-transportistas-reales.ts
 *
 * Importación de transportistas reales desde el registro oficial DPA Mendoza.
 * CSV: backend/prisma/transporte.csv (o /tmp/transporte.csv en el servidor)
 *
 * Columnas del CSV:
 *  0: CAA               → Transportista.numeroHabilitacion (normalizado)
 *  1: RAZÓN SOCIAL      → Transportista.razonSocial + Usuario.nombre
 *  2: CUIT              → Transportista.cuit + Usuario.cuit (clave única)
 *  3: EXPTE. DPA        → ignorado (info registral extra)
 *  4: DOMICILIO         → Transportista.domicilio (base)
 *  5: LOC.              → Transportista.domicilio (sufijo)
 *  6: CORRIENTES AUTH.  → ignorado (no hay campo en modelo Transportista)
 *  7: VTO.              → Vehiculo.vencimiento (formato MM/DD/YYYY)
 *  8: Resol DPA         → ignorado
 *  9: Resol SSP         → ignorado
 * 10: VIGENCIA          → ignorado
 * 11: Unidades Habili.  → Vehiculo.patente (campo quoted multilínea)
 * 12-14: Actas/Obs.     → ignorado
 *
 * Campos sin datos en CSV (placeholders auditables):
 *  Transportista.telefono   → "S/D"
 *  Transportista.email      → transportista.{cuitDigits}@sitrep.local
 *  Vehiculo.marca           → "S/D"
 *  Vehiculo.modelo          → "S/D"
 *  Vehiculo.anio            → 2020
 *  Vehiculo.capacidad       → 0.0
 *  Vehiculo.numeroHabili.   → mismo CAA normalizado
 *
 * Idempotente: se puede ejecutar múltiples veces (upsert por CUIT y patente).
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================
// 1. CSV PARSER — maneja campos quoted con saltos de línea
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

// ============================================================
// 2. NORMALIZACIÓN DE CAA
// "T - 000014" → "T-000014"
// ============================================================
function normalizeCAA(caa: string): string {
  return caa
    .trim()
    .replace(/\s*[–—-]\s*/g, '-')  // normalizar guiones y espacios alrededor
    .replace(/^T\s*-\s*/, 'T-')
    .replace(/^T-\s*/, 'T-');
}

// ============================================================
// 3. PARSEO DE FECHA VTO. (MM/DD/YYYY → Date)
// Devuelve null si no se puede parsear.
// ============================================================
function parseVTO(vto: string): Date | null {
  if (!vto || !vto.trim()) return null;
  const parts = vto.trim().split('/');
  if (parts.length !== 3) return null;
  const [mm, dd, yyyy] = parts.map(p => parseInt(p, 10));
  if (isNaN(mm) || isNaN(dd) || isNaN(yyyy)) return null;
  if (mm < 1 || mm > 12 || dd < 1 || dd > 31) return null;
  return new Date(Date.UTC(yyyy, mm - 1, dd));
}

// ============================================================
// 4. PARSEO DE PATENTES (campo multilínea)
// Cada línea puede ser una patente distinta.
// Normaliza: trim + uppercase + elimina líneas vacías.
// ============================================================
function parsePatentes(raw: string): string[] {
  if (!raw || !raw.trim()) return [];
  return raw
    .split('\n')
    .map(line => line.trim().toUpperCase())
    .filter(line => line.length > 0 && line !== '-' && !/^\s*$/.test(line));
}

// ============================================================
// 5. PARSEO DE FILA CSV
// ============================================================
interface CSVRow {
  caa: string;            // col 0
  razonSocial: string;    // col 1
  cuit: string;           // col 2
  expteDPA: string;       // col 3
  domicilio: string;      // col 4
  localidad: string;      // col 5
  corrientes: string;     // col 6
  vto: string;            // col 7
  unidades: string;       // col 11
}

function parseRow(row: string[]): CSVRow {
  return {
    caa:         (row[0]  || '').trim(),
    razonSocial: (row[1]  || '').trim(),
    cuit:        (row[2]  || '').trim(),
    expteDPA:    (row[3]  || '').trim(),
    domicilio:   (row[4]  || '').trim(),
    localidad:   (row[5]  || '').trim(),
    corrientes:  (row[6]  || '').trim(),
    vto:         (row[7]  || '').trim(),
    unidades:    (row[11] || '').trim(),
  };
}

// ============================================================
// 6. MAIN
// ============================================================
async function main() {
  console.log('=== MIGRACIÓN DE TRANSPORTISTAS REALES (DPA Mendoza) ===\n');

  // --- Localizar CSV ---
  const localPath = path.join(__dirname, 'transporte.csv');
  const tmpPath   = '/tmp/transporte.csv';
  let csvPath: string;

  if (fs.existsSync(localPath)) {
    csvPath = localPath;
    console.log(`CSV encontrado en: ${localPath}`);
  } else if (fs.existsSync(tmpPath)) {
    csvPath = tmpPath;
    console.log(`CSV encontrado en: ${tmpPath}`);
  } else {
    console.error('ERROR: No se encontró transporte.csv en ./prisma/ ni en /tmp/');
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const allRows    = parseCSV(csvContent);
  const header     = allRows[0];
  const dataRows   = allRows.slice(1);

  console.log(`CSV leído: ${dataRows.length} filas, ${header.length} columnas`);
  console.log(`Columnas: ${header.join(' | ')}\n`);

  // --- Contadores ---
  let transportistasCreados   = 0;
  let transportistasActualizados = 0;
  let vehiculosCreados        = 0;
  let vehiculosActualizados   = 0;
  let filasOmitidas           = 0;
  const errores: string[]     = [];

  // --- Procesar cada fila ---
  for (const rawRow of dataRows) {
    const row = parseRow(rawRow);

    // Validación mínima
    if (!row.cuit || !row.razonSocial) {
      console.log(`  WARN: fila sin CUIT o razón social, omitida: "${row.razonSocial || '(vacío)'}"`);
      filasOmitidas++;
      continue;
    }

    // Construir campos
    const numeroHabilitacion = normalizeCAA(row.caa);

    const domicilio = [row.domicilio, row.localidad]
      .filter(Boolean)
      .join(', ') || 'Sin datos';

    const cuitDigits = row.cuit.replace(/[^0-9]/g, '');
    const email      = `transportista.${cuitDigits}@sitrep.local`;
    const password   = await bcrypt.hash(row.cuit, 10);

    const vencimiento = parseVTO(row.vto) ?? new Date('2025-12-31T00:00:00Z');
    const patentes    = parsePatentes(row.unidades);

    try {
      // --------------------------------------------------------
      // A. Upsert Usuario (rol TRANSPORTISTA)
      // --------------------------------------------------------
      let usuario = await prisma.usuario.findUnique({ where: { cuit: row.cuit } });

      if (usuario) {
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            nombre: row.razonSocial,
            rol: 'TRANSPORTISTA',
          },
        });
      } else {
        // Verificar colisión de email
        const emailExistente = await prisma.usuario.findUnique({ where: { email } });
        const emailFinal = emailExistente
          ? `transportista.${cuitDigits}.${Date.now()}@sitrep.local`
          : email;

        if (emailExistente) {
          console.log(`  WARN: email ${email} ya existe, usando ${emailFinal}`);
        }

        usuario = await prisma.usuario.create({
          data: {
            email: emailFinal,
            password,
            rol:      'TRANSPORTISTA',
            cuit:     row.cuit,
            nombre:   row.razonSocial,
            apellido: '',
            telefono: undefined,
          },
        });
      }

      // --------------------------------------------------------
      // B. Upsert Transportista
      // --------------------------------------------------------
      let transportista = await prisma.transportista.findUnique({
        where: { cuit: row.cuit },
      });

      if (transportista) {
        transportista = await prisma.transportista.update({
          where: { id: transportista.id },
          data: {
            razonSocial:       row.razonSocial,
            domicilio,
            numeroHabilitacion,
          },
        });
        transportistasActualizados++;
      } else {
        transportista = await prisma.transportista.create({
          data: {
            usuarioId:         usuario.id,
            razonSocial:       row.razonSocial,
            cuit:              row.cuit,
            domicilio,
            telefono:          'S/D',
            email:             usuario.email,
            numeroHabilitacion,
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
            data: { vencimiento },
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
              vencimiento,
            },
          });
          vehiculosCreados++;
        }
      }

      console.log(
        `  ✓ ${row.razonSocial} (${row.cuit}) — CAA: ${numeroHabilitacion}, vehículos: ${patentes.length}`
      );

    } catch (err: any) {
      const msg = `ERROR ${row.razonSocial} (${row.cuit}): ${err.message}`;
      errores.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  // --- RESUMEN ---
  console.log('\n=== RESUMEN ===');
  console.log(`Transportistas creados:    ${transportistasCreados}`);
  console.log(`Transportistas actualizados: ${transportistasActualizados}`);
  console.log(`Vehículos creados:         ${vehiculosCreados}`);
  console.log(`Vehículos actualizados:    ${vehiculosActualizados}`);
  console.log(`Filas omitidas:            ${filasOmitidas}`);

  if (errores.length > 0) {
    console.log(`\nERRORES (${errores.length}):`);
    for (const e of errores) console.log(`  - ${e}`);
  } else {
    console.log('\nSin errores.');
  }

  // --- VERIFICACIÓN FINAL ---
  console.log('\n=== VERIFICACIÓN ===');
  const totalTransportistas = await prisma.transportista.count();
  const totalVehiculos      = await prisma.vehiculo.count();
  const totalUsuariosTrans  = await prisma.usuario.count({ where: { rol: 'TRANSPORTISTA' } });
  console.log(`Total Transportistas en DB:      ${totalTransportistas}`);
  console.log(`Total Vehículos en DB:           ${totalVehiculos}`);
  console.log(`Total Usuarios TRANSPORTISTA:    ${totalUsuariosTrans}`);
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
