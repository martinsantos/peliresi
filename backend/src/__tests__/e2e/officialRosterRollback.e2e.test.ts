import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { PrismaClient } from '@prisma/client';

const enabled = process.env.MIGRATION_ROLLBACK_E2E === '1';
const suite = enabled ? describe : describe.skip;
const prisma = new PrismaClient();

function assertIsolatedDatabase(): void {
  if (process.env.MIGRATION_ROLLBACK_E2E_CONFIRM !== 'YES') {
    throw new Error('MIGRATION_ROLLBACK_E2E_CONFIRM=YES es obligatorio');
  }

  const rawUrl = process.env.DATABASE_URL;
  if (!rawUrl) throw new Error('DATABASE_URL es obligatorio');
  const databaseUrl = new URL(rawUrl);
  const hostIsLocal = databaseUrl.hostname === '127.0.0.1' || databaseUrl.hostname === 'localhost';
  const databaseName = databaseUrl.pathname.replace(/^\//, '').toLowerCase();
  if (!hostIsLocal || !databaseName.includes('test')) {
    throw new Error('La prueba de rollback sólo puede ejecutarse contra PostgreSQL local y una base con "test" en el nombre');
  }
}

function generator(cuit: string, sourceRow: number) {
  return {
    cuit,
    sourceRows: [sourceRow],
    certificates: [`G-ROLLBACK-${sourceRow}`],
    razonSocial: `Actor rollback ${sourceRow}`,
    numeroInscripcion: `G-ROLLBACK-${sourceRow}`,
    domicilio: 'Domicilio de prueba',
    telefono: '0000000000',
    email: `rollback-${sourceRow}@example.invalid`,
    actividad: null,
    rubro: null,
    categoria: 'PRUEBA',
    corrientesControl: null,
    expedienteInscripcion: null,
    domicilioLegalCalle: null,
    domicilioLegalLocalidad: null,
    domicilioLegalDepto: null,
    domicilioRealCalle: null,
    domicilioRealLocalidad: null,
    domicilioRealDepto: null,
    certificacionISO: null,
    resolucionInscripcion: null,
    factorR: null,
    montoMxR: null,
    categoriaIndividual: null,
    libroOperatoria: null,
    activo: true,
  };
}

suite('official roster migration transactional rollback — isolated database only', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('rolls back every actor, user and audit write when a later row violates a unique key', async () => {
    assertIsolatedDatabase();
    const uniqueDigits = `${Date.now()}`.slice(-8);
    const duplicateCuit = `30-${uniqueDigits}-7`;
    const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'sitrep-roster-rollback-'));
    const payloadPath = path.join(tempDir, 'duplicate-generators.json');
    const payload = {
      schemaVersion: 1,
      generatedAt: new Date().toISOString(),
      reportingDate: '2099-01-01',
      sources: {
        generadores: { path: 'fixture-generadores.xlsx', sha256: 'fixture' },
        transportistas: { path: 'fixture-transportistas.xlsx', sha256: 'fixture' },
        operadores: { path: 'fixture-operadores.xlsx', sha256: 'fixture' },
      },
      sourceWarnings: {},
      // Both rows are planned before writes begin. The second create fails on
      // Generador.cuit after the first user and actor have been staged.
      generadores: [generator(duplicateCuit, 1), generator(duplicateCuit, 2)],
      transportistas: [],
      operadores: [],
    };
    fs.writeFileSync(payloadPath, JSON.stringify(payload));

    try {
      const before = await Promise.all([
        prisma.usuario.count({ where: { cuit: duplicateCuit } }),
        prisma.generador.count({ where: { cuit: duplicateCuit } }),
        prisma.auditoria.count({ where: { accion: 'SINCRONIZAR_PADRONES_OFICIALES' } }),
      ]);

      const result = spawnSync(
        process.platform === 'win32' ? 'npx.cmd' : 'npx',
        ['ts-node', 'scripts/sync-official-rosters.ts', '--payload', payloadPath, '--apply'],
        {
          cwd: path.resolve(__dirname, '../../..'),
          env: { ...process.env },
          encoding: 'utf8',
          timeout: 120_000,
        },
      );

      expect(result.status, `La carga debía fallar. stdout=${result.stdout} stderr=${result.stderr}`).not.toBe(0);
      const after = await Promise.all([
        prisma.usuario.count({ where: { cuit: duplicateCuit } }),
        prisma.generador.count({ where: { cuit: duplicateCuit } }),
        prisma.auditoria.count({ where: { accion: 'SINCRONIZAR_PADRONES_OFICIALES' } }),
      ]);
      expect(after).toEqual(before);
    } finally {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  }, 150_000);
});
