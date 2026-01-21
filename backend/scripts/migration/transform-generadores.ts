/**
 * Script de Transformación de Datos de Generadores
 *
 * Transforma datos del CSV/Excel fuente al formato esperado por la base de datos.
 *
 * Uso:
 *   npx tsx scripts/migration/transform-generadores.ts <archivo.csv> [--output <archivo_salida.json>]
 *
 * Ejemplo:
 *   npx tsx scripts/migration/transform-generadores.ts /datos/generadores21012926 --output generadores-transformados.json
 */

import fs from 'fs';
import csv from 'csv-parser';
import path from 'path';

// Interfaces
interface GeneradorFuente {
  CERTIFICADO: string;
  'RAZON SOCIAL': string;
  CUIT: string;
  'DOMICILIO LEGAL                              calle y Nº': string;
  'DOMICILIO LEGAL Localidad': string;
  'DOMICILIO LEGAL  Depto.': string;
  'CORREO ELECTRONICO P/NOTIFICAR': string;
  'TELEFONOS DE CONTACTO': string;
  'CATEGORIAS DE CONTROL AUTORIZADAS': string;
  ACTIVIDAD?: string;
  RUBRO?: string;
}

interface GeneradorDestino {
  razonSocial: string;
  cuit: string;
  cuitNormalizado: string;
  domicilio: string;
  telefono: string;
  email: string;
  emailOriginal: string;
  emailGenerado: boolean;
  numeroInscripcion: string;
  categoria: string;
  activo: boolean;
  actividad?: string;
  rubro?: string;
}

interface TransformResult {
  success: GeneradorDestino[];
  errors: Array<{
    row: number;
    data: any;
    error: string;
  }>;
  duplicates: Array<{
    cuit: string;
    rows: number[];
  }>;
  stats: {
    total: number;
    transformed: number;
    errors: number;
    duplicates: number;
    emailsGenerados: number;
  };
}

// Funciones de utilidad
function normalizeCuit(cuit: string): string {
  // Eliminar todo excepto números
  const numbers = cuit.replace(/[^0-9]/g, '');

  // Validar que tenga 11 dígitos
  if (numbers.length !== 11) {
    return numbers; // Devolver como está si no tiene 11 dígitos
  }

  // Formatear como XX-XXXXXXXX-X
  return `${numbers.slice(0, 2)}-${numbers.slice(2, 10)}-${numbers.slice(10)}`;
}

function validateEmail(email: string): boolean {
  if (!email || email.trim() === '') return false;

  // Regex básico para validar email
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email.trim());
}

function generatePlaceholderEmail(certificado: string): string {
  // Limpiar certificado para usarlo como identificador
  const cleanCert = certificado.replace(/[^a-zA-Z0-9-]/g, '').toLowerCase();
  return `generador-${cleanCert}@sitrep.local`;
}

function cleanPhone(phone: string): string {
  if (!phone) return '';
  // Limpiar caracteres especiales pero mantener números, espacios, guiones y paréntesis
  return phone.trim().replace(/[^\d\s\-\(\)\+\/]/g, '');
}

function buildDomicilio(
  calle: string | undefined,
  localidad: string | undefined,
  departamento: string | undefined
): string {
  const parts: string[] = [];

  if (calle && calle.trim()) {
    parts.push(calle.trim());
  }
  if (localidad && localidad.trim()) {
    parts.push(localidad.trim());
  }
  if (departamento && departamento.trim()) {
    parts.push(departamento.trim());
  }

  return parts.length > 0 ? parts.join(', ') : 'Sin domicilio';
}

function cleanCategoria(categoria: string | undefined): string {
  if (!categoria || categoria.trim() === '') return 'Sin categoría';
  return categoria.trim();
}

