import { PrismaClient } from '@prisma/client';
import { auditProposalImpact, type DatabaseIdentity } from '../services/proposalImpactAudit.service';

/** Manual, read-only command; no route, scheduler, default database or writes. */
async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const url = process.env.SITREP_AUDIT_DATABASE_URL || '';
  const expected: DatabaseIdentity = {
    database: process.env.SITREP_AUDIT_EXPECTED_DATABASE || '',
    address: process.env.SITREP_AUDIT_EXPECTED_ADDRESS || '',
    port: Number(process.env.SITREP_AUDIT_EXPECTED_PORT || 0),
    schema: process.env.SITREP_AUDIT_EXPECTED_SCHEMA || '',
  };
  try {
    if (args.length !== 1 || args[0] !== '--operativo') throw new Error('Modo inválido');
    const target = new URL(url);
    if (!['postgres:', 'postgresql:'].includes(target.protocol) || !target.hostname || !target.pathname.slice(1)) throw new Error('Destino inválido');
    if (!expected.database || !expected.address || !expected.schema || !Number.isInteger(expected.port)
      || expected.port < 1 || expected.port > 65535) throw new Error('Identidad incompleta');
    const db = new PrismaClient({ datasources: { db: { url } } });
    try {
      const report = await auditProposalImpact(db, { kind: 'operational', expected });
      process.stdout.write(JSON.stringify(report, null, 2) + '\n');
    } finally { await db.$disconnect(); }
  } catch {
    // Avoid exposing connection strings, record data, or partial results.
    process.stderr.write('No se completó la auditoría. Verificá la conexión de sólo lectura y la identidad del destino; no se generó un informe parcial.\n');
    process.exitCode = 1;
  }
}

void main();
