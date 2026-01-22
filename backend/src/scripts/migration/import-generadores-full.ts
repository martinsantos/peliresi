/**
 * Script de migración completa de Generadores
 * Importa TODOS los datos del Excel incluyendo:
 * - Certificado, Expediente, Actividad, Rubro
 * - Domicilios Legal y Real separados
 * - Certificación ISO, Clasificación
 * - DDJJ por año, TEF, Libro Operatoria
 * - Métricas R y MxR
 *
 * CUIT defectuosos se reemplazan con @@@@@@ y se marcan con cuitValido=false
 */

import * as XLSX from 'xlsx';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const EXCEL_PATH = '/Volumes/SDTERA/ultima milla/LICITACIONES/PRESENTADAS2025/AMBIENTE/datos/generadores21012926.xlsx';

interface ExcelRow {
  'CERTIFICADO': string;
  'EXPEDIENTE INSCRIPCION    EE': string;
  'RAZON SOCIAL': string;
  'CUIT': string;
  'ACTIVIDAD': string;
  'RUBRO': string;
  'DOMICILIO LEGAL                              calle y Nº': string;
  'DOMICILIO LEGAL Localidad': string;
  'DOMICILIO LEGAL  Depto.': string;
  'DOMICILIO REAL                     calle y N°': string;
  'DOMICILIO REAL localidad': string;
  'DOMICILIO REAL Depto.': string;
  'CORREO ELECTRONICO P/NOTIFICAR': string;
  'TELEFONOS DE CONTACTO': string;
  'CERTIFICACION ISO': string;
  'CATEGORIAS DE CONTROL AUTORIZADAS': string;
  'Nº Resol. de Inscripción': string;
  'R': string | number;
  'M x R': string | number;
  'INDIV': string;
  'INFORME TÉCNICO': string;
  'TEF 2025': string | number;
  'LIBRO DE OPERATORIA': string;
  ' DDJJ 2021': string | number;
  'DDJJ 2022': string | number;
  'DDJJ 2023': string | number;
  'DDJJ 2024': string | number;
  'DDJJ de ABRIL 2024': string | number;
  'DDJJ 2025': string | number;
  'DDJJ 2026': string | number;
}

function normalizeCuit(cuit: string | undefined | null): { cuit: string; valido: boolean } {
  if (!cuit) {
    return { cuit: '@@@@@@-' + Date.now(), valido: false };
  }

  // Limpiar el CUIT
  let cleaned = String(cuit).trim();

  // Remover guiones, espacios y otros caracteres
  const onlyNumbers = cleaned.replace(/[^0-9]/g, '');

  // Validar que tenga 11 dígitos
  if (onlyNumbers.length !== 11) {
    console.log(`  ⚠️ CUIT inválido (${onlyNumbers.length} dígitos): "${cuit}" -> reemplazado con @@@@@@`);
    return { cuit: '@@@@@@-' + Date.now() + '-' + Math.random().toString(36).substr(2, 5), valido: false };
  }

  // Formatear como XX-XXXXXXXX-X
  const formatted = `${onlyNumbers.slice(0, 2)}-${onlyNumbers.slice(2, 10)}-${onlyNumbers.slice(10)}`;
  return { cuit: formatted, valido: true };
}

function normalizeString(value: any): string | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  return String(value).trim();
}

function normalizeBoolean(value: any): boolean | null {
  if (value === undefined || value === null || value === '') {
    return null;
  }
  const str = String(value).toUpperCase().trim();
  if (str === 'SI' || str === 'SÍ' || str === 'YES' || str === '1' || str === 'TRUE') {
    return true;
  }
  if (str === 'NO' || str === '0' || str === 'FALSE') {
    return false;
  }
  return null;
}