// Función principal de transformación
async function transformGeneradores(inputFile: string): Promise<TransformResult> {
  const result: TransformResult = {
    success: [],
    errors: [],
    duplicates: [],
    stats: {
      total: 0,
      transformed: 0,
      errors: 0,
      duplicates: 0,
      emailsGenerados: 0
    }
  };

  // Map para detectar duplicados por CUIT
  const cuitMap = new Map<string, number[]>();

  return new Promise((resolve, reject) => {
    const rows: GeneradorFuente[] = [];

    fs.createReadStream(inputFile)
      .pipe(csv())
      .on('data', (row: GeneradorFuente) => {
        rows.push(row);
      })
      .on('end', () => {
        console.log(`📖 Leídas ${rows.length} filas del archivo CSV`);
        result.stats.total = rows.length;

        // Primera pasada: detectar duplicados por CUIT
        rows.forEach((row, index) => {
          const cuit = row.CUIT?.replace(/[^0-9]/g, '') || '';
          if (cuit) {
            const existing = cuitMap.get(cuit) || [];
            existing.push(index + 1); // +1 porque las filas empiezan en 1
            cuitMap.set(cuit, existing);
          }
        });

        // Identificar duplicados
        cuitMap.forEach((rowNumbers, cuit) => {
          if (rowNumbers.length > 1) {
            result.duplicates.push({ cuit, rows: rowNumbers });
            result.stats.duplicates += rowNumbers.length - 1; // Contar solo los extras
          }
        });

        // Set para trackear CUITs ya procesados
        const processedCuits = new Set<string>();

        // Segunda pasada: transformar datos
        rows.forEach((row, index) => {
          try {
            const rowNum = index + 1;

            // Validar campos requeridos
            if (!row.CERTIFICADO || row.CERTIFICADO.trim() === '') {
              result.errors.push({
                row: rowNum,
                data: row,
                error: 'CERTIFICADO vacío o faltante'
              });
              result.stats.errors++;
              return;
            }

            if (!row['RAZON SOCIAL'] || row['RAZON SOCIAL'].trim() === '') {
              result.errors.push({
                row: rowNum,
                data: row,
                error: 'RAZON SOCIAL vacía o faltante'
              });
              result.stats.errors++;
              return;
            }

            if (!row.CUIT || row.CUIT.trim() === '') {
              result.errors.push({
                row: rowNum,
                data: row,
                error: 'CUIT vacío o faltante'
              });
              result.stats.errors++;
              return;
            }

            const cuitClean = row.CUIT.replace(/[^0-9]/g, '');

            // Saltar si ya procesamos este CUIT (duplicado)
            if (processedCuits.has(cuitClean)) {
              console.log(`⚠️  Fila ${rowNum}: CUIT ${cuitClean} duplicado, saltando`);
              return;
            }
            processedCuits.add(cuitClean);

            // Validar CUIT tiene 11 dígitos
            if (cuitClean.length !== 11) {
              result.errors.push({
                row: rowNum,
                data: row,
                error: `CUIT inválido: ${row.CUIT} (${cuitClean.length} dígitos, se esperan 11)`
              });
              result.stats.errors++;
              return;
            }

            // Manejar email
            const emailOriginal = row['CORREO ELECTRONICO P/NOTIFICAR']?.trim() || '';
            let email: string;
            let emailGenerado = false;

            // Puede haber múltiples emails separados por coma
            const emails = emailOriginal.split(',').map(e => e.trim()).filter(e => e);
            const validEmail = emails.find(e => validateEmail(e));

            if (validEmail) {
              email = validEmail.toLowerCase();
            } else {
              email = generatePlaceholderEmail(row.CERTIFICADO);
              emailGenerado = true;
              result.stats.emailsGenerados++;
            }

            // Construir objeto transformado
            const generador: GeneradorDestino = {
              razonSocial: row['RAZON SOCIAL'].trim(),
              cuit: cuitClean,
              cuitNormalizado: normalizeCuit(row.CUIT),
              domicilio: buildDomicilio(
                row['DOMICILIO LEGAL                              calle y Nº'],
                row['DOMICILIO LEGAL Localidad'],
                row['DOMICILIO LEGAL  Depto.']
              ),
              telefono: cleanPhone(row['TELEFONOS DE CONTACTO']),
              email,
              emailOriginal,
              emailGenerado,
              numeroInscripcion: row.CERTIFICADO.trim(),
              categoria: cleanCategoria(row['CATEGORIAS DE CONTROL AUTORIZADAS']),
              activo: true,
              actividad: row.ACTIVIDAD?.trim(),
              rubro: row.RUBRO?.trim()
            };

            result.success.push(generador);
            result.stats.transformed++;

          } catch (error: any) {
            result.errors.push({
              row: index + 1,
              data: row,
              error: error.message
            });
            result.stats.errors++;
          }
        });

        resolve(result);
      })
      .on('error', (error) => {
        reject(error);
      });
  });
}

