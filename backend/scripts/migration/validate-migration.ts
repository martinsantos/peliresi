/**
 * Script de Validación Post-Migración
 *
 * Valida la integridad de los datos después de una migración masiva de generadores.
 *
 * Verificaciones:
 * - Conteo de registros (generadores, usuarios)
 * - Integridad referencial (usuario-generador)
 * - Unicidad de CUITs y emails
 * - Campos obligatorios no vacíos
 * - Consistencia entre archivo fuente y base de datos
 *
 * Uso:
 *   npx tsx scripts/migration/validate-migration.ts [archivo-fuente.json]
 *
 * Ejemplo:
 *   npx tsx scripts/migration/validate-migration.ts generadores-transformados.json
 */

import { PrismaClient } from '@prisma/client';
import fs from 'fs';

interface ValidationResult {
  passed: boolean;
  checks: ValidationCheck[];
  summary: {
    total: number;
    passed: number;
    failed: number;
    warnings: number;
  };
}

interface ValidationCheck {
  name: string;
  description: string;
  status: 'PASS' | 'FAIL' | 'WARN';
  details?: string;
  data?: any;
}

class MigrationValidator {
  private prisma: PrismaClient;
  private results: ValidationCheck[] = [];
  private sourceData?: any[];

  constructor() {
    this.prisma = new PrismaClient();
  }

  private addResult(check: ValidationCheck): void {
    this.results.push(check);
    const icon = check.status === 'PASS' ? '✅' : check.status === 'FAIL' ? '❌' : '⚠️';
    console.log(`${icon} ${check.name}: ${check.status}`);
    if (check.details) {
      console.log(`   ${check.details}`);
    }
  }

  // 1. Verificar conteo de registros
  async checkRecordCounts(): Promise<void> {
    console.log('\n📊 Verificando conteo de registros...');

    const generadoresCount = await this.prisma.generador.count();
    const usuariosGeneradorCount = await this.prisma.usuario.count({
      where: { rol: 'GENERADOR' }
    });
    const totalUsuarios = await this.prisma.usuario.count();

    this.addResult({
      name: 'Conteo de Generadores',
      description: 'Cantidad de registros en tabla generadores',
      status: generadoresCount > 0 ? 'PASS' : 'WARN',
      details: `${generadoresCount} generadores en base de datos`,
      data: { generadoresCount }
    });

    this.addResult({
      name: 'Conteo de Usuarios GENERADOR',
      description: 'Cantidad de usuarios con rol GENERADOR',
      status: usuariosGeneradorCount > 0 ? 'PASS' : 'WARN',
      details: `${usuariosGeneradorCount} usuarios con rol GENERADOR`,
      data: { usuariosGeneradorCount }
    });

    // Verificar que coinciden
    this.addResult({
      name: 'Coincidencia Generadores-Usuarios',
      description: 'Cada generador debe tener un usuario asociado',
      status: generadoresCount === usuariosGeneradorCount ? 'PASS' : 'FAIL',
      details: generadoresCount === usuariosGeneradorCount
        ? 'Cantidad de generadores coincide con usuarios GENERADOR'
        : `Discrepancia: ${generadoresCount} generadores vs ${usuariosGeneradorCount} usuarios GENERADOR`,
      data: { generadoresCount, usuariosGeneradorCount }
    });

    // Verificar contra archivo fuente si existe
    if (this.sourceData) {
      const sourceCount = this.sourceData.length;
      const difference = sourceCount - generadoresCount;

      this.addResult({
        name: 'Coincidencia con Fuente',
        description: 'Comparación con archivo de datos fuente',
        status: difference === 0 ? 'PASS' : difference > 0 ? 'WARN' : 'FAIL',
        details: difference === 0
          ? `Todos los ${sourceCount} registros fueron migrados`
          : `Fuente: ${sourceCount}, DB: ${generadoresCount} (diferencia: ${difference})`,
        data: { sourceCount, dbCount: generadoresCount, difference }
      });
    }
  }

