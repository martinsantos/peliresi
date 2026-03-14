import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import fs from 'fs';
import path from 'path';

const prisma = new PrismaClient();

// ============================================================
// 1. TIPOS DE RESIDUO FALTANTES (Y16-Y48, R9)
// ============================================================
const tiposResiduoFaltantes = [
  { codigo: 'Y16', nombre: 'Productos Químicos para Fotografía', categoria: 'Químicos', peligrosidad: 'Tóxico' },
  { codigo: 'Y17', nombre: 'Residuos de Tratamiento de Metales', categoria: 'Metales', peligrosidad: 'Tóxico, Corrosivo' },
  { codigo: 'Y18', nombre: 'Residuos de Operaciones de Eliminación Industrial', categoria: 'Industriales', peligrosidad: 'Tóxico' },
  { codigo: 'Y20', nombre: 'Berilio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico, Cancerígeno' },
  { codigo: 'Y21', nombre: 'Compuestos de Cromo Hexavalente', categoria: 'Metales Pesados', peligrosidad: 'Tóxico, Cancerígeno' },
  { codigo: 'Y22', nombre: 'Compuestos de Cobre', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y23', nombre: 'Compuestos de Zinc', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y24', nombre: 'Arsénico y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico, Cancerígeno' },
  { codigo: 'Y25', nombre: 'Selenio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y26', nombre: 'Cadmio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico, Cancerígeno' },
  { codigo: 'Y27', nombre: 'Antimonio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y29', nombre: 'Mercurio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y30', nombre: 'Talio y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y31', nombre: 'Plomo y sus Compuestos', categoria: 'Metales Pesados', peligrosidad: 'Tóxico' },
  { codigo: 'Y32', nombre: 'Compuestos Inorgánicos de Flúor', categoria: 'Inorgánicos', peligrosidad: 'Tóxico' },
  { codigo: 'Y33', nombre: 'Cianuros Inorgánicos', categoria: 'Inorgánicos', peligrosidad: 'Muy Tóxico' },
  { codigo: 'Y34', nombre: 'Soluciones Ácidas', categoria: 'Ácidos', peligrosidad: 'Corrosivo' },
  { codigo: 'Y35', nombre: 'Soluciones Básicas', categoria: 'Bases', peligrosidad: 'Corrosivo' },
  { codigo: 'Y36', nombre: 'Asbesto (Amianto)', categoria: 'Minerales', peligrosidad: 'Cancerígeno' },
  { codigo: 'Y37', nombre: 'Compuestos Orgánicos de Fósforo', categoria: 'Orgánicos', peligrosidad: 'Tóxico' },
  { codigo: 'Y38', nombre: 'Cianuros Orgánicos', categoria: 'Orgánicos', peligrosidad: 'Muy Tóxico' },
  { codigo: 'Y39', nombre: 'Fenoles y Compuestos Fenólicos', categoria: 'Orgánicos', peligrosidad: 'Tóxico' },
  { codigo: 'Y40', nombre: 'Éteres', categoria: 'Orgánicos', peligrosidad: 'Tóxico, Inflamable' },
  { codigo: 'Y41', nombre: 'Solventes Orgánicos Halogenados', categoria: 'Disolventes', peligrosidad: 'Tóxico, Cancerígeno' },
  { codigo: 'Y42', nombre: 'Solventes Orgánicos (excl. halogenados)', categoria: 'Disolventes', peligrosidad: 'Tóxico, Inflamable' },
  { codigo: 'Y48', nombre: 'Residuos Peligrosos Varios', categoria: 'General', peligrosidad: 'Tóxico' },
  { codigo: 'R9', nombre: 'Regeneración de Aceites Usados', categoria: 'Recuperación', peligrosidad: 'Tóxico' },
];

// ============================================================
// 2. CSV PARSER (handles multiline quoted fields)
// ============================================================
function parseCSV(content: string): string[][] {
  const rows: string[][] = [];
  let current = '';
  let inQuotes = false;
  let row: string[] = [];
  let field = '';

  for (let i = 0; i < content.length; i++) {
    const ch = content[i];
    const next = content[i + 1];

    if (inQuotes) {
      if (ch === '"' && next === '"') {
        field += '"';
        i++; // skip escaped quote
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
        if (ch === '\r') i++; // skip \n after \r
      } else {
        field += ch;
      }
    }
  }
  // last field/row
  if (field || row.length > 0) {
    row.push(field);
    if (row.length > 1 || row[0] !== '') {
      rows.push(row);
    }
  }

  return rows;
}

