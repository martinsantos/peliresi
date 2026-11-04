import path from 'path';
import { Prisma } from '@prisma/client';
import { AppError } from '../middlewares/errorHandler';

const enrichment = require(path.join(__dirname, '..', '..', 'data', 'operadores-enrichment.json'));
const enrichmentJson = JSON.stringify(enrichment);

export function directoryText(value: unknown, name: string): string | undefined {
  if (value === undefined || value === '') return undefined;
  if (typeof value !== 'string' || value.length > 160) throw new AppError(`Filtro ${name} inválido`, 400);
  return value.trim() || undefined;
}

/** Token matching avoids Y8 matching Y80 and accepts FIJO / IN SITU legacy labels.
 * This is consultation only: it does not grant or modify operational modalities.
 * Static fallback matches the existing directory display when a DB field is empty.
 */
export function operatorDirectoryQuery(query: { tipoOperador?: unknown; corriente?: unknown }): Prisma.Sql | undefined {
  const tipo = directoryText(query.tipoOperador, 'tipo')?.toUpperCase().replace(/_/g, ' ');
  const corriente = directoryText(query.corriente, 'corriente')?.toUpperCase();
  if (tipo && !['FIJO', 'IN SITU'].includes(tipo)) throw new AppError('Tipo de operador inválido', 400);
  if (corriente && !/^Y([1-9]|[1-3]\d|4[0-8])$/.test(corriente)) throw new AppError('Corriente Y inválida', 400);
  if (!tipo && !corriente) return undefined;
  const conditions: Prisma.Sql[] = [];
  if (tipo) {
    const pattern = tipo === 'FIJO' ? '(^|[^[:alnum:]])FIJO([^[:alnum:]]|$)' : '(^|[^[:alnum:]])IN[[:space:]_]+SITU([^[:alnum:]]|$)';
    conditions.push(Prisma.sql`COALESCE(NULLIF(BTRIM("tipoOperador"), ''), (${enrichmentJson}::jsonb -> "cuit" ->> 'tipoOperador'), '') ~* ${pattern}`);
  }
  if (corriente) {
    const pattern = '(^|[^[:alnum:]])' + corriente + '([^[:alnum:]]|$)';
    conditions.push(Prisma.sql`COALESCE(NULLIF(BTRIM("corrientesY"), ''), (${enrichmentJson}::jsonb -> "cuit" -> 'corrientes')::text, '') ~* ${pattern}`);
  }
  return Prisma.sql`SELECT "id" FROM "operadores" WHERE ${Prisma.join(conditions, ' AND ')}`;
}