  // 2. Verificar integridad referencial
  async checkReferentialIntegrity(): Promise<void> {
    console.log('\n🔗 Verificando integridad referencial...');

    // Generadores sin usuario
    const generadoresSinUsuario = await this.prisma.generador.findMany({
      where: {
        usuario: null
      }
    });

    this.addResult({
      name: 'Generadores con Usuario',
      description: 'Todos los generadores deben tener un usuario asociado',
      status: generadoresSinUsuario.length === 0 ? 'PASS' : 'FAIL',
      details: generadoresSinUsuario.length === 0
        ? 'Todos los generadores tienen usuario asociado'
        : `${generadoresSinUsuario.length} generadores sin usuario`,
      data: { count: generadoresSinUsuario.length, cuits: generadoresSinUsuario.slice(0, 5).map(g => g.cuit) }
    });

    // Usuarios GENERADOR sin generador
    const usuariosSinGenerador = await this.prisma.usuario.findMany({
      where: {
        rol: 'GENERADOR',
        generador: null
      }
    });

    this.addResult({
      name: 'Usuarios GENERADOR con Perfil',
      description: 'Todos los usuarios GENERADOR deben tener un perfil de generador',
      status: usuariosSinGenerador.length === 0 ? 'PASS' : 'FAIL',
      details: usuariosSinGenerador.length === 0
        ? 'Todos los usuarios GENERADOR tienen perfil asociado'
        : `${usuariosSinGenerador.length} usuarios sin perfil de generador`,
      data: { count: usuariosSinGenerador.length, emails: usuariosSinGenerador.slice(0, 5).map(u => u.email) }
    });
  }

  // 3. Verificar unicidad de CUIT y email
  async checkUniqueness(): Promise<void> {
    console.log('\n🔑 Verificando unicidad de campos...');

    // CUITs duplicados en generadores
    const duplicateCuits = await this.prisma.$queryRaw<Array<{ cuit: string; count: bigint }>>`
      SELECT cuit, COUNT(*) as count
      FROM generadores
      GROUP BY cuit
      HAVING COUNT(*) > 1
    `;

    this.addResult({
      name: 'Unicidad de CUIT (Generadores)',
      description: 'No debe haber CUITs duplicados en tabla generadores',
      status: (duplicateCuits as any[]).length === 0 ? 'PASS' : 'FAIL',
      details: (duplicateCuits as any[]).length === 0
        ? 'No hay CUITs duplicados en generadores'
        : `${(duplicateCuits as any[]).length} CUITs duplicados encontrados`,
      data: { duplicates: duplicateCuits }
    });

    // Emails duplicados en usuarios
    const duplicateEmails = await this.prisma.$queryRaw<Array<{ email: string; count: bigint }>>`
      SELECT email, COUNT(*) as count
      FROM usuarios
      GROUP BY email
      HAVING COUNT(*) > 1
    `;

    this.addResult({
      name: 'Unicidad de Email (Usuarios)',
      description: 'No debe haber emails duplicados en tabla usuarios',
      status: (duplicateEmails as any[]).length === 0 ? 'PASS' : 'FAIL',
      details: (duplicateEmails as any[]).length === 0
        ? 'No hay emails duplicados en usuarios'
        : `${(duplicateEmails as any[]).length} emails duplicados encontrados`,
      data: { duplicates: duplicateEmails }
    });
  }