// ============================================================
// 3. CERTIFICADO NORMALIZER
// ============================================================
function normalizeCertificado(cert: string): string {
  // Normalize: remove extra spaces, standardize dashes (including en-dash)
  return cert
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/\s*[–—-]\s*/g, '-') // normalize all dash types
    .replace(/^O\s*-\s*/, 'O-')   // "O - 000001" → "O-000001"
    .replace(/^O-\s*/, 'O-');     // ensure no space after O-
}

// ============================================================
// 4. Y-CODE PARSER
// ============================================================
function parseCorrientes(corrientesStr: string): string[] {
  if (!corrientesStr || !corrientesStr.trim()) return [];

  let s = corrientesStr;
  // Step 1: "e Y" → ", Y" (for "Y8 e Y48")
  s = s.replace(/\s+e\s+Y/gi, ', Y');
  // Also handle "e Y" at the end that got trimmed
  s = s.replace(/\s+e\s+R/gi, ', R');
  // Step 2: "/" → ", "
  s = s.replace(/\s*\/\s*/g, ', ');
  // Step 3: "-" between Y-codes → ", " (e.g., "Y8-Y9-Y11")
  s = s.replace(/([YR]\d+)\s*-\s*([YR])/g, '$1, $2');
  // Step 4: Remove parentheses
  s = s.replace(/[()]/g, '');
  // Step 5: Split by comma
  const tokens = s.split(',');
  // Step 6-8: Trim, filter, validate, deduplicate
  const codes = new Set<string>();
  for (const token of tokens) {
    const trimmed = token.trim();
    if (/^[YR]\d+$/.test(trimmed)) {
      codes.add(trimmed);
    }
  }
  return Array.from(codes).sort((a, b) => {
    const prefA = a[0];
    const prefB = b[0];
    if (prefA !== prefB) return prefA < prefB ? -1 : 1;
    return parseInt(a.slice(1)) - parseInt(b.slice(1));
  });
}

