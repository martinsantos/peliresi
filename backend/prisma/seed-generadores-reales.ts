/**
 * seed-generadores-reales.ts
 *
 * Importación de generadores reales desde el registro oficial DPA Mendoza.
 * Lee el CSV: "generadores21012926" (copiado como "generadores-reales.csv" en backend/prisma/)
 *
 * Columnas del CSV (índice 0-based):
 *  0: CERTIFICADO          → Generador.numeroInscripcion (normalizado "G-000001")
 *  1: EXPEDIENTE           → ignorado
 *  2: RAZON SOCIAL         → Generador.razonSocial
 *  3: CUIT                 → Generador.cuit (clave de upsert)
 *  4: ACTIVIDAD            → Generador.actividad
 *  5: RUBRO                → Generador.rubro
 *  6: DOMICILIO (calle)    → parte de domicilio
 *  7: DOMICILIO (localidad)→ parte de domicilio
 *  8: DEPARTAMENTO         → parte de domicilio
 *  9-11: (otros domicilios)→ ignorados
 * 12: CORREO ELECTRONICO   → email (primera dirección si hay múltiples)
 * 13: TELEFONOS            → Generador.telefono
 * 14: (ignorado)
 * 15: CATEGORIAS DE CONTROL→ Generador.categoria + corrientesControl
 *
 * Idempotente: upsert por CUIT.
 * Performance: bcrypt cost=8 (~65ms/record × 1500 = ~100s total — aceptable para seed único)
 *
 * Preparación previa (ejecutar antes de correr este script):
 *   cp "/Volumes/SDTERA/ultima milla/.../datos/generadores21012926" \
 *      "backend/prisma/generadores-reales.csv"
 *
 * Ejecución via SSH tunnel:
 *   DATABASE_URL="postgresql://directus:PASS@localhost:5433/trazabilidad_rrpp?schema=public" \
 *     npx ts-node prisma/seed-generadores-reales.ts
 */

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================
// 1. CSV PARSER (handles multiline quoted fields)
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
// 2. NORMALIZAR CERTIFICADO: "G - 000001" → "G-000001"
// ============================================================
function normalizeCertificado(cert: string): string {
  return cert
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[–—-]\s*/g, '-')
    .replace(/^G-\s*/, 'G-');
}