  // 4. Verificar campos obligatorios
  async checkRequiredFields(): Promise<void> {
    console.log('\n📋 Verificando campos obligatorios...');

    // Generadores con campos vacíos
    const generadoresCamposVacios = await this.prisma.generador.findMany({
      where: {
        OR: [
          { razonSocial: '' },
          { cuit: '' },
          { domicilio: '' },
          { email: '' },
          { numeroInscripcion: '' }
        ]
      }
    });

    this.addResult({
      name: 'Campos Obligatorios (Generadores)',
      description: 'Generadores no deben tener campos obligatorios vacíos',
      status: generadoresCamposVacios.length === 0 ? 'PASS' : 'WARN',
      details: generadoresCamposVacios.length === 0
        ? 'Todos los generadores tienen campos obligatorios completos'
        : `${generadoresCamposVacios.length} generadores con campos vacíos`,
      data: { count: generadoresCamposVacios.length }
    });

    // Usuarios con campos vacíos
    const usuariosCamposVacios = await this.prisma.usuario.findMany({
      where: {
        rol: 'GENERADOR',
        OR: [
          { email: '' },
          { nombre: '' },
          { password: '' }
        ]
      }
    });

    this.addResult({
      name: 'Campos Obligatorios (Usuarios)',
      description: 'Usuarios GENERADOR no deben tener campos obligatorios vacíos',
      status: usuariosCamposVacios.length === 0 ? 'PASS' : 'FAIL',
      details: usuariosCamposVacios.length === 0
        ? 'Todos los usuarios tienen campos obligatorios completos'
        : `${usuariosCamposVacios.length} usuarios con campos vacíos`,
      data: { count: usuariosCamposVacios.length }
    });
  }

  // 5. Verificar emails generados (placeholder)
  async checkPlaceholderEmails(): Promise<void> {
    console.log('\n📧 Verificando emails placeholder...');

    const emailsPlaceholder = await this.prisma.generador.count({
      where: {
        email: { endsWith: '@sitrep.local' }
      }
    });

    const totalGeneradores = await this.prisma.generador.count();
    const percentage = totalGeneradores > 0 ? ((emailsPlaceholder / totalGeneradores) * 100).toFixed(1) : '0';

    this.addResult({
      name: 'Emails Placeholder',
      description: 'Cantidad de emails generados automáticamente',
      status: 'WARN',
      details: `${emailsPlaceholder} de ${totalGeneradores} generadores (${percentage}%) tienen email placeholder`,
      data: { emailsPlaceholder, totalGeneradores, percentage }
    });
  }

  // 6. Verificar estado activo
  async checkActiveStatus(): Promise<void> {
    console.log('\n🔘 Verificando estados activo...');

    const generadoresInactivos = await this.prisma.generador.count({
      where: { activo: false }
    });

    const usuariosInactivos = await this.prisma.usuario.count({
      where: { rol: 'GENERADOR', activo: false }
    });

    this.addResult({
      name: 'Generadores Activos',
      description: 'Generadores migrados deben estar activos',
      status: generadoresInactivos === 0 ? 'PASS' : 'WARN',
      details: generadoresInactivos === 0
        ? 'Todos los generadores están activos'
        : `${generadoresInactivos} generadores inactivos`,
      data: { generadoresInactivos }
    });

    this.addResult({
      name: 'Usuarios Activos',
      description: 'Usuarios GENERADOR deben estar activos',
      status: usuariosInactivos === 0 ? 'PASS' : 'WARN',
      details: usuariosInactivos === 0
        ? 'Todos los usuarios GENERADOR están activos'
        : `${usuariosInactivos} usuarios GENERADOR inactivos`,
      data: { usuariosInactivos }
    });
  }

  // 7. Verificar CUITs específicos del archivo fuente
  async checkSourceCuits(): Promise<void> {
    if (!this.sourceData) return;

    console.log('\n🔍 Verificando CUITs del archivo fuente...');

    const sourceCuits = this.sourceData.map(d => d.cuit);
    const existingGeneradores = await this.prisma.generador.findMany({
      where: {
        cuit: { in: sourceCuits }
      },
      select: { cuit: true }
    });

    const existingCuits = new Set(existingGeneradores.map(g => g.cuit));
    const missingCuits = sourceCuits.filter(cuit => !existingCuits.has(cuit));

    this.addResult({
      name: 'CUITs Migrados',
      description: 'Verificar que todos los CUITs del archivo fuente existen en DB',
      status: missingCuits.length === 0 ? 'PASS' : 'WARN',
      details: missingCuits.length === 0
        ? `Todos los ${sourceCuits.length} CUITs fueron migrados correctamente`
        : `${missingCuits.length} CUITs no encontrados en DB`,
      data: { total: sourceCuits.length, missing: missingCuits.length, missingCuits: missingCuits.slice(0, 10) }
    });
  }