// ============================================================
// 5. MAIN MIGRATION
// ============================================================
async function main() {
  console.log('=== MIGRACIÓN DE OPERADORES REALES (DPA Mendoza) ===\n');

  // --- Read and parse CSV ---
  // Buscar primero el archivo actualizado (v2 = operadores050226csv, 52 registros)
  // Fallback al archivo anterior (47 registros)
  const csvCandidates = [
    path.join(__dirname, 'operadores-reales-v2.csv'),
    path.join(__dirname, 'operadores-reales.csv'),
  ];
  let csvPath: string | null = null;
  for (const p of csvCandidates) {
    if (fs.existsSync(p)) { csvPath = p; break; }
  }
  if (!csvPath) {
    console.error(`ERROR: No se encontró el archivo de operadores en:\n${csvCandidates.join('\n')}`);
    console.error('\nSolución: copiar el archivo fuente a backend/prisma/operadores-reales-v2.csv');
    process.exit(1);
  }
  console.log(`CSV encontrado: ${csvPath}`);
  const csvContent = fs.readFileSync(csvPath!, 'utf-8');
  const allRows = parseCSV(csvContent);

  // First row is header
  const header = allRows[0];
  const dataRows = allRows.slice(1);
  console.log(`CSV leído: ${dataRows.length} filas de datos, ${header.length} columnas`);
  console.log(`Columnas: ${header.join(' | ')}\n`);

  // --- STEP 1: Upsert missing TipoResiduo ---
  console.log('--- Paso 1: Upsert TipoResiduo faltantes ---');
  let tiposCreados = 0;
  for (const tipo of tiposResiduoFaltantes) {
    const result = await prisma.tipoResiduo.upsert({
      where: { codigo: tipo.codigo },
      update: {},
      create: tipo,
    });
    // Check if it was newly created by comparing timestamps
    const isNew = result.createdAt.getTime() === result.updatedAt.getTime();
    if (isNew) tiposCreados++;
  }
  console.log(`  TipoResiduo: ${tiposCreados} nuevos creados, ${tiposResiduoFaltantes.length - tiposCreados} ya existían`);

  // Build residuos map
  const allResiduos = await prisma.tipoResiduo.findMany();
  const residuosMap = new Map(allResiduos.map(r => [r.codigo, r.id]));
  console.log(`  Total TipoResiduo en DB: ${allResiduos.length}\n`);

  // --- STEP 2: Group CSV rows by CUIT ---
  console.log('--- Paso 2: Agrupar por CUIT ---');

  interface CSVRow {
    certificado: string;
    empresa: string;
    cuit: string;
    telefono: string;
    email: string;
    domicilioLegal: string;
    barrio: string;
    departamento: string;
    categoria: string; // FIJO or IN SITU
    tecnologia: string;
    corrientes: string;
  }

  function parseRow(row: string[]): CSVRow {
    return {
      certificado: (row[0] || '').trim(),
      // row[1] = Expediente (descartado)
      empresa: (row[2] || '').trim(),
      cuit: (row[3] || '').trim(),
      telefono: (row[4] || '').trim(),
      email: (row[5] || '').trim(),
      domicilioLegal: (row[6] || '').trim(),
      barrio: (row[7] || '').trim(),
      departamento: (row[8] || '').trim(),
      // row[9-11] = Domicilio real (descartado)
      categoria: (row[12] || '').trim(),
      tecnologia: (row[13] || '').trim(),
      corrientes: (row[14] || '').trim(),
    };
  }

  // Group by CUIT
  const cuitGroups = new Map<string, CSVRow[]>();
  for (const row of dataRows) {
    const parsed = parseRow(row);
    if (!parsed.cuit) {
      console.log(`  WARN: fila sin CUIT, saltando: ${parsed.empresa}`);
      continue;
    }
    const existing = cuitGroups.get(parsed.cuit) || [];
    existing.push(parsed);
    cuitGroups.set(parsed.cuit, existing);
  }

  const duplicados = Array.from(cuitGroups.entries()).filter(([, rows]) => rows.length > 1);
  console.log(`  CUITs únicos: ${cuitGroups.size}`);
  console.log(`  CUITs duplicados: ${duplicados.length}`);
  for (const [cuit, rows] of duplicados) {
    console.log(`    ${cuit}: ${rows.map(r => `${r.certificado} (${r.categoria})`).join(' + ')}`);
  }
  console.log('');

  // --- STEP 3: Create Operadores ---
  console.log('--- Paso 3: Crear Usuarios + Operadores + TratamientoAutorizados ---');
  let operadoresCreados = 0;
  let operadoresActualizados = 0;
  let tratamientosCreados = 0;
  let errores: string[] = [];
  let codigosNoEncontrados = new Set<string>();

  for (const [cuit, rows] of cuitGroups) {
    const first = rows[0];

    // --- Merge strategy for duplicates ---
    let certificados: string[];
    let categorias: string[];
    let tecnologias: string[];
    let allCorrientes = new Set<string>();

    if (rows.length > 1) {
      certificados = rows.map(r => normalizeCertificado(r.certificado));
      categorias = rows.map(r => r.categoria);
      tecnologias = rows.map(r => r.tecnologia);
      for (const r of rows) {
        for (const code of parseCorrientes(r.corrientes)) {
          allCorrientes.add(code);
        }
      }
    } else {
      certificados = [normalizeCertificado(first.certificado)];
      categorias = [first.categoria];
      tecnologias = [first.tecnologia];
      for (const code of parseCorrientes(first.corrientes)) {
        allCorrientes.add(code);
      }
    }

    const numeroHabilitacion = certificados.join(' / ');
    const categoria = [...new Set(categorias)].join(' / ');
    const tecnologiaCompleta = [...new Set(tecnologias)].join(' | ');
    const corrientesSet = Array.from(allCorrientes);

    // Build domicilio
    const domParts = [first.domicilioLegal, first.barrio, first.departamento].filter(Boolean);
    const domicilio = domParts.join(', ');

    // Email: first email only (split by ; and take first)
    const emailParts = first.email.split(/[;\s]+/).filter(e => e.includes('@'));
    const email = emailParts[0] || `operador.${cuit.replace(/[^0-9]/g, '')}@placeholder.com`;

    // Password: bcrypt(CUIT)
    const password = await bcrypt.hash(cuit, 10);

    try {
      // --- Upsert Usuario ---
      // Try to find existing user by CUIT first (more reliable than email for operators)
      let usuario = await prisma.usuario.findUnique({ where: { cuit } });

      if (usuario) {
        // Update existing user
        usuario = await prisma.usuario.update({
          where: { id: usuario.id },
          data: {
            nombre: first.empresa,
            telefono: first.telefono || undefined,
            rol: 'OPERADOR',
          },
        });
      } else {
        // Check if email is already taken
        const existingByEmail = await prisma.usuario.findUnique({ where: { email } });
        if (existingByEmail) {
          // Email taken by different CUIT - use CUIT-based email
          const altEmail = `operador.${cuit.replace(/[^0-9]/g, '')}@sitrep.local`;
          usuario = await prisma.usuario.create({
            data: {
              email: altEmail,
              password,
              rol: 'OPERADOR',
              cuit,
              nombre: first.empresa,
              apellido: '',
              telefono: first.telefono || undefined,
            },
          });
          console.log(`  WARN: Email ${email} ya usado, creando con ${altEmail}`);
        } else {
          usuario = await prisma.usuario.create({
            data: {
              email,
              password,
              rol: 'OPERADOR',
              cuit,
              nombre: first.empresa,
              apellido: '',
              telefono: first.telefono || undefined,
            },
          });
        }
      }

      // --- Upsert Operador ---
      let operador = await prisma.operador.findUnique({ where: { cuit } });
      if (operador) {
        operador = await prisma.operador.update({
          where: { id: operador.id },
          data: {
            razonSocial: first.empresa,
            domicilio,
            telefono: first.telefono || '',
            email,
            numeroHabilitacion,
            categoria,
            tipoOperador: first.categoria.trim() || null,
            tecnologia: tecnologiaCompleta || null,
            corrientesY: first.corrientes.trim() || null,
          },
        });
        operadoresActualizados++;
      } else {
        operador = await prisma.operador.create({
          data: {
            usuarioId: usuario.id,
            razonSocial: first.empresa,
            cuit,
            domicilio,
            telefono: first.telefono || '',
            email,
            numeroHabilitacion,
            categoria,
            tipoOperador: first.categoria.trim() || null,
            tecnologia: tecnologiaCompleta || null,
            corrientesY: first.corrientes.trim() || null,
          },
        });
        operadoresCreados++;
      }

      // --- TratamientoAutorizados ---
      for (const codigo of corrientesSet) {
        const tipoResiduoId = residuosMap.get(codigo);
        if (!tipoResiduoId) {
          codigosNoEncontrados.add(codigo);
          continue;
        }

        await prisma.tratamientoAutorizado.upsert({
          where: {
            operadorId_tipoResiduoId_metodo: {
              operadorId: operador.id,
              tipoResiduoId,
              metodo: tecnologiaCompleta,
            },
          },
          update: {},
          create: {
            operadorId: operador.id,
            tipoResiduoId,
            metodo: tecnologiaCompleta,
            capacidad: 0, // No capacity data in CSV
          },
        });
        tratamientosCreados++;
      }

      console.log(`  ✓ ${first.empresa} (${cuit}) — cert: ${numeroHabilitacion}, cat: ${categoria}, corrientes: ${corrientesSet.length}`);
    } catch (err: any) {
      const msg = `ERROR ${first.empresa} (${cuit}): ${err.message}`;
      errores.push(msg);
      console.error(`  ✗ ${msg}`);
    }
  }

  // --- RESUMEN ---
  console.log('\n=== RESUMEN ===');
  console.log(`Operadores creados: ${operadoresCreados}`);
  console.log(`Operadores actualizados: ${operadoresActualizados}`);
  console.log(`TratamientoAutorizados upserted: ${tratamientosCreados}`);
  console.log(`TipoResiduo creados: ${tiposCreados}`);
  if (codigosNoEncontrados.size > 0) {
    console.log(`WARN: Códigos no encontrados en DB: ${Array.from(codigosNoEncontrados).join(', ')}`);
  }
  if (errores.length > 0) {
    console.log(`\nERRORES (${errores.length}):`);
    for (const err of errores) {
      console.log(`  - ${err}`);
    }
  } else {
    console.log('\nSin errores.');
  }

  // --- VERIFICACIÓN ---
  console.log('\n=== VERIFICACIÓN ===');
  const totalOperadores = await prisma.operador.count();
  const totalTipos = await prisma.tipoResiduo.count();
  const totalTratamientos = await prisma.tratamientoAutorizado.count();
  const totalUsuariosOperador = await prisma.usuario.count({ where: { rol: 'OPERADOR' } });
  console.log(`Total Operadores en DB: ${totalOperadores}`);
  console.log(`Total TipoResiduo en DB: ${totalTipos}`);
  console.log(`Total TratamientoAutorizado en DB: ${totalTratamientos}`);
  console.log(`Total Usuarios con rol OPERADOR: ${totalUsuariosOperador}`);

  // Check for operadores without tratamientos
  const sinTratamientos = await prisma.operador.findMany({
    where: {
      tratamientos: { none: {} },
      // Only check newly created ones (not demo)
      cuit: { notIn: ['30-13579246-8', '30-24681357-9'] },
    },
    select: { razonSocial: true, cuit: true },
  });
  if (sinTratamientos.length > 0) {
    console.log(`\nWARN: Operadores sin tratamientos:`);
    for (const op of sinTratamientos) {
      console.log(`  - ${op.razonSocial} (${op.cuit})`);
    }
  }
}

main()
  .catch((e) => {
    console.error('Error fatal:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