// ============================================================
// 3. MAIN
// ============================================================
async function main() {
  console.log('=== MIGRACIÓN DE GENERADORES REALES (DPA Mendoza) ===\n');

  // --- Localizar CSV ---
  const candidates = [
    path.join(__dirname, 'generadores-reales.csv'),
    path.join(__dirname, '../../..', 'datos/generadores21012926'),
    path.join(__dirname, '../..', 'datos/generadores21012926'),
  ];
  let csvPath: string | null = null;
  for (const p of candidates) {
    if (fs.existsSync(p)) { csvPath = p; break; }
  }
  if (!csvPath) {
    console.error(`ERROR: No se encontró el archivo de generadores en:\n${candidates.join('\n')}`);
    console.error('\nSolución: copiar el archivo fuente a backend/prisma/generadores-reales.csv');
    process.exit(1);
  }
  console.log(`CSV encontrado: ${csvPath}`);

  // --- Leer y parsear CSV ---
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const allRows = parseCSV(csvContent);

  const header = allRows[0];
  const dataRows = allRows.slice(1);
  console.log(`CSV leído: ${dataRows.length} filas de datos, ${header.length} columnas`);
  console.log(`Header: ${header.slice(0, 10).join(' | ')} ...\n`);

  // --- Contadores ---
  let generadoresCreados = 0;
  let generadoresActualizados = 0;
  let filasOmitidas = 0;
  const errores: string[] = [];
  const warnings: string[] = [];

  for (let i = 0; i < dataRows.length; i++) {
    const row = dataRows[i];

    const cuit = (row[3] || '').trim();
    if (!cuit) {
      filasOmitidas++;
      continue;
    }

    // Validar formato CUIT: XX-XXXXXXXX-X
    const cuitValido = /^\d{2}-\d{8}-\d$/.test(cuit);
    if (!cuitValido) {
      warnings.push(`${(row[2] || '').trim()}: CUIT malformado [${cuit}], importando con warning`);
    }

    const razonSocial = (row[2] || '').trim() || `Generador ${cuit}`;
    const certificado = normalizeCertificado(row[0] || '');
    const actividad   = (row[4] || '').trim() || null;
    const rubro       = (row[5] || '').trim() || null;

    // Domicilio: join calle + localidad + departamento
    const domParts = [row[6], row[7], row[8]].map(v => (v || '').trim()).filter(Boolean);
    const domicilio = domParts.join(', ') || 'Sin datos';

    // Email: primera dirección si hay múltiples (separadas por , o ;)
    const emailRaw   = (row[12] || '').trim();
    const emailParts = emailRaw.split(/[,;\s]+/).map(e => e.trim()).filter(e => e.includes('@'));
    const emailBase  = emailParts[0] || '';

    const telefono = (row[13] || '').trim() || 'S/D';

    // Categorías de control (col 15)
    const categoriasRaw  = (row[15] || '').trim();
    const categoria      = categoriasRaw || 'SIN CATEGORÍA';
    const corrientesControl = categoriasRaw || null;

    // Email final (se ajusta si ya existe en DB)
    const cuitDigits = cuit.replace(/[^0-9]/g, '');
    const emailFallback = `generador.${cuitDigits}@sitrep.local`;
    let email = emailBase || emailFallback;

    try {
      // --- Upsert Usuario ---
      let usuario = await prisma.usuario.findUnique({ where: { cuit } });

      if (usuario) {
        // No sobrescribir rol si usuario ya tiene otro rol (multi-rol)
        const updateData: Record<string, any> = { nombre: razonSocial };
        if (usuario.rol === 'GENERADOR' || !usuario.rol) {
          updateData.rol = 'GENERADOR';
        }
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: updateData,
        });
      } else {
        // Verificar si email ya está tomado por otro CUIT
        const emailExistente = await prisma.usuario.findUnique({ where: { email } });
        if (emailExistente) {
          email = emailFallback;
          warnings.push(`${razonSocial} (${cuit}): email "${emailBase}" ya usado → ${emailFallback}`);
          // También verificar el fallback
          const fallbackExistente = await prisma.usuario.findUnique({ where: { email: emailFallback } });
          if (fallbackExistente) {
            email = `generador.${cuitDigits}.${Date.now()}@sitrep.local`;
          }
        }

        const password = await bcrypt.hash(cuit, 8); // cost=8 por volumen (~100s total)
        usuario = await prisma.usuario.create({
          data: {
            email,
            password,
            rol:      'GENERADOR',
            cuit,
            nombre:   razonSocial,
            apellido: '',
            telefono: telefono !== 'S/D' ? telefono : undefined,
          },
        });
      }

      // --- Upsert Generador ---
      const generador = await prisma.generador.findUnique({ where: { cuit } });

      if (generador) {
        await prisma.generador.update({
          where: { id: generador.id },
          data: {
            razonSocial,
            domicilio,
            telefono,
            email,
            numeroInscripcion: certificado,
            categoria,
            actividad,
            rubro,
            corrientesControl,
          },
        });
        generadoresActualizados++;
      } else {
        await prisma.generador.create({
          data: {
            usuarioId: usuario.id,
            razonSocial,
            cuit,
            domicilio,
            telefono,
            email,
            numeroInscripcion: certificado,
            categoria,
            actividad,
            rubro,
            corrientesControl,
          },
        });
        generadoresCreados++;
      }

      // Progress log cada 100 registros
      if ((i + 1) % 100 === 0) {
        console.log(`  Progreso: ${i + 1}/${dataRows.length} filas procesadas (creados: ${generadoresCreados}, actualizados: ${generadoresActualizados})`);
      }

    } catch (err: any) {
      const msg = `ERROR ${razonSocial} (${cuit}): ${err.message}`;
      errores.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  // --- RESUMEN ---
  console.log('\n=== RESUMEN ===');
  console.log(`Generadores creados:      ${generadoresCreados}`);
  console.log(`Generadores actualizados: ${generadoresActualizados}`);
  console.log(`Filas omitidas (sin CUIT): ${filasOmitidas}`);

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

  // --- VERIFICACIÓN ---
  console.log('\n=== VERIFICACIÓN ===');
  const totalGeneradores = await prisma.generador.count();
  const totalUsuariosGen = await prisma.usuario.count({ where: { rol: 'GENERADOR' } });
  console.log(`Total Generadores en DB:           ${totalGeneradores}`);
  console.log(`Total Usuarios con rol GENERADOR:  ${totalUsuariosGen}`);
}

main()
  .catch(err => {
    console.error('Error fatal:', err);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
