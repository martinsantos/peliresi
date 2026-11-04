import { documentaryResolution } from './manifiestoAdendaDocument';
import { wasteDifferences, type ObservedWaste, type WasteDifference } from './inspectionIntake';

type Addendum = { id: string; rectificaId?: string | null; version: number; revisiones: unknown; informeHallazgo: unknown; declaracion?: unknown; residuos?: unknown };
export type CertificateFinding = { id: string; corriente: string; unidad: string; observado: number; adendas: { id: string; version: number }[] };
const units = new Set(['kg', 'l', 't', 'm3', 'un']);
const unitKey = (unit: string) => unit === 'lt' ? 'l' : unit === 'tn' ? 't' : unit;
const approved = (row: Addendum) => Array.isArray(row.revisiones) && row.revisiones.at(-1)?.decision === 'APROBADA';
const isWaste = (row: unknown): row is ObservedWaste => {
  if (!row || typeof row !== 'object') return false;
  const r = row as Partial<ObservedWaste>;
  return typeof r.corriente === 'string' && /^Y\d{1,3}$/.test(r.corriente)
    && typeof r.unidad === 'string' && units.has(unitKey(r.unidad))
    && typeof r.cantidad === 'number' && Number.isFinite(r.cantidad) && r.cantidad > 0;
};

/** Operator findings are evidence of observation, not evidence of treatment. */
export function certificateFindings(addenda: Addendum[]) {
  const byId = new Map(addenda.map(a => [a.id, a]));
  const { invalidLineages } = documentaryResolution(addenda);
  const superseded = new Set<string>();
  for (const row of addenda) {
    if (!approved(row) || invalidLineages.has(row.id)) continue;
    let parent = row.rectificaId ?? null;
    while (parent && !superseded.has(parent)) {
      superseded.add(parent);
      parent = byId.get(parent)?.rectificaId ?? null;
    }
  }
  const candidates = new Map<string, CertificateFinding>();
  const errors: string[] = [];
  for (const row of addenda) {
    if (!approved(row) || superseded.has(row.id) || invalidLineages.has(row.id)) continue;
    const report = row.informeHallazgo;
    let snapshotDifferences: WasteDifference[] | null = null;
    if (row.declaracion !== undefined || row.residuos !== undefined) {
      const declared = row.declaracion && typeof row.declaracion === 'object' && !Array.isArray(row.declaracion)
        ? (row.declaracion as { residuos?: unknown }).residuos : null;
      if (!Array.isArray(declared) || !Array.isArray(row.residuos) || !declared.every(isWaste) || !row.residuos.every(isWaste)) {
        errors.push('No se pudo interpretar la declaración o las cantidades observadas de una adenda aprobada.');
        continue;
      }
      snapshotDifferences = wasteDifferences(declared, row.residuos);
    }
    let differences: unknown[];
    if (report == null) {
      if (snapshotDifferences) differences = snapshotDifferences;
      else {
        // Without a readable snapshot, a rectification cannot erase an earlier finding.
        let parent = row.rectificaId ?? null;
        while (parent) {
          const ancestor = byId.get(parent);
          if (ancestor?.informeHallazgo != null) {
            errors.push('Una rectificación aprobada no conserva el informe de hallazgo anterior.');
            break;
          }
          parent = ancestor?.rectificaId ?? null;
        }
        continue;
      }
    } else {
      if (typeof report !== 'object' || Array.isArray(report)) {
        errors.push('No se pudo interpretar un informe de hallazgo aprobado.');
        continue;
      }
      const record = report as { formato?: unknown; diferencias?: unknown };
      if (record.formato !== 'SITREP-INFORME-HALLAZGO-1' || !Array.isArray(record.diferencias)) {
        errors.push('No se pudo interpretar un informe de hallazgo aprobado.');
        continue;
      }
      differences = record.diferencias;
      if (snapshotDifferences) {
        const omitted = (rows: any[]) => rows.filter(x=>x?.tipo==='Y_OMITIDA').map(x=>`${x.corriente}:${unitKey(x.unidad)}:${x.observado}`).sort();
        if (JSON.stringify(omitted(differences)) !== JSON.stringify(omitted(snapshotDifferences))) {
          errors.push('El informe de hallazgo no coincide con las cantidades de su adenda aprobada.');
          continue;
        }
      }
    }
    for (const item of differences) {
      const difference = item as Record<string, unknown>;
      if (!difference || typeof difference !== 'object') {
        errors.push('No se pudo interpretar una diferencia del informe de hallazgo.');
        continue;
      }
      if (difference.tipo !== 'Y_OMITIDA') continue;
      const { corriente, unidad, observado } = difference;
      if (typeof corriente !== 'string' || !/^Y\d{1,3}$/.test(corriente) || typeof unidad !== 'string'
        || !units.has(unitKey(unidad)) || typeof observado !== 'number' || !Number.isFinite(observado) || observado <= 0) {
        errors.push('Un informe aprobado tiene una corriente hallada sin cantidad o unidad verificable.');
        continue;
      }
      const key = `hallazgo:${corriente}:${unitKey(unidad)}`;
      const existing = candidates.get(key);
      if (existing && Math.abs(existing.observado - observado) > 1e-9) {
        errors.push(`Los informes aprobados discrepan sobre ${corriente} (${unitKey(unidad)}); revisá las adendas.`);
      } else if (existing) {
        existing.adendas.push({ id: row.id, version: row.version });
      } else {
        candidates.set(key, { id: key, corriente, unidad: unitKey(unidad), observado, adendas: [{ id: row.id, version: row.version }] });
      }
    }
  }
  for (const finding of candidates.values()) finding.adendas.sort((a, b) => a.id.localeCompare(b.id));
  return { hallazgos: [...candidates.values()].sort((a, b) => a.id.localeCompare(b.id)),
    problemas: [...new Set(errors)] };
}