async function importGeneradores() {
  console.log('=== MIGRACIÓN COMPLETA DE GENERADORES ===\n');
  console.log(`Leyendo archivo: ${EXCEL_PATH}\n`);

  // Leer Excel
  const workbook = XLSX.readFile(EXCEL_PATH);
  const sheet = workbook.Sheets['REGISTRO'];
  const data = XLSX.utils.sheet_to_json<ExcelRow>(sheet);

  console.log(`Total de filas en Excel: ${data.length}\n`);

  // Estadísticas
  let actualizados = 0;
  let nuevos = 0;
  let errores = 0;
  let cuitsInvalidos = 0;
  const cuitsUsados = new Set<string>();

  // Obtener admin user para asignar a nuevos generadores
  const adminUser = await prisma.usuario.findFirst({
    where: { rol: 'ADMIN' }
  });

  if (!adminUser) {
    console.error('❌ No se encontró usuario admin');
    return;
  }

  // Procesar cada fila
  for (let i = 0; i < data.length; i++) {
    const row = data[i];

    if (!row['RAZON SOCIAL']) {
      console.log(`Fila ${i + 1}: Sin razón social, saltando...`);
      continue;
    }

    try {
      // Normalizar CUIT
      let { cuit, valido: cuitValido } = normalizeCuit(row['CUIT']);

      // Asegurar CUIT único
      let originalCuit = cuit;
      let counter = 0;
      while (cuitsUsados.has(cuit)) {
        counter++;
        cuit = originalCuit + '-DUP' + counter;
        cuitValido = false;
        console.log(`  ⚠️ CUIT duplicado: ${originalCuit} -> ${cuit}`);
      }
      cuitsUsados.add(cuit);

      if (!cuitValido) {
        cuitsInvalidos++;
      }

      // Preparar datos del generador
      const generadorData = {
        razonSocial: normalizeString(row['RAZON SOCIAL']) || 'Sin nombre',
        cuit: cuit,
        cuitValido: cuitValido,

        // Domicilio combinado (legacy)
        domicilio: [
          normalizeString(row['DOMICILIO LEGAL                              calle y Nº']),
          normalizeString(row['DOMICILIO LEGAL Localidad']),
          normalizeString(row['DOMICILIO LEGAL  Depto.'])
        ].filter(Boolean).join(', ') || 'Sin domicilio',

        // Domicilio Legal separado
        domicilioLegalCalle: normalizeString(row['DOMICILIO LEGAL                              calle y Nº']),
        domicilioLegalLocalidad: normalizeString(row['DOMICILIO LEGAL Localidad']),
        domicilioLegalDepartamento: normalizeString(row['DOMICILIO LEGAL  Depto.']),

        // Domicilio Real separado
        domicilioRealCalle: normalizeString(row['DOMICILIO REAL                     calle y N°']),
        domicilioRealLocalidad: normalizeString(row['DOMICILIO REAL localidad']),
        domicilioRealDepartamento: normalizeString(row['DOMICILIO REAL Depto.']),

        // Contacto
        telefono: normalizeString(row['TELEFONOS DE CONTACTO']) || 'Sin teléfono',
        email: normalizeString(row['CORREO ELECTRONICO P/NOTIFICAR']) || `generador-${i}@sitrep.local`,

        // Inscripción
        certificado: normalizeString(row['CERTIFICADO']),
        expedienteInscripcion: normalizeString(row['EXPEDIENTE INSCRIPCION    EE']),
        numeroInscripcion: normalizeString(row['Nº Resol. de Inscripción']) || 'Sin número',
        resolucionInscripcion: normalizeString(row['Nº Resol. de Inscripción']),

        // Categorías
        categoria: normalizeString(row['CATEGORIAS DE CONTROL AUTORIZADAS']) || 'Sin categoría',

        // Actividad
        actividad: normalizeString(row['ACTIVIDAD']),
        rubro: normalizeString(row['RUBRO']),

        // Clasificación
        clasificacion: normalizeString(row['INDIV']),
        certificacionIso: normalizeString(row['CERTIFICACION ISO']),

        // Cumplimiento
        informeTecnico: normalizeString(row['INFORME TÉCNICO']),
        tef: normalizeString(row['TEF 2025']),
        libroOperatoria: normalizeBoolean(row['LIBRO DE OPERATORIA']),

        // DDJJ
        ddjj2021: normalizeString(row[' DDJJ 2021']),
        ddjj2022: normalizeString(row['DDJJ 2022']),
        ddjj2023: normalizeString(row['DDJJ 2023']),
        ddjj2024: normalizeString(row['DDJJ 2024']),
        ddjjAbril2024: normalizeString(row['DDJJ de ABRIL 2024']),
        ddjj2025: normalizeString(row['DDJJ 2025']),
        ddjj2026: normalizeString(row['DDJJ 2026']),

        // Métricas
        residuosR: normalizeString(row['R']),
        residuosMxR: normalizeString(row['M x R']),

        activo: true,
      };

      // Buscar si ya existe por CUIT (normalizado)
      const cuitNormalized = cuit.replace(/[^0-9@]/g, '');
      const existingByCuit = await prisma.generador.findFirst({
        where: {
          OR: [
            { cuit: cuit },
            { cuit: { contains: cuitNormalized.slice(0, 8) } }
          ]
        }
      });

      // También buscar por razón social si no encontramos por CUIT
      const existingByName = !existingByCuit ? await prisma.generador.findFirst({
        where: {
          razonSocial: {
            equals: generadorData.razonSocial,
            mode: 'insensitive'
          }
        }
      }) : null;

      const existing = existingByCuit || existingByName;

      if (existing) {
        // Actualizar existente con campos nuevos
        await prisma.generador.update({
          where: { id: existing.id },
          data: {
            // Solo actualizar campos nuevos, no sobreescribir los existentes principales
            certificado: generadorData.certificado,
            expedienteInscripcion: generadorData.expedienteInscripcion,
            resolucionInscripcion: generadorData.resolucionInscripcion,
            actividad: generadorData.actividad,
            rubro: generadorData.rubro,
            domicilioLegalCalle: generadorData.domicilioLegalCalle,
            domicilioLegalLocalidad: generadorData.domicilioLegalLocalidad,
            domicilioLegalDepartamento: generadorData.domicilioLegalDepartamento,
            domicilioRealCalle: generadorData.domicilioRealCalle,
            domicilioRealLocalidad: generadorData.domicilioRealLocalidad,
            domicilioRealDepartamento: generadorData.domicilioRealDepartamento,
            certificacionIso: generadorData.certificacionIso,
            clasificacion: generadorData.clasificacion,
            informeTecnico: generadorData.informeTecnico,
            tef: generadorData.tef,
            libroOperatoria: generadorData.libroOperatoria,
            ddjj2021: generadorData.ddjj2021,
            ddjj2022: generadorData.ddjj2022,
            ddjj2023: generadorData.ddjj2023,
            ddjj2024: generadorData.ddjj2024,
            ddjjAbril2024: generadorData.ddjjAbril2024,
            ddjj2025: generadorData.ddjj2025,
            ddjj2026: generadorData.ddjj2026,
            residuosR: generadorData.residuosR,
            residuosMxR: generadorData.residuosMxR,
            cuitValido: existing.cuit.includes('@@@@@@') ? false : true,
          }
        });
        actualizados++;

        if ((actualizados + nuevos) % 100 === 0) {
          console.log(`Procesados ${actualizados + nuevos}/${data.length}...`);
        }
      } else {
        // Crear nuevo usuario y generador
        const passwordHash = await bcrypt.hash('Sitrep2026!', 10);
        const emailUnique = generadorData.email.includes('@')
          ? generadorData.email.split('@')[0] + '-' + Date.now() + '@' + generadorData.email.split('@')[1]
          : `generador-${Date.now()}@sitrep.local`;

        try {
          const newUser = await prisma.usuario.create({
            data: {
              email: emailUnique,
              password: passwordHash,
              rol: 'GENERADOR',
              nombre: generadorData.razonSocial.substring(0, 50),
              apellido: '',
              activo: true,
              aprobado: true,
            }
          });

          await prisma.generador.create({
            data: {
              ...generadorData,
              usuarioId: newUser.id,
            }
          });

          nuevos++;

          if ((actualizados + nuevos) % 100 === 0) {
            console.log(`Procesados ${actualizados + nuevos}/${data.length}...`);
          }
        } catch (createError: any) {
          if (createError.code === 'P2002') {
            // CUIT o email duplicado, intentar con valores únicos
            const uniqueSuffix = Date.now() + '-' + Math.random().toString(36).substr(2, 5);

            const newUserRetry = await prisma.usuario.create({
              data: {
                email: `gen-${uniqueSuffix}@sitrep.local`,
                password: passwordHash,
                rol: 'GENERADOR',
                nombre: generadorData.razonSocial.substring(0, 50),
                apellido: '',
                activo: true,
                aprobado: true,
              }
            });

            await prisma.generador.create({
              data: {
                ...generadorData,
                cuit: '@@@@@@-' + uniqueSuffix,
                cuitValido: false,
                usuarioId: newUserRetry.id,
              }
            });

            nuevos++;
            cuitsInvalidos++;
          } else {
            throw createError;
          }
        }
      }
    } catch (error: any) {
      console.error(`❌ Error en fila ${i + 1} (${row['RAZON SOCIAL']}): ${error.message}`);
      errores++;
    }
  }

  console.log('\n=== RESUMEN DE MIGRACIÓN ===\n');
  console.log(`Total procesados: ${data.length}`);
  console.log(`✅ Actualizados: ${actualizados}`);
  console.log(`✅ Nuevos: ${nuevos}`);
  console.log(`⚠️ CUITs inválidos/duplicados: ${cuitsInvalidos}`);
  console.log(`❌ Errores: ${errores}`);

  // Verificar resultado final
  const totalGeneradores = await prisma.generador.count();
  const conCertificado = await prisma.generador.count({ where: { certificado: { not: null } } });
  const conActividad = await prisma.generador.count({ where: { actividad: { not: null } } });
  const conRubro = await prisma.generador.count({ where: { rubro: { not: null } } });
  const cuitInvalidosCount = await prisma.generador.count({ where: { cuitValido: false } });

  console.log('\n=== VERIFICACIÓN FINAL ===\n');
  console.log(`Total generadores en DB: ${totalGeneradores}`);
  console.log(`Con certificado: ${conCertificado}`);
  console.log(`Con actividad: ${conActividad}`);
  console.log(`Con rubro: ${conRubro}`);
  console.log(`Con CUIT inválido: ${cuitInvalidosCount}`);

  await prisma.$disconnect();
}

importGeneradores().catch(console.error);
