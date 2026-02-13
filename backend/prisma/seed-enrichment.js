/**
 * seed-enrichment.js
 *
 * Reads the TypeScript enrichment files for generadores and operadores,
 * parses the data objects, and generates SQL UPDATE statements.
 *
 * Usage:
 *   cd backend && node prisma/seed-enrichment.js
 *
 * Output:
 *   prisma/seed-enrichment.sql
 */

const fs = require('fs');
const path = require('path');

// --- Paths ---
const generadoresPath = path.resolve(
  __dirname,
  '../../frontend/src-v6/data/generadores-enrichment.ts'
);
const operadoresPath = path.resolve(
  __dirname,
  '../../frontend/src-v6/data/operadores-enrichment.ts'
);
const outputPath = path.resolve(__dirname, 'seed-enrichment.sql');

/**
 * Strip TypeScript-specific syntax so the file can be evaluated as plain JS.
 */
function stripTypescript(source) {
  // Process line by line for robustness
  const lines = source.split('\n');
  const output = [];
  let inInterface = false;
  let braceDepth = 0;

  for (const line of lines) {
    // Detect start of interface/type block
    if (/^\s*export\s+interface\s+/.test(line) || /^\s*interface\s+/.test(line)) {
      inInterface = true;
      braceDepth = 0;
      // Count braces on this line
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      // If it opened and closed on one line
      if (braceDepth <= 0) inInterface = false;
      continue; // skip interface lines
    }

    if (inInterface) {
      for (const ch of line) {
        if (ch === '{') braceDepth++;
        if (ch === '}') braceDepth--;
      }
      if (braceDepth <= 0) inInterface = false;
      continue; // skip interface lines
    }

    // Remove `export` keyword
    let cleaned = line.replace(/\bexport\s+/, '');

    // Remove type annotation on const declarations:
    //   const GENERADORES_DATA: Record<string, GeneradorEnriched> = {
    //   → const GENERADORES_DATA = {
    cleaned = cleaned.replace(
      /^(\s*const\s+\w+)\s*:\s*.+?=\s*/,
      '$1 = '
    );

    output.push(cleaned);
  }

  return output.join('\n');
}

/**
 * Evaluate a stripped TS file and return the value of the named export.
 */
function parseDataObject(filePath, varName) {
  const raw = fs.readFileSync(filePath, 'utf-8');
  const cleaned = stripTypescript(raw);

  // Wrap in a function that returns the target variable
  const wrapped = `${cleaned}\nreturn ${varName};`;

  try {
    const fn = new Function(wrapped);
    return fn();
  } catch (err) {
    console.error(`Failed to parse ${filePath}:`);
    console.error(err.message);
    // Dump first few lines for debugging
    const lines = cleaned.split('\n');
    console.error('First 30 lines of cleaned source:');
    lines.slice(0, 30).forEach((l, i) => console.error(`  ${i + 1}: ${l}`));
    process.exit(1);
  }
}

/**
 * Escape single quotes for SQL string literals: ' -> ''
 */
function esc(val) {
  if (val == null) return '';
  return String(val).replace(/'/g, "''");
}

// --- Main ---
console.log('Reading generadores enrichment...');
const generadoresData = parseDataObject(generadoresPath, 'GENERADORES_DATA');
const genCuits = Object.keys(generadoresData);
console.log(`  Parsed ${genCuits.length} generadores entries.`);

console.log('Reading operadores enrichment...');
const operadoresData = parseDataObject(operadoresPath, 'OPERADORES_DATA');
const opCuits = Object.keys(operadoresData);
console.log(`  Parsed ${opCuits.length} operadores entries.`);

// --- Generate SQL ---
const sqlLines = [];

sqlLines.push('-- ============================================================');
sqlLines.push('-- Enrichment UPDATE statements');
sqlLines.push(`-- Generated: ${new Date().toISOString()}`);
sqlLines.push('-- ============================================================');
sqlLines.push('');
sqlLines.push('BEGIN;');
sqlLines.push('');

// Generadores
sqlLines.push('-- ---- GENERADORES ----');
sqlLines.push('');
for (const cuit of genCuits) {
  const g = generadoresData[cuit];
  const actividad = esc(g.actividad || '');
  const rubro = esc(g.rubro || '');
  const corrientesControl = esc(
    Array.isArray(g.categoriasControl)
      ? g.categoriasControl.join(', ')
      : ''
  );

  sqlLines.push(
    `UPDATE generadores SET "actividad" = '${actividad}', "rubro" = '${rubro}', "corrientesControl" = '${corrientesControl}' WHERE cuit = '${esc(cuit)}';`
  );
}

sqlLines.push('');
sqlLines.push('-- ---- OPERADORES ----');
sqlLines.push('');

// Operadores
for (const cuit of opCuits) {
  const o = operadoresData[cuit];
  const tipoOperador = esc(o.tipoOperador || '');
  const tecnologia = esc(o.tecnologia || '');
  const corrientes = esc(
    Array.isArray(o.corrientes) ? o.corrientes.join(', ') : ''
  );

  sqlLines.push(
    `UPDATE operadores SET "tipoOperador" = '${tipoOperador}', "tecnologia" = '${tecnologia}', "corrientesY" = '${corrientes}' WHERE cuit = '${esc(cuit)}';`
  );
}

sqlLines.push('');
sqlLines.push('COMMIT;');
sqlLines.push('');

// --- Write output ---
const sql = sqlLines.join('\n');
fs.writeFileSync(outputPath, sql, 'utf-8');

console.log(`\nSQL written to: ${outputPath}`);
console.log(`  ${genCuits.length} generadores UPDATE statements`);
console.log(`  ${opCuits.length} operadores UPDATE statements`);
console.log(`  Total: ${genCuits.length + opCuits.length} statements`);