  // 8. Muestra aleatoria de datos
  async checkRandomSample(): Promise<void> {
    console.log('\n🎲 Verificando muestra aleatoria...');

    // Obtener 5 generadores aleatorios
    const sample = await this.prisma.$queryRaw<any[]>`
      SELECT g.*, u.email as user_email, u.nombre as user_nombre, u.rol as user_rol
      FROM generadores g
      JOIN usuarios u ON g."usuarioId" = u.id
      ORDER BY RANDOM()
      LIMIT 5
    `;

    console.log('\n📋 Muestra de 5 generadores:');
    sample.forEach((g, i) => {
      console.log(`   ${i + 1}. ${g.razonSocial}`);
      console.log(`      CUIT: ${g.cuit}`);
      console.log(`      Email: ${g.email}`);
      console.log(`      Inscripción: ${g.numeroInscripcion}`);
      console.log(`      Usuario: ${g.user_email} (${g.user_rol})`);
    });

    this.addResult({
      name: 'Muestra Aleatoria',
      description: 'Verificación visual de datos',
      status: sample.length > 0 ? 'PASS' : 'WARN',
      details: `${sample.length} registros mostrados para verificación manual`,
      data: { sample }
    });
  }

  // Ejecutar todas las validaciones
  async validate(sourceFile?: string): Promise<ValidationResult> {
    console.log('🔍 Iniciando validación post-migración...\n');
    console.log('='.repeat(60));

    // Cargar archivo fuente si se proporciona
    if (sourceFile && fs.existsSync(sourceFile)) {
      this.sourceData = JSON.parse(fs.readFileSync(sourceFile, 'utf-8'));
      console.log(`📂 Archivo fuente cargado: ${sourceFile} (${this.sourceData.length} registros)`);
    }

    // Ejecutar todas las verificaciones
    await this.checkRecordCounts();
    await this.checkReferentialIntegrity();
    await this.checkUniqueness();
    await this.checkRequiredFields();
    await this.checkPlaceholderEmails();
    await this.checkActiveStatus();
    await this.checkSourceCuits();
    await this.checkRandomSample();

    // Calcular resumen
    const summary = {
      total: this.results.length,
      passed: this.results.filter(r => r.status === 'PASS').length,
      failed: this.results.filter(r => r.status === 'FAIL').length,
      warnings: this.results.filter(r => r.status === 'WARN').length
    };

    const result: ValidationResult = {
      passed: summary.failed === 0,
      checks: this.results,
      summary
    };

    // Imprimir resumen
    console.log('\n' + '='.repeat(60));
    console.log('📊 RESUMEN DE VALIDACIÓN');
    console.log('='.repeat(60));
    console.log(`✅ Pasados:    ${summary.passed}`);
    console.log(`❌ Fallados:   ${summary.failed}`);
    console.log(`⚠️  Advertencias: ${summary.warnings}`);
    console.log('='.repeat(60));
    console.log(`\n${result.passed ? '✅ VALIDACIÓN EXITOSA' : '❌ VALIDACIÓN FALLIDA'}`);

    return result;
  }

  async disconnect(): Promise<void> {
    await this.prisma.$disconnect();
  }
}

// Punto de entrada principal
async function main(): Promise<void> {
  const sourceFile = process.argv[2];

  const validator = new MigrationValidator();

  try {
    const result = await validator.validate(sourceFile);

    // Guardar resultados
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const outputFile = `./logs/validation-${timestamp}.json`;
    if (!fs.existsSync('./logs')) {
      fs.mkdirSync('./logs', { recursive: true });
    }
    fs.writeFileSync(outputFile, JSON.stringify(result, null, 2));
    console.log(`\n📝 Resultados guardados en: ${outputFile}`);

    process.exit(result.passed ? 0 : 1);
  } catch (error: any) {
    console.error('\n❌ Error durante la validación:', error.message);
    process.exit(1);
  } finally {
    await validator.disconnect();
  }
}

main();