// Función para guardar resultados
function saveResults(result: TransformResult, outputFile: string): void {
  // Guardar datos transformados
  fs.writeFileSync(
    outputFile,
    JSON.stringify(result.success, null, 2),
    'utf-8'
  );
  console.log(`✅ Datos transformados guardados en: ${outputFile}`);

  // Guardar errores si hay
  if (result.errors.length > 0) {
    const errorsFile = outputFile.replace('.json', '-errors.json');
    fs.writeFileSync(
      errorsFile,
      JSON.stringify(result.errors, null, 2),
      'utf-8'
    );
    console.log(`⚠️  Errores guardados en: ${errorsFile}`);
  }

  // Guardar duplicados si hay
  if (result.duplicates.length > 0) {
    const duplicatesFile = outputFile.replace('.json', '-duplicates.json');
    fs.writeFileSync(
      duplicatesFile,
      JSON.stringify(result.duplicates, null, 2),
      'utf-8'
    );
    console.log(`⚠️  Duplicados guardados en: ${duplicatesFile}`);
  }
}

// Función para imprimir estadísticas
function printStats(result: TransformResult): void {
  console.log('\n' + '='.repeat(60));
  console.log('📊 RESUMEN DE TRANSFORMACIÓN');
  console.log('='.repeat(60));
  console.log(`📄 Total filas leídas:        ${result.stats.total}`);
  console.log(`✅ Transformados exitosamente: ${result.stats.transformed}`);
  console.log(`❌ Errores de validación:      ${result.stats.errors}`);
  console.log(`🔄 CUITs duplicados:           ${result.stats.duplicates}`);
  console.log(`📧 Emails generados:           ${result.stats.emailsGenerados}`);
  console.log('='.repeat(60));

  if (result.errors.length > 0) {
    console.log('\n⚠️  PRIMEROS 5 ERRORES:');
    result.errors.slice(0, 5).forEach((err, i) => {
      console.log(`  ${i + 1}. Fila ${err.row}: ${err.error}`);
    });
  }

  if (result.duplicates.length > 0) {
    console.log('\n🔄 PRIMEROS 5 CUITS DUPLICADOS:');
    result.duplicates.slice(0, 5).forEach((dup, i) => {
      console.log(`  ${i + 1}. CUIT ${dup.cuit} aparece en filas: ${dup.rows.join(', ')}`);
    });
  }
}

// Punto de entrada principal
async function main() {
  const args = process.argv.slice(2);

  if (args.length === 0) {
    console.error('❌ Uso: npx tsx scripts/migration/transform-generadores.ts <archivo.csv> [--output <archivo_salida.json>]');
    console.error('');
    console.error('Opciones:');
    console.error('  --output <archivo>  Archivo de salida (default: generadores-transformados.json)');
    process.exit(1);
  }

  const inputFile = args[0];
  let outputFile = 'generadores-transformados.json';

  // Parsear argumentos
  const outputIndex = args.indexOf('--output');
  if (outputIndex !== -1 && args[outputIndex + 1]) {
    outputFile = args[outputIndex + 1];
  }

  // Verificar que el archivo existe
  if (!fs.existsSync(inputFile)) {
    console.error(`❌ El archivo no existe: ${inputFile}`);
    process.exit(1);
  }

  console.log('🚀 Iniciando transformación de generadores...');
  console.log(`📂 Archivo de entrada: ${inputFile}`);
  console.log(`📂 Archivo de salida:  ${outputFile}`);
  console.log('');

  try {
    const result = await transformGeneradores(inputFile);

    printStats(result);

    saveResults(result, outputFile);

    console.log('\n✅ Transformación completada exitosamente');

    // Exit code basado en si hay errores críticos
    process.exit(result.stats.errors > result.stats.total * 0.1 ? 1 : 0);

  } catch (error: any) {
    console.error('❌ Error durante la transformación:', error.message);
    process.exit(1);
  }
}

// Exportar funciones para uso programático
export {
  transformGeneradores,
  normalizeCuit,
  validateEmail,
  generatePlaceholderEmail,
  cleanPhone,
  buildDomicilio,
  GeneradorDestino,
  TransformResult
};

// Ejecutar si es llamado directamente
main();
